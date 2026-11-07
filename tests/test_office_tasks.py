import json
import shutil
import tempfile
import threading
import time
import unittest
from http.client import HTTPConnection
from pathlib import Path
from unittest.mock import patch

import desk
import office_tasks
import server
from office_tasks import (
    SCRIPT_TASKS,
    ProcessResult,
    TaskRunner,
    TaskValidationError,
    database_connection,
    validate_task_request,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
LEADS_NAME = "leads_restaurant_lahore.json"
SAMPLE_LEADS = [
    {
        "name": "Cedar House Cafe",
        "category": "Cafe",
        "city": "Portland",
        "website": "https://cedar.example",
        "email": "hello@cedar.example",
        "phone": "555-0100",
    }
]


def prepare_workspace(path: Path, *scripts: str) -> None:
    path.mkdir(parents=True, exist_ok=True)
    for script in scripts:
        shutil.copy2(PROJECT_ROOT / script, path / script)
    (path / LEADS_NAME).write_text(
        json.dumps(SAMPLE_LEADS), encoding="utf-8"
    )


class TaskValidationTests(unittest.TestCase):
    def test_accepts_only_named_tasks_and_pitch_lead_name(self):
        self.assertEqual(validate_task_request({"task": "score"}), ("score", None))
        self.assertEqual(
            validate_task_request({"task": "pitch", "lead_name": " Cedar "}),
            ("pitch", "Cedar"),
        )
        for payload in (
            ["score"],
            {"task": "score", "script": "score.py"},
            {"task": "score", "args": ["--send"]},
            {"task": "sender.py --send"},
            {"task": "send", "lead_name": "Cedar"},
            {"task": "pitch", "lead_name": " "},
        ):
            with self.subTest(payload=payload), self.assertRaises(TaskValidationError):
                validate_task_request(payload)

    def test_sender_mapping_is_fixed_and_has_no_send_flag(self):
        self.assertEqual(SCRIPT_TASKS["send"], ("sender.py", 60))
        self.assertNotIn("--send", str(SCRIPT_TASKS))


class TaskRunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp_dir.name) / "workspace"
        self.database_path = Path(self.temp_dir.name) / "office.sqlite3"
        server.initialize_database(self.database_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def new_runner(self):
        return TaskRunner(self.database_path, root=self.workspace)

    def test_pitch_draft_migration_adds_a_separate_table(self):
        runner = self.new_runner()
        try:
            with database_connection(self.database_path) as db:
                task_columns = [
                    row["name"] for row in db.execute("PRAGMA table_info(office_tasks)")
                ]
                draft_columns = [
                    row["name"]
                    for row in db.execute("PRAGMA table_info(office_pitch_drafts)")
                ]
                migration_versions = [
                    row["version"]
                    for row in db.execute(
                        "SELECT version FROM office_schema_migrations ORDER BY version"
                    )
                ]
            self.assertEqual(
                task_columns,
                [
                    "id", "task", "role", "status", "lead_name", "created_at",
                    "assigned_at", "started_at", "completed_at", "exit_code",
                    "stdout", "stderr", "error", "result_json",
                ],
            )
            self.assertIn("lead_key", draft_columns)
            self.assertIn("subject", draft_columns)
            self.assertIn("body", draft_columns)
            self.assertEqual(migration_versions, [1, 2])
        finally:
            runner.shutdown()

    def test_allowlisted_score_execution_persists_result_and_event_history(self):
        prepare_workspace(self.workspace, "score.py")
        runner = self.new_runner()
        try:
            runner.start()
            task = runner.submit("score")
            completed = runner.wait_for_task(task["id"], 5)
            self.assertEqual(completed["status"], "completed")
            self.assertEqual(completed["exit_code"], 0)
            self.assertEqual(completed["result"], {"lead_count": 1})
            events = runner.get_events(task_id=task["id"])
            self.assertEqual(
                [event["type"] for event in events],
                ["queued", "assigned", "started", "output", "completed"],
            )
            updated_leads = json.loads(
                (self.workspace / LEADS_NAME).read_text(encoding="utf-8")
            )
            self.assertEqual(updated_leads[0]["score"], 100)

            restarted = TaskRunner(self.database_path, root=self.workspace)
            self.assertEqual(restarted.get_task(task["id"])["status"], "completed")
        finally:
            runner.shutdown()

    def test_queue_serializes_task_execution(self):
        runner = self.new_runner()
        entered = threading.Event()
        release = threading.Event()
        counter_lock = threading.Lock()
        active = 0
        max_active = 0

        def fake_execute(_task):
            nonlocal active, max_active
            with counter_lock:
                active += 1
                max_active = max(max_active, active)
            entered.set()
            release.wait(2)
            with counter_lock:
                active -= 1
            return ProcessResult(0, "finished", "")

        try:
            with (
                patch.object(runner, "_execute_task", side_effect=fake_execute),
                patch.object(runner, "_verify_success", return_value={"ok": True}),
            ):
                runner.start()
                first = runner.submit("score")
                self.assertTrue(entered.wait(2))
                second = runner.submit("emails")
                release.set()
                self.assertEqual(runner.wait_for_task(first["id"], 5)["status"], "completed")
                self.assertEqual(runner.wait_for_task(second["id"], 5)["status"], "completed")
            self.assertEqual(max_active, 1)
        finally:
            release.set()
            runner.shutdown()

    def test_failed_process_is_recorded_and_credentials_are_redacted(self):
        runner = self.new_runner()
        try:
            with (
                patch.object(
                    runner,
                    "_execute_task",
                    return_value=ProcessResult(7, "API_TOKEN=unit-test-secret", "failed"),
                ),
                patch.dict("os.environ", {"API_TOKEN": "unit-test-secret"}),
                patch.object(runner, "_verify_success", return_value={}),
            ):
                runner.start()
                task = runner.submit("score")
                failed = runner.wait_for_task(task["id"], 5)
            self.assertEqual(failed["status"], "failed")
            self.assertEqual(failed["exit_code"], 7)
            self.assertNotIn("unit-test-secret", failed["stdout"])
            self.assertNotIn("unit-test-secret", failed["stderr"])
            self.assertNotIn(
                "unit-test-secret",
                json.dumps(runner.get_events(task_id=task["id"])),
            )
        finally:
            runner.shutdown()

    def test_task_output_storage_is_bounded(self):
        runner = self.new_runner()
        try:
            with (
                patch.object(
                    runner,
                    "_execute_task",
                    return_value=ProcessResult(0, "x" * (office_tasks.MAX_OUTPUT_CHARS + 500), ""),
                ),
                patch.object(runner, "_verify_success", return_value={"ok": True}),
            ):
                runner.start()
                task = runner.submit("score")
                completed = runner.wait_for_task(task["id"], 5)
            self.assertEqual(completed["status"], "completed")
            self.assertEqual(len(completed["stdout"]), office_tasks.MAX_OUTPUT_CHARS)
        finally:
            runner.shutdown()

    def test_timeout_is_distinct_from_failure(self):
        self.workspace.mkdir(parents=True)
        (self.workspace / "score.py").write_text(
            "import time\nprint('started', flush=True)\ntime.sleep(10)\n",
            encoding="utf-8",
        )
        runner = self.new_runner()
        try:
            with patch.dict(office_tasks.SCRIPT_TASKS, {"score": ("score.py", 0.1)}):
                runner.start()
                task = runner.submit("score")
                timed_out = runner.wait_for_task(task["id"], 5)
            self.assertEqual(timed_out["status"], "timed_out")
            self.assertIsNotNone(timed_out["completed_at"])
            self.assertIn("timeout", timed_out["error"])
            self.assertEqual(runner.get_events(task_id=task["id"])[-1]["type"], "failed")
        finally:
            runner.shutdown()

    def test_zero_exit_with_stale_output_is_a_failure(self):
        prepare_workspace(self.workspace)
        (self.workspace / "score.py").write_text("print('done')\n", encoding="utf-8")
        runner = self.new_runner()
        try:
            runner.start()
            task = runner.submit("score")
            failed = runner.wait_for_task(task["id"], 5)
            self.assertEqual(failed["status"], "failed")
            self.assertIn("not updated", failed["error"])
        finally:
            runner.shutdown()

    def test_restart_marks_queued_and_running_tasks_interrupted_without_rerun(self):
        runner = self.new_runner()
        queued = runner.submit("score")
        running = runner.submit("emails")
        with database_connection(self.database_path) as db:
            db.execute(
                "UPDATE office_tasks SET status = 'running', started_at = ? WHERE id = ?",
                (office_tasks.utc_now(), running["id"]),
            )

        recovered = TaskRunner(self.database_path, root=self.workspace)
        try:
            self.assertEqual(recovered.get_task(queued["id"])["status"], "interrupted")
            self.assertEqual(recovered.get_task(running["id"])["status"], "interrupted")
            recovered.start()
            time.sleep(0.1)
            self.assertEqual(recovered.get_task(queued["id"])["status"], "interrupted")
            self.assertEqual(recovered.get_task(running["id"])["status"], "interrupted")
            self.assertEqual(
                recovered.get_events(task_id=queued["id"])[-1]["type"], "interrupted"
            )
        finally:
            runner.shutdown()
            recovered.shutdown()

    def test_import_uses_database_and_verifies_import_totals(self):
        prepare_workspace(
            self.workspace,
            "import_leads.py",
            "sender.py",
            "email_writer.py",
            "server.py",
        )
        runner = self.new_runner()
        try:
            runner.start()
            task = runner.submit("import")
            completed = runner.wait_for_task(task["id"], 5)
            self.assertEqual(completed["status"], "completed")
            self.assertEqual(completed["result"]["added"], 1)
            self.assertEqual(completed["result"]["user_prospects"], 1)
            with database_connection(self.database_path) as db:
                row = db.execute(
                    "SELECT id, name FROM prospects WHERE name = ?",
                    ("Cedar House Cafe",),
                ).fetchone()
            self.assertIsNotNone(row)
            activity = desk.base.connect_database(self.database_path)
            try:
                imported_event = activity.execute(
                    "SELECT event_type, to_status FROM prospect_activity_events "
                    "WHERE prospect_id = ? ORDER BY id DESC LIMIT 1",
                    (row["id"],),
                ).fetchone()
            finally:
                activity.close()
            self.assertEqual(imported_event["event_type"], "imported")
            self.assertEqual(imported_event["to_status"], "new")
        finally:
            runner.shutdown()

    def test_send_task_runs_sender_without_real_send_flag(self):
        prepare_workspace(self.workspace, "sender.py", "email_writer.py")
        runner = self.new_runner()
        original_popen = office_tasks.subprocess.Popen
        commands = []

        def observe_popen(command, *args, **kwargs):
            commands.append(command)
            return original_popen(command, *args, **kwargs)

        try:
            with patch("office_tasks.subprocess.Popen", side_effect=observe_popen):
                runner.start()
                task = runner.submit("send")
                completed = runner.wait_for_task(task["id"], 5)
            self.assertEqual(completed["status"], "completed")
            self.assertEqual(completed["result"], {"dry_run": True})
            self.assertTrue(all("--send" not in command for command in commands))
            self.assertFalse((self.workspace / "sent_log.json").exists())
        finally:
            runner.shutdown()


class OfficeTaskApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)
        self.task_root = root / "task-root"
        prepare_workspace(self.task_root)
        self.database_path = root / "office.sqlite3"
        self.httpd = desk.create_server(
            port=0,
            database_path=self.database_path,
            task_root=self.task_root,
        )
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.host, self.port = self.httpd.server_address

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.httpd.task_runner.shutdown()
        self.thread.join(timeout=2)
        self.temp_dir.cleanup()

    def request(self, method, path, payload=None, *, headers=None):
        connection = HTTPConnection(self.host, self.port, timeout=3)
        body = None if payload is None else json.dumps(payload)
        request_headers = dict(headers or {})
        if body is not None:
            request_headers["Content-Type"] = "application/json"
        connection.request(method, path, body=body, headers=request_headers)
        response = connection.getresponse()
        content = response.read()
        connection.close()
        return response.status, json.loads(content) if content else None

    def post_task(self, payload):
        return self.request(
            "POST",
            "/api/office/tasks",
            payload,
            headers={"X-Desk": "1"},
        )

    def restart_server(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.httpd.task_runner.shutdown()
        self.thread.join(timeout=2)
        self.httpd = desk.create_server(
            port=0,
            database_path=self.database_path,
            task_root=self.task_root,
        )
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.host, self.port = self.httpd.server_address

    def test_submission_validation_history_and_task_details(self):
        status, _ = self.request(
            "POST", "/api/office/tasks", {"task": "score"}
        )
        self.assertEqual(status, 403)

        status, error = self.post_task({"task": "arbitrary.py"})
        self.assertEqual(status, 400)
        self.assertIn("task must be one of", error["error"])

        status, queued = self.post_task({"task": "pitch", "lead_name": "Cedar House Cafe"})
        self.assertEqual(status, 202)
        task_id = queued["task"]["id"]
        completed = self.httpd.task_runner.wait_for_task(task_id, 5)
        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["result"]["name"], "Cedar House Cafe")

        status, detail = self.request("GET", f"/api/office/tasks/{task_id}")
        self.assertEqual(status, 200)
        self.assertEqual(detail["task"]["status"], "completed")
        self.assertIn("body", detail["task"]["result"])

        status, events = self.request("GET", f"/api/office/tasks/{task_id}/events")
        self.assertEqual(status, 200)
        self.assertEqual(events["events"][0]["type"], "queued")

        status, history = self.request("GET", "/api/office/tasks?limit=10")
        self.assertEqual(status, 200)
        self.assertEqual(history["tasks"][0]["id"], task_id)

    def test_pitch_draft_generation_editing_and_persistence(self):
        status, preview = self.request(
            "GET", "/api/office/drafts?lead_name=Cedar%20House%20Cafe"
        )
        self.assertEqual(status, 200)
        self.assertFalse(preview["draft"]["saved"])
        self.assertTrue(preview["draft"]["subject"])
        self.assertIn("Cedar House Cafe", preview["draft"]["body"])

        status, queued = self.post_task(
            {"task": "pitch", "lead_name": "Cedar House Cafe"}
        )
        self.assertEqual(status, 202)
        task_id = queued["task"]["id"]
        completed = self.httpd.task_runner.wait_for_task(task_id, 5)
        self.assertEqual(completed["status"], "completed")

        status, result = self.request(
            "GET",
            f"/api/office/drafts?lead_name=Cedar%20House%20Cafe&source_task_id={task_id}",
        )
        self.assertEqual(status, 200)
        self.assertEqual(result["draft"], None)

        status, saved = self.request(
            "POST",
            "/api/office/drafts",
            {
                "lead_name": "Cedar House Cafe",
                "email": "hello@cedar.example",
                "subject": "Edited subject",
                "body": "Edited full pitch body.",
                "source_task_id": task_id,
            },
            headers={"X-Desk": "1"},
        )
        self.assertEqual(status, 200)
        self.assertTrue(saved["draft"]["saved"])
        self.assertEqual(saved["draft"]["subject"], "Edited subject")
        self.assertEqual(saved["draft"]["source_task_id"], task_id)

        status, loaded = self.request(
            "GET", "/api/office/drafts?lead_name=Cedar%20House%20Cafe"
        )
        self.assertEqual(status, 200)
        self.assertEqual(loaded["draft"]["body"], "Edited full pitch body.")
        self.assertIsNotNone(loaded["draft"]["updated_at"])

        self.restart_server()
        status, persisted = self.request(
            "GET", "/api/office/drafts?lead_name=Cedar%20House%20Cafe"
        )
        self.assertEqual(status, 200)
        self.assertEqual(persisted["draft"]["subject"], "Edited subject")

    def test_pitch_draft_rejects_bad_fields_and_unrelated_task_reference(self):
        status, response = self.request(
            "POST",
            "/api/office/drafts",
            {
                "lead_name": "Cedar House Cafe",
                "subject": "A subject",
                "body": "A body",
                "unexpected": True,
            },
            headers={"X-Desk": "1"},
        )
        self.assertEqual(status, 400)
        self.assertIn("unsupported fields", response["error"])

        status, response = self.request(
            "POST",
            "/api/office/drafts",
            {
                "lead_name": "Cedar House Cafe",
                "subject": "A subject",
                "body": "A body",
                "source_task_id": "0" * 32,
            },
            headers={"X-Desk": "1"},
        )
        self.assertEqual(status, 400)
        self.assertIn("completed pitch", response["error"])

    def test_sse_delivers_persisted_task_events(self):
        stream = HTTPConnection(self.host, self.port, timeout=3)
        stream.request("GET", "/api/office/events?after=0")
        response = stream.getresponse()
        self.assertEqual(response.status, 200)
        self.assertTrue(response.getheader("Content-Type").startswith("text/event-stream"))

        status, queued = self.post_task({"task": "pitch"})
        self.assertEqual(status, 202)
        deadline = time.monotonic() + 3
        frame = ""
        while time.monotonic() < deadline and "\n\n" not in frame:
            line = response.readline().decode("utf-8")
            frame += line
            if line == "\n" and "event: task" not in frame:
                frame = ""
        stream.close()
        self.assertIn("event: task", frame)
        self.assertIn('"type": "queued"', frame)
        self.httpd.task_runner.wait_for_task(queued["task"]["id"], 5)

    def test_legacy_script_route_remains_supported(self):
        shutil.copy2(PROJECT_ROOT / "score.py", self.task_root / "score.py")
        status, result = self.request(
            "POST",
            "/api/run/score",
            {},
            headers={"X-Desk": "1"},
        )
        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])

    def test_opt_out_endpoint_is_guarded_and_never_sends_email(self):
        with patch("desk.add_opt_out") as add_opt_out:
            status, response = self.request(
                "POST", "/api/optout", {"email": "hello@cedar.example"}
            )
            self.assertEqual(status, 403)
            self.assertEqual(response["error"], "Forbidden.")
            add_opt_out.assert_not_called()

            status, response = self.request(
                "POST",
                "/api/optout",
                {"email": "hello@cedar.example"},
                headers={"X-Desk": "1"},
            )
            self.assertEqual(status, 200)
            self.assertEqual(response, {"ok": True})
            add_opt_out.assert_called_once_with("hello@cedar.example")

    def test_server_rejects_non_local_bind_address(self):
        with self.assertRaises(ValueError):
            desk.create_server(
                host="0.0.0.0",
                port=0,
                database_path=self.database_path,
                task_root=self.task_root,
            )


if __name__ == "__main__":
    unittest.main()
