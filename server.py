#!/usr/bin/env python3
"""Local SiteSeller app server and SQLite-backed prospect API."""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DEFAULT_DB_PATH = ROOT / "siteseller.sqlite3"
ALLOWED_STATUSES = {"new", "contacted", "replied", "opted-out", "client"}
MAX_REQUEST_BYTES = 16_384
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# These fictional entries keep the existing demo dashboard populated while
# making their sample status explicit in the API and database.
DEMO_PROSPECTS = (
    ("Juniper & Oak Coffee", "Coffee shop", "Portland, OR", "(503) 555-0134", "hello@juniperoak.example", 94, "new", 186),
    ("Wild Fern Floral", "Florist", "Portland, OR", "(503) 555-0182", "wildfern@example.com", 89, "new", 124),
    ("Form & Field Studio", "Yoga studio", "Portland, OR", "(503) 555-0168", "studio@formfield.example", 86, "contacted", 92),
    ("Sunday Loaf Bakery", "Bakery", "Portland, OR", "(503) 555-0109", "orders@sundayloaf.example", 83, "replied", 153),
    ("Goodside Barber Co.", "Barber shop", "Portland, OR", "(503) 555-0197", "hello@goodside.example", 81, "new", 78),
    ("Little Moss Plant Shop", "Plant shop", "Portland, OR", "(503) 555-0115", "hi@littlemoss.example", 78, "contacted", 64),
    ("The Corner Table", "Restaurant", "Portland, OR", "(503) 555-0144", "team@cornertable.example", 75, "new", 211),
    ("Brightside Pet Grooming", "Pet groomer", "Portland, OR", "(503) 555-0171", "hello@brightsidepets.example", 72, "new", 57),
    ("Rose City Bike Repair", "Bike shop", "Portland, OR", "(503) 555-0153", "ride@rosecitybikes.example", 69, "opted-out", 46),
    ("Marlow Skin Studio", "Beauty salon", "Portland, OR", "(503) 555-0191", "care@marlowskin.example", 67, "client", 83),
    ("Pine & Poppy Events", "Event planner", "Portland, OR", "(503) 555-0122", "hello@pinepoppy.example", 63, "new", 35),
    ("Alberta Street Ceramics", "Art studio", "Portland, OR", "(503) 555-0185", "studio@albertaceramics.example", 60, "contacted", 41),
)


class ValidationError(Exception):
    """A request contains invalid prospect data."""


def connect_database(database_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(database_path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 10000")
    return connection


def initialize_database(database_path: Path) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect_database(database_path)) as connection, connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS prospects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
                category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 80),
                city TEXT NOT NULL CHECK(length(trim(city)) BETWEEN 1 AND 120),
                phone TEXT NOT NULL DEFAULT '' CHECK(length(phone) <= 40),
                email TEXT NOT NULL DEFAULT '' CHECK(length(email) <= 254),
                website_url TEXT NOT NULL DEFAULT '' CHECK(length(website_url) <= 2048),
                has_website INTEGER CHECK(has_website IN (0, 1) OR has_website IS NULL),
                lead_score INTEGER NOT NULL DEFAULT 50 CHECK(lead_score BETWEEN 1 AND 100),
                status TEXT NOT NULL DEFAULT 'new'
                    CHECK(status IN ('new', 'contacted', 'replied', 'opted-out', 'client')),
                review_count INTEGER NOT NULL DEFAULT 0 CHECK(review_count >= 0),
                is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0, 1)),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS prospect_activity_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prospect_id INTEGER NOT NULL
                    REFERENCES prospects(id) ON DELETE CASCADE,
                event_type TEXT NOT NULL
                    CHECK(event_type IN ('created', 'status_changed', 'imported')),
                from_status TEXT,
                to_status TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS prospect_activity_events_prospect_idx "
            "ON prospect_activity_events(prospect_id, id DESC)"
        )
        existing_count = connection.execute(
            "SELECT COUNT(*) FROM prospects"
        ).fetchone()[0]
        if existing_count == 0:
            now = datetime.now(timezone.utc).isoformat()
            connection.executemany(
                """
                INSERT INTO prospects (
                    name, category, city, phone, email, has_website,
                    lead_score, status, review_count, is_demo, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 1, ?, ?)
                """,
                [
                    (*prospect, now, now)
                    for prospect in DEMO_PROSPECTS
                ],
            )


