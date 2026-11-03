#!/usr/bin/env python3
"""Har lead ke liye personalized pitch email likho."""

import json

def write_email(lead):
    """Lead ki details se personalized email banao."""
    name = lead["name"]
    city = lead["city"].capitalize()
    category = lead["category"]

    subject = f"{name} — a website could bring you more customers"

    body = f"""Assalam-o-Alaikum {name} team,

I came across {name} on OpenStreetMap — one of the notable {category} spots in {city}!

I noticed you don't have a website yet. In 2025, most customers check online before visiting a restaurant — menus, timings, photos, reviews.

A simple, professional website can help you:
  1. Appear on Google when people search "{category} in {city}"
  2. Show your menu and photos 24/7
  3. Take orders/bookings directly

I build affordable websites for local businesses. Would you be open to a quick 10-minute chat this week?

Best regards,
[Your Name]
[Your Phone]
[Your Portfolio Link]"""

    return {"subject": subject, "body": body}

def main():
    filename = "leads_restaurant_lahore.json"
    with open(filename, encoding="utf-8") as file:
        leads = json.load(file)

    # Sirf top 3 leads ke emails banao (test ke liye)
    top_leads = sorted(leads, key=lambda x: x.get("score", 0), reverse=True)[:3]

    print(f"Top {len(top_leads)} leads ke emails likh rahe hain...\n")

    all_emails = []
    for lead in top_leads:
        email = write_email(lead)
        all_emails.append({"lead": lead["name"], **email})

        print("=" * 60)
        print(f"TO:      {lead['name']}")
        print(f"SUBJECT: {email['subject']}")
        print("-" * 60)
        print(email["body"])
        print()

    with open("emails.json", "w", encoding="utf-8") as file:
        json.dump(all_emails, file, indent=2, ensure_ascii=False)
    print(f"✅ {len(all_emails)} emails saved to emails.json")

if __name__ == "__main__":
    main()
