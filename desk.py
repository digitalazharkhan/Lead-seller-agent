#!/usr/bin/env python3
"""AI Khan leads desk: server.py ke upar asal leads, pipeline buttons aur download.

    python3 desk.py            # phir http://127.0.0.1:8000 kholein

server.py ki sab API (/api/prospects ...) waisi hi rehti hain. Yeh sirf naye
routes jodta hai. 'send' step yahan se HAMESHA dry-run hai; asal email sirf
terminal se jati hai: python3 sender.py --send
"""

import argparse
import json
import os
import re
import sqlite3
import sys
from contextlib import closing
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import server as base
from email_writer import build_email
from office_tasks import (
    TASK_LIMIT,
    TaskQueueBusy,
    TaskRunner,
    TaskValidationError,
    validate_task_id,
    validate_task_request,
)
from sender import (FILE_NAME, SENT_LOG, add_opt_out, is_opted_out,
                    load_json, load_leads, load_opt_outs)

ROOT = base.ROOT
# step -> (script, timeout seconds). 'send' = sender.py bina --send, yaani dry-run.
SCRIPTS = {
    "discover": ("discover.py", 900),
    "emails": ("email_hunter.py", 1200),
    "score": ("score.py", 60),
    "send": ("sender.py", 60),
}
TASK_ID_ROUTE = re.compile(r"^/api/office/tasks/([0-9a-f]{32})(?:/(events))?$")
MAX_PITCH_SUBJECT_LENGTH = 500
MAX_PITCH_BODY_LENGTH = 12_000


def lead_view(lead: dict, sent: dict, opt_outs: set) -> dict:
    email = (lead.get("email") or "").strip().lower()
    if email and is_opted_out(email, opt_outs):
        status = "opted-out"
    elif email and email in sent:
        status = "contacted"
    elif email:
        status = "ready"
    else:
        status = "new"
    return {
        "name": lead.get("name", ""),
        "email": email,
        "all_emails": lead.get("all_emails", []),
        "phone": lead.get("phone", ""),
        "website": lead.get("website", ""),
        "address": lead.get("address", ""),
        "score": lead.get("score"),
        "status": status,
        "sent_at": (sent.get(email) or {}).get("sent_at", ""),
    }


def all_leads() -> list:
    sent = load_json(SENT_LOG, {})
    opt = load_opt_outs()
    return [lead_view(l, sent, opt) for l in load_leads()]


def lead_key(name: str) -> str:
    return " ".join(name.split()).casefold()


