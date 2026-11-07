#!/usr/bin/env python3
"""Persistent, serialized task execution for the local AI Khan office."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from email_writer import build_email
from sender import FILE_NAME, SENT_LOG, load_json, load_leads
from server import connect_database

ROOT = Path(__file__).resolve().parent
MAX_OUTPUT_CHARS = 65_536
MAX_EVENT_MESSAGE_CHARS = 1_000
TASK_LIMIT = 100
SCRIPT_TASKS = {
    "discover": ("discover.py", 900),
    "emails": ("email_hunter.py", 1200),
    "score": ("score.py", 60),
    "import": ("import_leads.py", 60),
    "send": ("sender.py", 60),
}
TASK_ROLES = {
    "discover": "Lead Researcher",
    "emails": "Contact Researcher",
    "score": "Lead Analyst",
    "pitch": "Copywriter",
    "import": "Records Clerk",
    "send": "Outreach Operator",
}
TERMINAL_STATES = {"completed", "failed", "timed_out", "interrupted"}
TASK_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")
IMPORT_SUMMARY_PATTERN = re.compile(r"(\d+)\s+nayi leads,\s*(\d+)\s*update\.")
SECRET_ASSIGNMENT_PATTERN = re.compile(
    r"(?i)\b(password|passwd|secret|token|api[_-]?key|smtp_pass)"
    r"(\s*[:=]\s*)([^\s,;]+)"
)


@contextmanager
def database_connection(database_path: Path) -> Iterator[sqlite3.Connection]:
    connection = connect_database(database_path)
    try:
        with connection:
            yield connection
    finally:
        connection.close()


class TaskValidationError(ValueError):
    """A task request is invalid."""


class TaskQueueBusy(RuntimeError):
    """The legacy synchronous endpoint cannot start while work is queued."""


class TaskVerificationError(RuntimeError):
    """A script returned successfully but did not produce verified results."""


@dataclass
class ProcessResult:
    returncode: int
    stdout: str
    stderr: str
    timed_out: bool = False
    result: dict[str, Any] | None = None


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_task_request(payload: Any) -> tuple[str, str | None]:
    if not isinstance(payload, dict):
        raise TaskValidationError("Request body must be a JSON object.")
    if set(payload) - {"task", "lead_name"}:
        raise TaskValidationError("Only task and lead_name are accepted.")

    task_type = payload.get("task")
    if not isinstance(task_type, str) or task_type not in TASK_ROLES:
        raise TaskValidationError(
            f"task must be one of: {', '.join(TASK_ROLES)}."
        )

    lead_name = payload.get("lead_name")
    if lead_name is not None:
        if task_type != "pitch":
            raise TaskValidationError("lead_name is only valid for pitch tasks.")
        if not isinstance(lead_name, str):
            raise TaskValidationError("lead_name must be a string.")
        lead_name = lead_name.strip()
        if not lead_name or len(lead_name) > 120:
            raise TaskValidationError("lead_name must contain 1 to 120 characters.")
    return task_type, lead_name


def validate_task_id(task_id: str) -> bool:
    return bool(TASK_ID_PATTERN.fullmatch(task_id))


def initialize_task_database(database_path: Path) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with database_connection(database_path) as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS office_tasks (
                id TEXT PRIMARY KEY,
                task TEXT NOT NULL CHECK(task IN
                    ('discover', 'emails', 'score', 'pitch', 'import', 'send')),
                role TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN
                    ('queued', 'assigned', 'running', 'completed', 'failed',
                     'timed_out', 'interrupted')),
                lead_name TEXT,
                created_at TEXT NOT NULL,
                assigned_at TEXT,
                started_at TEXT,
                completed_at TEXT,
                exit_code INTEGER,
                stdout TEXT NOT NULL DEFAULT '',
                stderr TEXT NOT NULL DEFAULT '',
                error TEXT,
                result_json TEXT
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS office_task_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL REFERENCES office_tasks(id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                message TEXT NOT NULL,
                data_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            "CREATE INDEX IF NOT EXISTS office_tasks_queue_idx "
            "ON office_tasks(status, created_at, id)"
        )
        db.execute(
            "CREATE INDEX IF NOT EXISTS office_task_events_task_idx "
            "ON office_task_events(task_id, id)"
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS office_schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            "INSERT OR IGNORE INTO office_schema_migrations(version, applied_at) "
            "VALUES (1, ?)",
            (utc_now(),),
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS office_pitch_drafts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lead_key TEXT NOT NULL UNIQUE,
                lead_name TEXT NOT NULL CHECK(length(trim(lead_name)) BETWEEN 1 AND 120),
                email TEXT NOT NULL DEFAULT '' CHECK(length(email) <= 254),
                subject TEXT NOT NULL CHECK(length(trim(subject)) BETWEEN 1 AND 500),
                body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 12000),
                source_task_id TEXT REFERENCES office_tasks(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            "INSERT OR IGNORE INTO office_schema_migrations(version, applied_at) "
            "VALUES (2, ?)",
            (utc_now(),),
        )


def task_to_json(row: sqlite3.Row, *, include_output: bool = True) -> dict[str, Any]:
    task = {
        "id": row["id"],
        "task": row["task"],
        "role": row["role"],
        "status": row["status"],
        "lead_name": row["lead_name"],
        "created_at": row["created_at"],
        "assigned_at": row["assigned_at"],
        "started_at": row["started_at"],
        "completed_at": row["completed_at"],
        "exit_code": row["exit_code"],
        "error": row["error"],
    }
    if include_output:
        task["stdout"] = row["stdout"]
        task["stderr"] = row["stderr"]
        task["result"] = json.loads(row["result_json"]) if row["result_json"] else None
    return task


def event_to_json(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "task_id": row["task_id"],
        "type": row["event_type"],
        "message": row["message"],
        "data": json.loads(row["data_json"]),
        "created_at": row["created_at"],
    }


class TaskRunner:
    """Owns the durable FIFO queue and runs at most one allowlisted task."""

    def __init__(self, database_path: Path, root: Path = ROOT):
        self.database_path = Path(database_path)
        self.root = Path(root).resolve()
        self._condition = threading.Condition()
        self._stop = threading.Event()
        self._worker: threading.Thread | None = None
        self._active_process: subprocess.Popen[bytes] | None = None
        self._active_lock = threading.Lock()
        self._execution_snapshots: dict[str, dict[str, Any] | None] = {}
        self._execution_started_ns: dict[str, int] = {}
        self._sent_snapshots: dict[str, dict[str, Any] | None] = {}
        self._import_counts: dict[str, int] = {}
        initialize_task_database(self.database_path)
        self._interrupt_unfinished_tasks()

    def start(self) -> None:
        with self._condition:
            if self._worker is not None and self._worker.is_alive():
                return
            self._stop.clear()
            self._worker = threading.Thread(
                target=self._worker_loop, name="office-task-runner", daemon=True
            )
            self._worker.start()

    def shutdown(self, timeout: float = 5) -> None:
        self._stop.set()
        with self._condition:
            self._condition.notify_all()
        with self._active_lock:
            process = self._active_process
        if process is not None and process.poll() is None:
            process.kill()
        worker = self._worker
        if worker is not None and worker is not threading.current_thread():
            worker.join(timeout=timeout)

    def submit(
        self,
        task_type: str,
        lead_name: str | None = None,
        *,
        reject_if_busy: bool = False,
    ) -> dict[str, Any]:
        if task_type not in TASK_ROLES:
            raise TaskValidationError("Task is not allowlisted.")
        task_id = uuid.uuid4().hex
        now = utc_now()
        with self._condition, database_connection(self.database_path) as db:
            db.execute("BEGIN IMMEDIATE")
            if reject_if_busy:
                active = db.execute(
                    "SELECT 1 FROM office_tasks WHERE status IN "
                    "('queued', 'assigned', 'running') LIMIT 1"
                ).fetchone()
                if active:
                    raise TaskQueueBusy("Another office task is already queued or running.")
            db.execute(
                """
                INSERT INTO office_tasks(id, task, role, status, lead_name, created_at)
                VALUES (?, ?, ?, 'queued', ?, ?)
                """,
                (task_id, task_type, TASK_ROLES[task_type], lead_name, now),
            )
            self._insert_event(
                db, task_id, "queued", "Task added to the office queue.", {}
            )
            row = db.execute(
                "SELECT * FROM office_tasks WHERE id = ?", (task_id,)
            ).fetchone()
            self._condition.notify_all()
        return task_to_json(row)

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        if not validate_task_id(task_id):
            return None
        with database_connection(self.database_path) as db:
            row = db.execute(
                "SELECT * FROM office_tasks WHERE id = ?", (task_id,)
            ).fetchone()
        return task_to_json(row) if row else None

    def list_tasks(self, limit: int = 50) -> list[dict[str, Any]]:
        with database_connection(self.database_path) as db:
            rows = db.execute(
                "SELECT * FROM office_tasks ORDER BY created_at DESC, id DESC LIMIT ?",
                (min(max(limit, 1), TASK_LIMIT),),
            ).fetchall()
        return [task_to_json(row, include_output=False) for row in rows]

    def get_events(
        self, *, after_id: int = 0, task_id: str | None = None, limit: int = 500
    ) -> list[dict[str, Any]]:
        with database_connection(self.database_path) as db:
            if task_id is None:
                rows = db.execute(
                    "SELECT * FROM office_task_events WHERE id > ? "
                    "ORDER BY id LIMIT ?",
                    (after_id, min(max(limit, 1), 1000)),
                ).fetchall()
            else:
                rows = db.execute(
                    "SELECT * FROM office_task_events WHERE task_id = ? AND id > ? "
                    "ORDER BY id LIMIT ?",
                    (task_id, after_id, min(max(limit, 1), 1000)),
                ).fetchall()
        return [event_to_json(row) for row in rows]

    def wait_for_task(self, task_id: str, timeout: float) -> dict[str, Any] | None:
        deadline = time.monotonic() + timeout
        while True:
            task = self.get_task(task_id)
            if task is None or task["status"] in TERMINAL_STATES:
                return task
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return task
            with self._condition:
                self._condition.wait(timeout=min(remaining, 0.5))

    def wait_for_events(self, after_id: int, timeout: float = 15) -> list[dict[str, Any]]:
        events = self.get_events(after_id=after_id)
        if events:
            return events
        with self._condition:
            self._condition.wait(timeout=timeout)
        return self.get_events(after_id=after_id)

    def _interrupt_unfinished_tasks(self) -> None:
        now = utc_now()
        with database_connection(self.database_path) as db:
            db.execute("BEGIN IMMEDIATE")
            rows = db.execute(
                "SELECT id, status FROM office_tasks WHERE status IN "
                "('queued', 'assigned', 'running')"
            ).fetchall()
            for row in rows:
                message = "Server restarted before this task completed; it was not rerun."
                db.execute(
                    "UPDATE office_tasks SET status = 'interrupted', completed_at = ?, "
                    "error = ? WHERE id = ?",
                    (now, message, row["id"]),
                )
                self._insert_event(
                    db,
                    row["id"],
                    "interrupted",
                    message,
                    {"previous_status": row["status"]},
                )

    def _insert_event(
        self,
        db: sqlite3.Connection,
        task_id: str,
        event_type: str,
        message: str,
        data: dict[str, Any],
    ) -> None:
        db.execute(
            "INSERT INTO office_task_events "
            "(task_id, event_type, message, data_json, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                task_id,
                event_type,
                message[:MAX_EVENT_MESSAGE_CHARS],
                json.dumps(data, ensure_ascii=False),
                utc_now(),
            ),
        )

    def _event(
        self,
        task_id: str,
        event_type: str,
        message: str,
        data: dict[str, Any],
    ) -> None:
        with database_connection(self.database_path) as db:
            self._insert_event(db, task_id, event_type, message, data)
        with self._condition:
            self._condition.notify_all()

    def _worker_loop(self) -> None:
        while not self._stop.is_set():
            task = self._claim_next()
            if task is None:
                with self._condition:
                    self._condition.wait(timeout=0.5)
                continue
            self._run_claimed_task(task)

    def _claim_next(self) -> dict[str, Any] | None:
        with database_connection(self.database_path) as db:
            db.execute("BEGIN IMMEDIATE")
            active = db.execute(
                "SELECT 1 FROM office_tasks WHERE status IN ('assigned', 'running') LIMIT 1"
            ).fetchone()
            if active:
                return None
            row = db.execute(
                "SELECT * FROM office_tasks WHERE status = 'queued' "
                "ORDER BY rowid LIMIT 1"
            ).fetchone()
            if row is None:
                return None
            now = utc_now()
            updated = db.execute(
                "UPDATE office_tasks SET status = 'assigned', assigned_at = ? "
                "WHERE id = ? AND status = 'queued'",
                (now, row["id"]),
            ).rowcount
            if not updated:
                return None
            self._insert_event(
                db,
                row["id"],
                "assigned",
                f"Assigned to {row['role']}.",
                {"role": row["role"]},
            )
            row = db.execute(
                "SELECT * FROM office_tasks WHERE id = ?", (row["id"],)
            ).fetchone()
        with self._condition:
            self._condition.notify_all()
        return dict(row)

    def _run_claimed_task(self, task: dict[str, Any]) -> None:
        task_id = task["id"]
        if self._stop.is_set():
            self._finish(task_id, "interrupted", error="Server shutdown before execution.")
            return
        started_at = utc_now()
        with database_connection(self.database_path) as db:
            db.execute(
                "UPDATE office_tasks SET status = 'running', started_at = ? "
                "WHERE id = ? AND status = 'assigned'",
                (started_at, task_id),
            )
            self._insert_event(db, task_id, "started", "Task execution started.", {})
        with self._condition:
            self._condition.notify_all()

        result: ProcessResult | None = None
        try:
            result = self._execute_task(task)
            if self._stop.is_set():
                self._finish(
                    task_id,
                    "interrupted",
                    exit_code=result.returncode,
                    stdout=result.stdout,
                    stderr=result.stderr,
                    error="Server shutdown interrupted task execution.",
                )
            elif result.timed_out:
                self._finish(
                    task_id,
                    "timed_out",
                    exit_code=result.returncode,
                    stdout=result.stdout,
                    stderr=result.stderr,
                    error=f"{task['task']} exceeded its execution timeout.",
                )
            elif result.returncode != 0:
                self._finish(
                    task_id,
                    "failed",
                    exit_code=result.returncode,
                    stdout=result.stdout,
                    stderr=result.stderr,
                    error=result.stderr.strip()[-2_000:]
                    or result.stdout.strip()[-2_000:]
                    or f"Process exited with code {result.returncode}.",
                )
            else:
                verified_result = self._verify_success(task, result)
                self._finish(
                    task_id,
                    "completed",
                    exit_code=result.returncode,
                    stdout=result.stdout,
                    stderr=result.stderr,
                    result=verified_result,
                )
        except Exception as error:
            self._finish(
                task_id,
                "failed",
                exit_code=result.returncode if result else None,
                stdout=result.stdout if result else "",
                stderr=result.stderr if result else "",
                error=self._safe_text(str(error)),
            )

    def _execute_task(self, task: dict[str, Any]) -> ProcessResult:
        if task["task"] == "pitch":
            return self._execute_pitch(task)
        script, timeout = SCRIPT_TASKS[task["task"]]
        script_path = (self.root / script).resolve()
        if script_path.parent != self.root or not script_path.is_file():
            raise TaskVerificationError(f"Allowlisted script {script} is unavailable.")

        leads_path = self.root / FILE_NAME
        before_leads = self._file_snapshot(leads_path)
        before_sent_log = self._file_snapshot(self.root / SENT_LOG)
        self._execution_snapshots[task["id"]] = before_leads
        self._sent_snapshots[task["id"]] = before_sent_log
        if task["task"] == "import":
            with database_connection(self.database_path) as db:
                self._import_counts[task["id"]] = db.execute(
                    "SELECT COUNT(*) FROM prospects WHERE is_demo = 0"
                ).fetchone()[0]
        if task["task"] == "discover" and leads_path.exists():
            shutil.copy2(leads_path, self.root / "backup_leads.json")

        command = [sys.executable, str(script_path)]
        if task["task"] == "import":
            command.extend(["--db", str(self.database_path.resolve())])
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        return self._run_process(
            task["id"],
            command,
            env,
            timeout,
        )

    def _execute_pitch(self, task: dict[str, Any]) -> ProcessResult:
        leads = load_leads(self.root / FILE_NAME)
        requested = (task.get("lead_name") or "").casefold()
        lead = next(
            (item for item in leads if (item.get("name") or "").casefold() == requested),
            None,
        )
        if requested and lead is None:
            raise TaskVerificationError("The requested lead was not found.")
        sent = load_json(self.root / SENT_LOG, {})
        if lead is None:
            lead = next(
                (
                    item
                    for item in leads
                    if item.get("email")
                    and item["email"].strip().lower() not in sent
                ),
                leads[0] if leads else None,
            )
        if lead is None:
            raise TaskVerificationError("No lead is available for pitch generation.")
        pitch = build_email(lead)
        if not pitch.get("subject", "").strip() or not pitch.get("body", "").strip():
            raise TaskVerificationError("Pitch generation returned an empty subject or body.")
        return ProcessResult(
            returncode=0,
            stdout=f"Generated a pitch for {lead.get('name', 'the selected lead')}.\n",
            stderr="",
            result={"name": lead.get("name", ""), **pitch},
        )

    def _run_process(
        self,
        task_id: str,
        command: list[str],
        env: dict[str, str],
        timeout: int,
    ) -> ProcessResult:
        output: dict[str, list[str]] = {"stdout": [], "stderr": []}
        output_lock = threading.Lock()
        sizes = {"stdout": 0, "stderr": 0}
        last_event_sizes = {"stdout": 0, "stderr": 0}
        event_counts = {"stdout": 0, "stderr": 0}
        started_ns = time.time_ns()
        self._execution_started_ns[task_id] = started_ns
        process = subprocess.Popen(
            command,
            cwd=self.root,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False,
            bufsize=0,
            start_new_session=True,
        )
        with self._active_lock:
            self._active_process = process
            if self._stop.is_set():
                process.kill()

        def drain(stream: Any, channel: str) -> None:
            assert stream is not None
            while True:
                chunk = stream.read(4096)
                if not chunk:
                    break
                decoded = chunk.decode("utf-8", errors="replace")
                with output_lock:
                    output[channel].append(decoded)
                    combined = "".join(output[channel])
                    output[channel] = [combined[-MAX_OUTPUT_CHARS:]]
                    sizes[channel] += len(chunk)
                    should_emit = (
                        event_counts[channel] < 128
                        and (
                            event_counts[channel] == 0
                            or sizes[channel] - last_event_sizes[channel] >= 16_384
                        )
                    )
                    if should_emit:
                        event_counts[channel] += 1
                        last_event_sizes[channel] = sizes[channel]
                        bytes_received = sizes[channel]
                if should_emit:
                    self._event(
                        task_id,
                        "output",
                        f"Process produced {channel}.",
                        {"stream": channel, "bytes_received": bytes_received},
                    )

        readers = [
            threading.Thread(target=drain, args=(process.stdout, "stdout"), daemon=True),
            threading.Thread(target=drain, args=(process.stderr, "stderr"), daemon=True),
        ]
        for reader in readers:
            reader.start()
        timed_out = False
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            process.kill()
            process.wait()
        finally:
            for reader in readers:
                reader.join(timeout=2)
            if process.stdout is not None:
                process.stdout.close()
            if process.stderr is not None:
                process.stderr.close()
            with self._active_lock:
                self._active_process = None

        with output_lock:
            stdout = self._safe_text("".join(output["stdout"]))
            stderr = self._safe_text("".join(output["stderr"]))
        return ProcessResult(process.returncode, stdout, stderr, timed_out)

    def _safe_text(self, text: str) -> str:
        safe = text
        for name, value in os.environ.items():
            if value and re.search(r"PASS|SECRET|TOKEN|API.?KEY|CREDENTIAL|AUTH", name, re.I):
                safe = safe.replace(value, "[REDACTED]")
        safe = SECRET_ASSIGNMENT_PATTERN.sub(r"\1\2[REDACTED]", safe)
        return safe[-MAX_OUTPUT_CHARS:]

    @staticmethod
    def _file_snapshot(path: Path) -> dict[str, Any] | None:
        try:
            content = path.read_bytes()
            stat = path.stat()
        except OSError:
            return None
        return {
            "mtime_ns": stat.st_mtime_ns,
            "size": stat.st_size,
            "sha256": hashlib.sha256(content).hexdigest(),
        }

    def _verify_success(
        self, task: dict[str, Any], process: ProcessResult
    ) -> dict[str, Any]:
        task_type = task["task"]
        if task_type == "pitch":
            if (
                not process.result
                or not process.result.get("subject")
                or not process.result.get("body")
            ):
                raise TaskVerificationError("Pitch generation returned an invalid result.")
            return process.result

        if task_type == "send":
            sent_log = self._file_snapshot(self.root / SENT_LOG)
            if sent_log != self._sent_snapshots.get(task["id"]):
                raise TaskVerificationError("Dry-run unexpectedly changed the sent log.")
            if "DRY-RUN" not in process.stdout and "bhejne layak hain" not in process.stdout:
                raise TaskVerificationError("Sender output did not confirm dry-run behavior.")
            return {"dry_run": True}

        if task_type == "import":
            match = IMPORT_SUMMARY_PATTERN.search(process.stdout)
            if match is None:
                raise TaskVerificationError("Import script did not report its import totals.")
            added, updated = int(match.group(1)), int(match.group(2))
            leads = load_leads(self.root / FILE_NAME)
            records = [
                lead
                for lead in leads
                if isinstance(lead, dict) and (lead.get("name") or "").strip()
            ]
            unique_records: dict[tuple[str, str], dict[str, Any]] = {}
            for lead in records:
                key = (
                    (lead.get("name") or "").strip().casefold(),
                    (lead.get("city") or "Lahore").strip().casefold(),
                )
                unique_records[key] = lead
            if added + updated != len(records):
                raise TaskVerificationError(
                    "Import totals do not match the valid input records."
                )
            with database_connection(self.database_path) as db:
                check = db.execute("PRAGMA quick_check").fetchone()[0]
                if check != "ok":
                    raise TaskVerificationError("SQLite integrity check failed after import.")
                imported_count = db.execute(
                    "SELECT COUNT(*) FROM prospects WHERE is_demo = 0"
                ).fetchone()[0]
                for lead in unique_records.values():
                    name = (lead.get("name") or "").strip()[:120]
                    city = (lead.get("city") or "Lahore").strip()[:120]
                    row = db.execute(
                        "SELECT email, phone, website_url, lead_score FROM prospects "
                        "WHERE lower(name) = lower(?) AND lower(city) = lower(?) "
                        "AND is_demo = 0",
                        (name, city),
                    ).fetchone()
                    if row is None:
                        raise TaskVerificationError(
                            f"Imported prospect {name} is missing from SQLite."
                        )
                    expected = (
                        (lead.get("email") or "").strip().lower()[:254],
                        (lead.get("phone") or "").strip()[:40],
                        (lead.get("website") or "").strip()[:2048],
                        max(1, min(100, int(lead.get("score", 50)))),
                    )
                    if tuple(row) != expected:
                        raise TaskVerificationError(
                            f"Imported prospect {name} does not match the source data."
                        )
            if imported_count < self._import_counts.get(task["id"], 0) + added:
                raise TaskVerificationError(
                    "SQLite does not contain all records reported as newly imported."
                )
            return {
                "added": added,
                "updated": updated,
                "user_prospects": imported_count,
            }

        leads_path = self.root / FILE_NAME
        current = self._file_snapshot(leads_path)
        if current is None:
            raise TaskVerificationError("Expected leads output file was not created.")
        # An unchanged output is stale: a successful exit alone is insufficient.
        before = self._execution_snapshots.get(task["id"])
        if before is not None and before == current:
            raise TaskVerificationError("Leads output was not updated by this task.")
        if current["mtime_ns"] < self._execution_started_ns.get(task["id"], 0):
            raise TaskVerificationError("Leads output file is older than this execution.")
        leads = load_leads(leads_path)
        if not isinstance(leads, list) or any(not isinstance(lead, dict) for lead in leads):
            raise TaskVerificationError("Leads output is not a valid list of records.")
        if task_type == "score" and any(
            not isinstance(lead.get("score"), (int, float))
            or not 0 <= lead["score"] <= 100
            for lead in leads
        ):
            raise TaskVerificationError("Score output contains a missing or invalid score.")
        return {"lead_count": len(leads)}

    def _finish(
        self,
        task_id: str,
        status: str,
        *,
        exit_code: int | None = None,
        stdout: str = "",
        stderr: str = "",
        error: str | None = None,
        result: dict[str, Any] | None = None,
    ) -> None:
        safe_error = self._safe_text(error) if error else None
        safe_stdout = self._safe_text(stdout)
        safe_stderr = self._safe_text(stderr)
        now = utc_now()
        if status == "completed":
            event_type, message = "completed", "Task completed and its result was verified."
        elif status == "interrupted":
            event_type, message = "interrupted", safe_error or "Task was interrupted."
        else:
            event_type, message = "failed", safe_error or f"Task {status}."
        with database_connection(self.database_path) as db:
            db.execute(
                """
                UPDATE office_tasks SET status = ?, completed_at = ?, exit_code = ?,
                    stdout = ?, stderr = ?, error = ?, result_json = ?
                WHERE id = ?
                """,
                (
                    status,
                    now,
                    exit_code,
                    safe_stdout[-MAX_OUTPUT_CHARS:],
                    safe_stderr[-MAX_OUTPUT_CHARS:],
                    safe_error,
                    json.dumps(result, ensure_ascii=False) if result is not None else None,
                    task_id,
                ),
            )
            self._insert_event(
                db,
                task_id,
                event_type,
                message,
                {"status": status, "exit_code": exit_code},
            )
        with self._condition:
            self._condition.notify_all()
        self._execution_snapshots.pop(task_id, None)
        self._execution_started_ns.pop(task_id, None)
        self._sent_snapshots.pop(task_id, None)
        self._import_counts.pop(task_id, None)
