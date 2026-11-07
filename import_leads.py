#!/usr/bin/env python3
"""Pipeline ki leads (JSON) ko dashboard ke SQLite database mein daalo.

    python3 import_leads.py                 # leads import karo
    python3 import_leads.py --purge-demo    # pehle Portland ke fake DEMO records hatao

Duplicate (naam + shehar) dobara nahi banta; mojooda ka email/phone/score
update hota hai. sent_log.json mein jinhein bheja ja chuka unka status
'contacted', aur unsubscribed.txt walon ka 'opted-out' ho jata hai.
"""

import argparse
import json
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from sender import SENT_LOG, FILE_NAME, is_opted_out, load_json, load_leads, load_opt_outs
from server import (
    DEFAULT_DB_PATH,
    connect_database,
    initialize_database,
    record_prospect_activity,
)


def import_leads(db_path=DEFAULT_DB_PATH, leads_file=FILE_NAME,
                 sent_log=SENT_LOG, purge_demo=False):
    leads = load_leads(leads_file)
    sent = load_json(sent_log, {})
    opt_outs = load_opt_outs()
    initialize_database(Path(db_path))
    now = datetime.now(timezone.utc).isoformat()
    added = updated = 0

    with closing(connect_database(Path(db_path))) as db, db:
        if purge_demo:
            db.execute("DELETE FROM prospects WHERE is_demo = 1")

        for lead in leads:
            name = (lead.get("name") or "").strip()
            if not name:
                continue
            category = (lead.get("category") or "restaurant").strip()[:80]
            city = (lead.get("city") or "Lahore").strip()[:120]
            email = (lead.get("email") or "").strip().lower()[:254]
            phone = (lead.get("phone") or "").strip()[:40]
            website = (lead.get("website") or "").strip()[:2048]
            score = max(1, min(100, int(lead.get("score", 50))))
            status = "new"
            if email and is_opted_out(email, opt_outs):
                status = "opted-out"
            elif email and email in sent:
                status = "contacted"

            row = db.execute(
                "SELECT id, status FROM prospects "
                "WHERE lower(name) = lower(?) AND lower(city) = lower(?) AND is_demo = 0",
                (name, city),
            ).fetchone()
            if row is None:
                cursor = db.execute(
                    """INSERT INTO prospects (name, category, city, phone, email,
                       website_url, has_website, lead_score, status, review_count,
                       is_demo, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)""",
                    (name[:120], category, city, phone, email, website,
                     1 if website else None, score, status, now, now),
                )
                record_prospect_activity(
                    db,
                    cursor.lastrowid,
                    "imported",
                    to_status=status,
                    created_at=now,
                )
                added += 1
            else:
                # Dashboard mein haath se badla hua status na mitao: sirf 'new' ko aage badhao
                new_status = status if row["status"] == "new" else row["status"]
                db.execute(
                    "UPDATE prospects SET email = ?, phone = ?, website_url = ?, "
                    "lead_score = ?, status = ?, updated_at = ? WHERE id = ?",
                    (email, phone, website, score, new_status, now, row["id"]),
                )
                record_prospect_activity(
                    db,
                    row["id"],
                    "imported",
                    to_status=new_status,
                    created_at=now,
                )
                if row["status"] != new_status:
                    record_prospect_activity(
                        db,
                        row["id"],
                        "status_changed",
                        from_status=row["status"],
                        to_status=new_status,
                        created_at=now,
                    )
                updated += 1

    print(f"✅ {added} nayi leads, {updated} update. Database: {Path(db_path).resolve()}")
    return added, updated


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--purge-demo", action="store_true", help="Fake DEMO records hata do")
    args = parser.parse_args()
    import_leads(args.db, purge_demo=args.purge_demo)