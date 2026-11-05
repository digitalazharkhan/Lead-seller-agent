#!/usr/bin/env python3
"""Har lead ke liye personalized pitch email likho.

sender.py bhi build_email() yahin se istemal karta hai, taake preview aur
asal email hamesha ek jaisi hon.

Leads ke paas pehle se website hai (discover.py sirf website-wale nikalta
hai), is liye pitch "website upgrade" ki hai, "website nahi hai" ki nahi.
"""

import json
import os

LEADS_FILE = "leads_restaurant_lahore.json"


def sender_identity():
    """Apni pehchan environment variables se lo (code mein mat likho)."""
    return {
        "name": os.environ.get("SENDER_NAME", "[Your Name]"),
        "phone": os.environ.get("SENDER_PHONE", ""),
        "portfolio": os.environ.get("SENDER_PORTFOLIO", ""),
        "address": os.environ.get("SENDER_ADDRESS", ""),
    }


def build_email(lead):
    """Lead ki details se subject aur body banao. Missing fields se crash nahi."""
    name = (lead.get("name") or "there").strip()
    category = (lead.get("category") or "restaurant").strip()
    city = (lead.get("city") or "Lahore").strip()
    me = sender_identity()

    subject = f"Quick idea for the {name} website"

    signature = [me["name"]]
    if me["phone"]:
        signature.append(me["phone"])
    if me["portfolio"]:
        signature.append(me["portfolio"])
    if me["address"]:
        signature.append(me["address"])

    body = f"""Assalam-o-Alaikum {name} team,

I found {name}'s website while researching {category}s in {city}.

I help local restaurants improve their sites so more visitors become customers:
  1. A menu page that loads fast on mobile
  2. A WhatsApp order / booking button
  3. Better visibility when people search on Google

If it's useful, I can send a short demo of what an upgraded {name} page
could look like. No cost, no obligation. Just reply "YES".

If you'd rather not hear from me, reply STOP and I won't contact you again.

Best regards,
""" + "\n".join(signature) + "\n"

    return {"subject": subject, "body": body}


def main():
    with open(LEADS_FILE, encoding="utf-8") as file:
        leads = json.load(file)

    # Sirf top 3 leads ke emails banao (preview ke liye)
    top_leads = sorted(leads, key=lambda x: x.get("score", 0), reverse=True)[:3]

    print(f"Top {len(top_leads)} leads ke emails likh rahe hain...\n")

    all_emails = []
    for lead in top_leads:
        email = build_email(lead)
        all_emails.append({"lead": lead.get("name", ""), **email})

        print("=" * 60)
        print(f"TO:      {lead.get('name', '')}")
        print(f"SUBJECT: {email['subject']}")
        print("-" * 60)
        print(email["body"])

    with open("emails.json", "w", encoding="utf-8") as file:
        json.dump(all_emails, file, indent=2, ensure_ascii=False)
    print(f"✅ {len(all_emails)} emails saved to emails.json")


if __name__ == "__main__":
    main()