def record_prospect_activity(
    connection: sqlite3.Connection,
    prospect_id: int,
    event_type: str,
    *,
    from_status: str | None = None,
    to_status: str | None = None,
    created_at: str | None = None,
) -> None:
    if event_type not in {"created", "status_changed", "imported"}:
        raise ValueError("Unsupported prospect activity event.")
    connection.execute(
        """
        INSERT INTO prospect_activity_events
            (prospect_id, event_type, from_status, to_status, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            prospect_id,
            event_type,
            from_status,
            to_status,
            created_at or datetime.now(timezone.utc).isoformat(),
        ),
    )


def prospect_to_json(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "city": row["city"],
        "phone": row["phone"],
        "email": row["email"],
        "website": row["website_url"],
        "hasWebsite": None if row["has_website"] is None else bool(row["has_website"]),
        "score": row["lead_score"],
        "status": row["status"],
        "reviews": row["review_count"],
        "isDemo": bool(row["is_demo"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def require_text(
    payload: dict[str, Any], field: str, *, required: bool, max_length: int
) -> str:
    value = payload.get(field, "")
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be a string.")
    value = value.strip()
    if required and not value:
        raise ValidationError(f"{field} is required.")
    if len(value) > max_length:
        raise ValidationError(f"{field} must be at most {max_length} characters.")
    return value


def validate_prospect(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("Request body must be a JSON object.")

    prospect = {
        "name": require_text(payload, "name", required=True, max_length=120),
        "category": require_text(payload, "category", required=True, max_length=80),
        "city": require_text(payload, "city", required=True, max_length=120),
        "phone": require_text(payload, "phone", required=False, max_length=40),
        "email": require_text(payload, "email", required=False, max_length=254),
        "website_url": require_text(
            payload, "website_url", required=False, max_length=2048
        ),
    }
    if prospect["email"] and not EMAIL_PATTERN.fullmatch(prospect["email"]):
        raise ValidationError("email must be a valid email address.")
    prospect["has_website"] = (
        int(bool(prospect["website_url"])) if prospect["website_url"] else None
    )
    return prospect


class SiteSellerHandler(BaseHTTPRequestHandler):
    database_path = DEFAULT_DB_PATH
    web_root = ROOT

    def log_message(self, _format: str, *_args: Any) -> None:
        return

    def send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> Any:
        raw_length = self.headers.get("Content-Length")
        if raw_length is None:
            raise ValidationError("Content-Length header is required.")
        try:
            length = int(raw_length)
        except ValueError as error:
            raise ValidationError("Content-Length must be an integer.") from error
        if length < 0 or length > MAX_REQUEST_BYTES:
            raise ValidationError("Request body is too large.")
        try:
            return json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise ValidationError("Request body must be valid JSON.") from error

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/prospects":
            with closing(connect_database(self.database_path)) as connection, connection:
                rows = connection.execute(
                    "SELECT * FROM prospects ORDER BY lead_score DESC, id ASC"
                ).fetchall()
            self.send_json(200, [prospect_to_json(row) for row in rows])
            return
        activity_match = re.fullmatch(r"/api/prospects/([0-9]+)/activity", path)
        if activity_match:
            prospect_id = int(activity_match.group(1))
            with closing(connect_database(self.database_path)) as connection:
                exists = connection.execute(
                    "SELECT 1 FROM prospects WHERE id = ?", (prospect_id,)
                ).fetchone()
                if exists is None:
                    self.send_json(404, {"error": "Prospect not found."})
                    return
                rows = connection.execute(
                    "SELECT id, prospect_id, event_type, from_status, to_status, created_at "
                    "FROM prospect_activity_events WHERE prospect_id = ? "
                    "ORDER BY id DESC LIMIT 100",
                    (prospect_id,),
                ).fetchall()
            self.send_json(
                200,
                {
                    "activities": [
                        {
                            "id": row["id"],
                            "prospectId": row["prospect_id"],
                            "eventType": row["event_type"],
                            "fromStatus": row["from_status"],
                            "toStatus": row["to_status"],
                            "createdAt": row["created_at"],
                        }
                        for row in rows
                    ]
                },
            )
            return

        static_files = {
            "/": ("index.html", "text/html; charset=utf-8"),
            "/index.html": ("index.html", "text/html; charset=utf-8"),
            "/app.js": ("app.js", "text/javascript; charset=utf-8"),
            "/styles.css": ("styles.css", "text/css; charset=utf-8"),
        }
        static_file = static_files.get(path)
        if static_file is None:
            self.send_json(404, {"error": "Not found."})
            return
        file_path = self.web_root / static_file[0]
        try:
            body = file_path.read_bytes()
        except OSError:
            self.send_json(404, {"error": "File not found."})
            return
        self.send_response(200)
        self.send_header("Content-Type", static_file[1])
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if urlsplit(self.path).path != "/api/prospects":
            self.send_json(404, {"error": "Not found."})
            return
        try:
            prospect = validate_prospect(self.read_json())
        except ValidationError as error:
            self.send_json(400, {"error": str(error)})
            return

        now = datetime.now(timezone.utc).isoformat()
        with closing(connect_database(self.database_path)) as connection, connection:
            cursor = connection.execute(
                """
                INSERT INTO prospects (
                    name, category, city, phone, email, website_url, has_website,
                    lead_score, status, review_count, is_demo, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 50, 'new', 0, 0, ?, ?)
                """,
                (
                    prospect["name"],
                    prospect["category"],
                    prospect["city"],
                    prospect["phone"],
                    prospect["email"],
                    prospect["website_url"],
                    prospect["has_website"],
                    now,
                    now,
                ),
            )
            row = connection.execute(
                "SELECT * FROM prospects WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
            record_prospect_activity(
                connection,
                cursor.lastrowid,
                "created",
                to_status="new",
                created_at=now,
            )
        self.send_json(201, prospect_to_json(row))

    def do_PATCH(self) -> None:
        match = re.fullmatch(r"/api/prospects/([0-9]+)/status", urlsplit(self.path).path)
        if match is None:
            self.send_json(404, {"error": "Not found."})
            return
        try:
            payload = self.read_json()
            if not isinstance(payload, dict):
                raise ValidationError("Request body must be a JSON object.")
            status = payload.get("status")
            if not isinstance(status, str) or status not in ALLOWED_STATUSES:
                raise ValidationError(
                    f"status must be one of: {', '.join(sorted(ALLOWED_STATUSES))}."
                )
        except ValidationError as error:
            self.send_json(400, {"error": str(error)})
            return

        prospect_id = int(match.group(1))
        now = datetime.now(timezone.utc).isoformat()
        with closing(connect_database(self.database_path)) as connection, connection:
            previous = connection.execute(
                "SELECT status FROM prospects WHERE id = ?", (prospect_id,)
            ).fetchone()
            if previous is not None:
                connection.execute(
                    "UPDATE prospects SET status = ?, updated_at = ? WHERE id = ?",
                    (status, now, prospect_id),
                )
                if previous["status"] != status:
                    record_prospect_activity(
                        connection,
                        prospect_id,
                        "status_changed",
                        from_status=previous["status"],
                        to_status=status,
                        created_at=now,
                    )
            row = connection.execute(
                "SELECT * FROM prospects WHERE id = ?", (prospect_id,)
            ).fetchone()
        if row is None:
            self.send_json(404, {"error": "Prospect not found."})
            return
        self.send_json(200, prospect_to_json(row))


def make_handler(database_path: Path, web_root: Path = ROOT) -> type[SiteSellerHandler]:
    return type(
        "ConfiguredSiteSellerHandler",
        (SiteSellerHandler,),
        {"database_path": database_path, "web_root": web_root},
    )


def create_server(
    host: str = "127.0.0.1",
    port: int = 8000,
    database_path: Path = DEFAULT_DB_PATH,
    web_root: Path = ROOT,
) -> ThreadingHTTPServer:
    initialize_database(database_path)
    return ThreadingHTTPServer((host, port), make_handler(database_path, web_root))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default: localhost)")
    parser.add_argument("--port", type=int, default=8000, help="HTTP port (default: 8000)")
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"SQLite database path (default: {DEFAULT_DB_PATH})",
    )
    args = parser.parse_args()
    server = create_server(args.host, args.port, args.db)
    print(f"SiteSeller running at http://{args.host}:{args.port}")
    print(f"SQLite database: {args.db.resolve()}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping SiteSeller.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
