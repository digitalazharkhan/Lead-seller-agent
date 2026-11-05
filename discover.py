#!/usr/bin/env python3
"""OpenStreetMap se SIRF website-wale restaurants nikalo."""

import json
import time
import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "LeadSellerAgent/1.0 (educational project)"}
OUTPUT_FILE = "leads_restaurant_lahore.json"
CATEGORY = "restaurant"
CITY = "Lahore"

# Lahore ka box: (south, west, north, east)
QUERY = """
[out:json][timeout:90];
node["amenity"="restaurant"]["website"](31.35,74.20,31.65,74.45);
out body 150;
"""

def fetch():
    for attempt in range(4):
        print(f"🌐 Overpass se data maang raha hoon (koshish {attempt + 1}/4)...")
        try:
            response = requests.post(
                OVERPASS_URL, data={"data": QUERY}, headers=HEADERS, timeout=120
            )
            if response.status_code == 200:
                return response.json()
            print(f"   ⚠️ Status {response.status_code} — wait kar ke dobara...")
        except Exception as e:
            print(f"   ⚠️ Error: {e}")
        time.sleep(20)
    return None

def discover():
    data = fetch()
    if data is None:
        print("❌ Server abhi tak busy hai — 5 minute baad dobara chalao.")
        return

    leads = []
    for element in data.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name")
        website = (tags.get("website") or tags.get("contact:website") or "").strip()
        if not name or not website:
            continue
        leads.append({
            "name": name,
            "category": CATEGORY,   # email_writer aur import_leads ko chahiye
            "city": CITY,           # email_writer aur import_leads ko chahiye
            "website": website if website.startswith("http") else "https://" + website,
            "phone": tags.get("phone", tags.get("contact:phone", "")),
            "address": tags.get("addr:street", ""),
        })

    unique = {}
    for lead in leads:
        unique[lead["name"].lower()] = lead
    leads = list(unique.values())

    print(f"✅ {len(leads)} restaurants mili jinke paas website hai!")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as file:
        json.dump(leads, file, indent=2, ensure_ascii=False)

    for lead in leads[:10]:
        print(f"  🍽️  {lead['name']} — {lead['website']}")
    if len(leads) > 10:
        print(f"  ... aur {len(leads) - 10} baki!")

if __name__ == "__main__":
    discover()