#!/usr/bin/env python3
"""Websites se email addresses dhoondo."""

import json
import re
import requests

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)"}
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
FILE_NAME = "leads_restaurant_lahore.json"

def get_field(lead, *names):
    """Kisi bhi possible naam se value nikalo."""
    for name in names:
        if name in lead:
            return lead[name]
    return None

def hunt_emails():
    with open(FILE_NAME, encoding="utf-8") as file:
        leads = json.load(file)

    # Agar file mein seedha list nahi, kisi key ke andar hai
    if isinstance(leads, dict):
        for value in leads.values():
            if isinstance(value, list):
                leads = value
                break

    found_count = 0
    for lead in leads:
        name = get_field(lead, "name", "restaurant", "title") or "Unknown"
        website = get_field(lead, "website", "Website", "url", "www")

        if not website:
            print(f"🔍 {name}: website nahi hai — skip.")
            continue

        if not website.startswith("http"):
            website = "https://" + website

        print(f"🔍 {name} ki website scan kar raha hoon: {website}")
        emails_found = set()

        pages_to_try = [website]
        for path in ["contact", "contact-us", "about", "about-us"]:
            pages_to_try.append(website.rstrip("/") + "/" + path)

        for page in pages_to_try:
            try:
                response = requests.get(page, headers=HEADERS, timeout=10)
                if response.status_code == 200:
                    emails = EMAIL_PATTERN.findall(response.text)
                    for email in emails:
                        bad_words = ["example", "your-email", "email.com", "domain.com", "sentry", "wixpress"]
                        if not any(bad in email.lower() for bad in bad_words):
                            emails_found.add(email.lower())
            except Exception:
                pass

        if emails_found:
            lead["email"] = sorted(emails_found)[0]
            lead["all_emails"] = sorted(emails_found)
            found_count += 1
            print(f"   ✅ Mili: {', '.join(sorted(emails_found))}")
        else:
            print("   ❌ Koi email nahi mili.")

    with open(FILE_NAME, "w", encoding="utf-8") as file:
        json.dump(leads, file, indent=2, ensure_ascii=False)

    print(f"\n🎉 {found_count} leads ke emails mile! {FILE_NAME} update ho gaya.")

if __name__ == "__main__":
    hunt_emails()
