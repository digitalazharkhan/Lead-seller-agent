#!/usr/bin/env python3
"""Email sender — safe defaults.

- Default DRY-RUN: kuch bhejta nahi, sirf dikhata hai ke kya bhejta.
- Asal bhejne ke liye --send lagayein.
- sent_log.json mein yaad rakhta hai kis ko bhej chuka; dobara nahi bhejta.
- unsubscribed.txt wale emails/domains ko kabhi nahi bhejta.
- Daily --limit (default 20) aur har email ke beech delay.

Istemal:
    python3 sender.py                      # dry-run
    python3 sender.py --send --limit 10    # asal bhejna
    python3 sender.py --opt-out a@b.com    # kisi ko hamesha ke liye band karo
"""

import argparse
import json
import os
import smtplib
import sys
import time
from datetime import datetime, timezone
from email.mime.text import MIMEText

from email_writer import build_email

FILE_NAME = "leads_restaurant_lahore.json"
SENT_LOG = "sent_log.json"
OPT_OUT_FILE = "unsubscribed.txt"


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)


def load_leads(path=FILE_NAME):
    leads = load_json(path, [])
    if isinstance(leads, dict):
        for value in leads.values():
            if isinstance(value, list):
                return value
        return []
    return leads


def load_opt_outs(path=OPT_OUT_FILE):
    if not os.path.exists(path):
        return set()
    with open(path, encoding="utf-8") as file:
        return {line.strip().lower() for line in file if line.strip()}


def add_opt_out(address, path=OPT_OUT_FILE):
    address = address.strip().lower()
    if address not in load_opt_outs(path):
        with open(path, "a", encoding="utf-8") as file:
            file.write(address + "\n")


def is_opted_out(email, opt_outs):
    email = email.lower()
    domain = email.rsplit("@", 1)[-1]
    return email in opt_outs or domain in opt_outs or "@" + domain in opt_outs


def pick_targets(leads, sent, opt_outs):
    """(lead, email) ki list: email wale, pehle na bheje gaye, opt-out nahi, unique."""
    targets, seen = [], set()
    for lead in leads:
        email = (lead.get("email") or "").strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)
        if email in sent or is_opted_out(email, opt_outs):
            continue
        targets.append((lead, email))
    return targets


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--send", action="store_true", help="Asal mein bhejo (default: dry-run)")
    parser.add_argument("--limit", type=int, default=20, help="Ek run mein max emails (default 20)")
    parser.add_argument("--delay", type=float, default=30, help="Emails ke beech seconds (default 30)")
    parser.add_argument("--opt-out", metavar="EMAIL", help="Is email/domain ko hamesha ke liye band karo")
    args = parser.parse_args()

    if args.opt_out:
        add_opt_out(args.opt_out)
        print(f"🚫 {args.opt_out} ko unsubscribed list mein daal diya.")
        return

    leads = load_leads()
    sent = load_json(SENT_LOG, {})
    targets = pick_targets(leads, sent, load_opt_outs())
    batch = targets[: max(args.limit, 0)]

    print(f"📋 {len(targets)} leads bhejne layak hain; is run mein {len(batch)} (limit {args.limit}).")
    if not batch:
        return

    if not args.send:
        print("🧪 DRY-RUN — kuch bheja nahi ja raha. Asal ke liye --send lagayein.\n")
        for lead, to in batch:
            print(f"  would send → {lead.get('name', '?')} <{to}>")
        first = build_email(batch[0][0])
        print(f"\n--- Pehli email ka namoona ---\nSubject: {first['subject']}\n\n{first['body']}")
        return

    smtp_email = os.environ.get("SMTP_EMAIL")
    smtp_pass = os.environ.get("SMTP_PASS")
    missing = [k for k in ("SMTP_EMAIL", "SMTP_PASS", "SENDER_NAME")
               if not os.environ.get(k)]
    if missing:
        sys.exit("❌ Yeh environment variables set karein: " + ", ".join(missing))

    server = smtplib.SMTP("smtp.gmail.com", 587, timeout=30)
    server.starttls()
    server.login(smtp_email, smtp_pass)

    count, consecutive_errors = 0, 0
    for lead, to in batch:
        name = lead.get("name", "Restaurant")
        mail = build_email(lead)
        msg = MIMEText(mail["body"], "plain", "utf-8")
        msg["From"] = smtp_email
        msg["To"] = to
        msg["Subject"] = mail["subject"]
        msg["List-Unsubscribe"] = f"<mailto:{smtp_email}?subject=unsubscribe>"

        try:
            server.send_message(msg)
            count += 1
            consecutive_errors = 0
            sent[to] = {"name": name, "sent_at": datetime.now(timezone.utc).isoformat()}
            save_json(SENT_LOG, sent)  # har email ke baad save: crash par bhi safe
            print(f"  ✅ {name} → {to}")
        except Exception as error:
            consecutive_errors += 1
            print(f"  ❌ {name} → {to} | Error: {error}")
            if consecutive_errors >= 3:
                print("⛔ Lagatar 3 errors — rok raha hoon (Gmail limit ho sakti hai).")
                break
        time.sleep(args.delay)

    try:
        server.quit()
    except Exception:
        pass
    print(f"\n🎉 {count} emails bheje. Record: {SENT_LOG}")


if __name__ == "__main__":
    main()