def pitch_draft_to_json(row: sqlite3.Row, *, saved: bool = True) -> dict:
    return {
        "id": row["id"],
        "lead_name": row["lead_name"],
        "email": row["email"],
        "subject": row["subject"],
        "body": row["body"],
        "source_task_id": row["source_task_id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "saved": saved,
    }


class DeskHandler(base.SiteSellerHandler):
    task_runner: TaskRunner | None = None

    def send_file(self, name: str, content_type: str) -> None:
        try:
            body = (self.web_root / name).read_bytes()
        except OSError:
            self.send_json(404, {"error": f"{name} nahi mili."})
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        url = urlsplit(self.path)
        if url.path in ("/", "/index.html", "/desk"):
            self.send_file("desk.html", "text/html; charset=utf-8")
        elif url.path == "/api/leads":
            self.send_json(200, {"leads": all_leads()})
        elif url.path == "/api/pitch":
            name = (parse_qs(url.query).get("name") or [""])[0].strip().lower()
            sent = load_json(SENT_LOG, {})
            leads = load_leads()
            lead = next((l for l in leads if (l.get("name") or "").lower() == name), None)
            if lead is None:
                lead = next((l for l in leads if l.get("email") and l["email"].lower() not in sent),
                            leads[0] if leads else None)
            if lead is None:
                self.send_json(404, {"error": "Koi lead nahi. Pehle discover chalayein."})
                return
            self.send_json(200, {"name": lead.get("name", ""), **build_email(lead)})
        elif url.path == "/api/office/drafts":
            self.get_pitch_draft(url.query)
        elif url.path == "/api/office/tasks":
            self.list_office_tasks(url.query)
        elif url.path == "/api/office/events":
            self.stream_office_events(url.query)
        else:
            match = TASK_ID_ROUTE.fullmatch(url.path)
            if match is None:
                super().do_GET()
                return
            task_id, events_path = match.groups()
            if events_path:
                self.list_task_events(task_id, url.query)
            else:
                self.get_office_task(task_id)

    def get_pitch_draft(self, query: str) -> None:
        runner = self.task_runner
        if runner is None:
            self.send_json(503, {"error": "Office task engine is unavailable."})
            return
        params = parse_qs(query)
        name = (params.get("lead_name") or [""])[0].strip()
        source_task_id = (params.get("source_task_id") or [None])[0]
        if not name or len(name) > 120:
            self.send_json(400, {"error": "lead_name must contain 1 to 120 characters."})
            return
        if source_task_id is not None:
            if not validate_task_id(source_task_id):
                self.send_json(400, {"error": "Invalid source task id."})
                return
            try:
                task = runner.get_task(source_task_id)
            except sqlite3.Error:
                self.send_json(500, {"error": "Could not read the pitch task."})
                return
            result = task.get("result") if task else None
            if (
                task is None
                or task["task"] != "pitch"
                or task["status"] != "completed"
                or not isinstance(result, dict)
                or lead_key(str(result.get("name", ""))) != lead_key(name)
            ):
                self.send_json(400, {"error": "Source task does not match a completed pitch."})
                return

        try:
            with closing(base.connect_database(self.database_path)) as db:
                row = db.execute(
                    "SELECT * FROM office_pitch_drafts WHERE lead_key = ?",
                    (lead_key(name),),
                ).fetchone()
        except sqlite3.Error:
            self.send_json(500, {"error": "Could not read the saved pitch draft."})
            return
        if row is not None:
            self.send_json(200, {"draft": pitch_draft_to_json(row)})
            return
        if source_task_id is not None:
            self.send_json(200, {"draft": None})
            return

        try:
            lead = next(
                (
                    item
                    for item in load_leads(runner.root / FILE_NAME)
                    if lead_key(str(item.get("name") or "")) == lead_key(name)
                ),
                None,
            )
        except (OSError, ValueError):
            self.send_json(500, {"error": "Could not generate the lead pitch preview."})
            return
        if lead is None:
            self.send_json(200, {"draft": None})
            return
        self.send_json(
            200,
            {
                "draft": {
                    "id": None,
                    "lead_name": lead.get("name", name),
                    "email": (lead.get("email") or "").strip().lower(),
                    **build_email(lead),
                    "source_task_id": None,
                    "created_at": None,
                    "updated_at": None,
                    "saved": False,
                }
            },
        )

    def save_pitch_draft(self) -> None:
        try:
            payload = self.read_json()
            if not isinstance(payload, dict):
                raise base.ValidationError("Request body must be a JSON object.")
            if set(payload) - {"lead_name", "email", "subject", "body", "source_task_id"}:
                raise base.ValidationError("Request contains unsupported fields.")
            name = payload.get("lead_name")
            email = payload.get("email", "")
            subject = payload.get("subject")
            body = payload.get("body")
            source_task_id = payload.get("source_task_id")
            if not isinstance(name, str) or not 1 <= len(name.strip()) <= 120:
                raise base.ValidationError("lead_name must contain 1 to 120 characters.")
            name = name.strip()
            if not isinstance(email, str) or len(email.strip()) > 254:
                raise base.ValidationError("email must be at most 254 characters.")
            email = email.strip().lower()
            if email and not base.EMAIL_PATTERN.fullmatch(email):
                raise base.ValidationError("email must be a valid email address.")
            if not isinstance(subject, str) or not 1 <= len(subject.strip()) <= MAX_PITCH_SUBJECT_LENGTH:
                raise base.ValidationError(
                    f"subject must contain 1 to {MAX_PITCH_SUBJECT_LENGTH} characters."
                )
            if (
                not isinstance(body, str)
                or not body.strip()
                or len(body) > MAX_PITCH_BODY_LENGTH
            ):
                raise base.ValidationError(
                    f"body must contain 1 to {MAX_PITCH_BODY_LENGTH} characters."
                )
            if source_task_id is not None and (
                not isinstance(source_task_id, str)
                or not validate_task_id(source_task_id)
            ):
                raise base.ValidationError("source_task_id must be a valid pitch task id.")
        except base.ValidationError as error:
            self.send_json(400, {"error": str(error)})
            return

        runner = self.task_runner
        if runner is None:
            self.send_json(503, {"error": "Office task engine is unavailable."})
            return
        if source_task_id is not None:
            try:
                task = runner.get_task(source_task_id)
            except sqlite3.Error:
                self.send_json(500, {"error": "Could not validate the pitch task."})
                return
            result = task.get("result") if task else None
            if (
                task is None
                or task["task"] != "pitch"
                or task["status"] != "completed"
                or not isinstance(result, dict)
                or lead_key(str(result.get("name", ""))) != lead_key(name)
            ):
                self.send_json(400, {"error": "Source task does not match a completed pitch."})
                return

        now = datetime.now(timezone.utc).isoformat()
        try:
            with closing(base.connect_database(self.database_path)) as db, db:
                db.execute(
                    """
                    INSERT INTO office_pitch_drafts
                        (lead_key, lead_name, email, subject, body, source_task_id,
                         created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(lead_key) DO UPDATE SET
                        lead_name = excluded.lead_name,
                        email = CASE
                            WHEN excluded.email = '' THEN office_pitch_drafts.email
                            ELSE excluded.email
                        END,
                        subject = excluded.subject,
                        body = excluded.body,
                        source_task_id = COALESCE(
                            excluded.source_task_id, office_pitch_drafts.source_task_id
                        ),
                        updated_at = excluded.updated_at
                    """,
                    (
                        lead_key(name),
                        name,
                        email,
                        subject.strip(),
                        body,
                        source_task_id,
                        now,
                        now,
                    ),
                )
                row = db.execute(
                    "SELECT * FROM office_pitch_drafts WHERE lead_key = ?",
                    (lead_key(name),),
                ).fetchone()
        except sqlite3.Error:
            self.send_json(500, {"error": "Could not save the pitch draft."})
            return
        self.send_json(200, {"draft": pitch_draft_to_json(row)})

    def list_office_tasks(self, query: str) -> None:
        runner = self.task_runner
        if runner is None:
            self.send_json(503, {"error": "Office task engine is unavailable."})
            return
        params = parse_qs(query)
        try:
            limit_value = (params.get("limit") or ["50"])[0]
            limit = int(limit_value)
            if not 1 <= limit <= TASK_LIMIT:
                raise ValueError
            tasks = runner.list_tasks(limit)
        except ValueError:
            self.send_json(400, {"error": f"limit must be between 1 and {TASK_LIMIT}."})
            return
        except sqlite3.Error:
            self.send_json(500, {"error": "Could not read office task history."})
            return
        self.send_json(200, {"tasks": tasks})

    def get_office_task(self, task_id: str) -> None:
        runner = self.task_runner
        if runner is None:
            self.send_json(503, {"error": "Office task engine is unavailable."})
            return
        if not validate_task_id(task_id):
            self.send_json(400, {"error": "Invalid task id."})
            return
        try:
            task = runner.get_task(task_id)
        except sqlite3.Error:
            self.send_json(500, {"error": "Could not read office task."})
            return
        if task is None:
            self.send_json(404, {"error": "Office task not found."})
            return
        self.send_json(200, {"task": task})

    def list_task_events(self, task_id: str, query: str) -> None:
        runner = self.task_runner
        if runner is None:
            self.send_json(503, {"error": "Office task engine is unavailable."})
            return
        if not validate_task_id(task_id):
            self.send_json(400, {"error": "Invalid task id."})
            return
        params = parse_qs(query)
        try:
            after_id = int((params.get("after") or ["0"])[0])
            if after_id < 0:
                raise ValueError
        except ValueError:
            self.send_json(400, {"error": "after must be a non-negative event id."})
            return
        try:
            if runner.get_task(task_id) is None:
                self.send_json(404, {"error": "Office task not found."})
                return
            events = runner.get_events(task_id=task_id, after_id=after_id)
        except sqlite3.Error:
            self.send_json(500, {"error": "Could not read office task events."})
            return
        self.send_json(200, {"events": events})

    def stream_office_events(self, query: str) -> None:
        runner = self.task_runner
        if runner is None:
            self.send_json(503, {"error": "Office task engine is unavailable."})
            return
        params = parse_qs(query)
        try:
            after_id = int(
                (params.get("after") or [self.headers.get("Last-Event-ID", "0")])[0]
            )
            if after_id < 0:
                raise ValueError
        except ValueError:
            self.send_json(400, {"error": "after must be a non-negative event id."})
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        try:
            while True:
                events = runner.wait_for_events(after_id, timeout=10)
                if not events:
                    self.wfile.write(b": keep-alive\n\n")
                    self.wfile.flush()
                    continue
                for event in events:
                    data = json.dumps(event, ensure_ascii=False)
                    frame = (
                        f"id: {event['id']}\nevent: task\ndata: {data}\n\n"
                    ).encode("utf-8")
                    self.wfile.write(frame)
                    self.wfile.flush()
                    after_id = event["id"]
        except sqlite3.Error:
            frame = 'event: error\ndata: {"error":"Office event stream is unavailable."}\n\n'
            try:
                self.wfile.write(frame.encode("utf-8"))
                self.wfile.flush()
            except OSError:
                return
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            return
        except OSError:
            return

    def do_POST(self) -> None:
        path = urlsplit(self.path).path
        is_office_submission = path == "/api/office/tasks"
        is_pitch_draft_save = path == "/api/office/drafts"
        if not (
            path.startswith("/api/run/")
            or path == "/api/optout"
            or is_office_submission
            or is_pitch_draft_save
        ):
            super().do_POST()
            return
        # This marker is a same-origin/CSRF guard only, not authentication.
        if self.headers.get("X-Desk") != "1":
            self.send_json(403, {"error": "Forbidden."})
            return
        if is_office_submission:
            self.submit_office_task()
            return
        if is_pitch_draft_save:
            self.save_pitch_draft()
            return
        if path == "/api/optout":
            try:
                payload = self.read_json()
                email = str(payload.get("email", "")).strip().lower()
                if not base.EMAIL_PATTERN.fullmatch(email):
                    raise base.ValidationError("email must be a valid email address.")
            except base.ValidationError as error:
                self.send_json(400, {"error": str(error)})
                return
            add_opt_out(email)
            self.send_json(200, {"ok": True})
            return

        step = path.rsplit("/", 1)[1]
        if step not in SCRIPTS:
            self.send_json(404, {"error": "Unknown step."})
            return
        runner = self.task_runner
        if runner is None:
            self.send_json(503, {"error": "Office task engine is unavailable."})
            return
        try:
            task = runner.submit(step, reject_if_busy=True)
        except TaskQueueBusy:
            self.send_json(409, {"error": "Ek aur step chal raha hai. Khatam hone dein."})
            return
        except sqlite3.Error:
            self.send_json(500, {"error": "Could not queue the requested step."})
            return
        timeout = SCRIPTS[step][1] + 30
        try:
            completed = runner.wait_for_task(task["id"], timeout)
        except sqlite3.Error:
            self.send_json(500, {"error": "Could not read the requested step result."})
            return
        if completed is None:
            self.send_json(500, {"error": "Requested task disappeared from history."})
        elif completed["status"] == "timed_out":
            self.send_json(504, {"error": completed["error"], "tail": completed["stderr"][-600:]})
        elif completed["status"] == "completed":
            self.send_json(
                200,
                {"ok": True, "tail": (completed["stdout"] + completed["stderr"])[-600:]},
            )
        elif completed["status"] == "interrupted":
            self.send_json(503, {"error": completed["error"]})
        else:
            tail = (completed["stderr"] + completed["stdout"])[-600:]
            self.send_json(500, {"error": tail or completed["error"] or "Step failed."})

    def submit_office_task(self) -> None:
        runner = self.task_runner
        if runner is None:
            self.send_json(503, {"error": "Office task engine is unavailable."})
            return
        try:
            payload = self.read_json()
            task_type, lead_name = validate_task_request(payload)
        except base.ValidationError as error:
            self.send_json(400, {"error": str(error)})
            return
        except TaskValidationError as error:
            self.send_json(400, {"error": str(error)})
            return
        try:
            task = runner.submit(task_type, lead_name)
        except sqlite3.Error:
            self.send_json(500, {"error": "Could not queue office task."})
            return
        self.send_json(202, {"task": task})


def create_server(
    host: str = "127.0.0.1",
    port: int = 8000,
    database_path: Path = base.DEFAULT_DB_PATH,
    web_root: Path = ROOT,
    task_root: Path = ROOT,
) -> ThreadingHTTPServer:
    if host not in ("127.0.0.1", "localhost"):
        raise ValueError("The office task server must bind to localhost.")
    base.initialize_database(database_path)
    runner = TaskRunner(database_path, root=task_root)
    runner.start()
    handler = type(
        "ConfiguredDeskHandler",
        (DeskHandler,),
        {"database_path": database_path, "web_root": web_root, "task_runner": runner},
    )
    try:
        httpd = ThreadingHTTPServer((host, port), handler)
    except Exception:
        runner.shutdown()
        raise
    httpd.task_runner = runner
    return httpd


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", type=Path, default=base.DEFAULT_DB_PATH)
    args = parser.parse_args()
    os.chdir(ROOT)
    try:
        httpd = create_server(args.host, args.port, args.db)
    except ValueError as error:
        sys.exit(str(error))
    print(f"AI Khan desk: http://{args.host}:{args.port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nBand.")
    finally:
        httpd.server_close()
        httpd.task_runner.shutdown()


if __name__ == "__main__":
    main()