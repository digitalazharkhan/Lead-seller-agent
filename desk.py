#!/usr/bin/env python3
"""AI Khan leads desk: server.py ke upar asal leads, pipeline buttons aur download.

    python3 desk.py            # phir http://127.0.0.1:8000 kholein

server.py ki sab API (/api/prospects ...) waisi hi rehti hain. Yeh sirf naye
routes jodta hai. 'send' step yahan se HAMESHA dry-run hai; asal email sirf
terminal se jati hai: python3 sender.py --send
"""

import argparse
import os
import shutil
import subprocess
import sys
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import server as base
from email_writer import build_email
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
run_lock = threading.Lock()


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


class DeskHandler(base.SiteSellerHandler):
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
        else:
            super().do_GET()

    def do_POST(self) -> None:
        path = urlsplit(self.path).path
        if not (path.startswith("/api/run/") or path == "/api/optout"):
            super().do_POST()
            return
        # Kisi aur website ka page localhost par POST na kar sake (CSRF se bachao).
        if self.headers.get("X-Desk") != "1":
            self.send_json(403, {"error": "Forbidden."})
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
        if not run_lock.acquire(blocking=False):
            self.send_json(409, {"error": "Ek aur step chal raha hai. Khatam hone dein."})
            return
        try:
            script, timeout = SCRIPTS[step]
            leads_file = ROOT / FILE_NAME
            if step == "discover" and leads_file.exists():
                shutil.copy(leads_file, ROOT / "backup_leads.json")
            env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
            try:
                proc = subprocess.run([sys.executable, script], cwd=ROOT, env=env,
                                      capture_output=True, text=True, timeout=timeout)
            except subprocess.TimeoutExpired:
                self.send_json(504, {"error": f"{script} {timeout}s mein khatam nahi hua."})
                return
            tail = (proc.stdout + proc.stderr)[-600:]
            if proc.returncode != 0:
                self.send_json(500, {"error": tail or f"{script} fail hua."})
                return
            self.send_json(200, {"ok": True, "tail": tail})
        finally:
            run_lock.release()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", type=Path, default=base.DEFAULT_DB_PATH)
    parser.add_argument("--allow-remote", action="store_true",
                        help="Localhost ke ilawa bind karo (login nahi hai, khatarnak)")
    args = parser.parse_args()
    if args.host not in ("127.0.0.1", "localhost") and not args.allow_remote:
        sys.exit("❌ Is server mein login nahi hai aur yeh scripts chalata hai; "
                 "sirf 127.0.0.1 par chalayein.")
    os.chdir(ROOT)
    base.initialize_database(args.db)
    handler = type("ConfiguredDeskHandler", (DeskHandler,),
                   {"database_path": args.db, "web_root": ROOT})
    httpd = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"AI Khan desk: http://{args.host}:{args.port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nBand.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()