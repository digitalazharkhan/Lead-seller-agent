#!/usr/bin/env python3
"""Score leads: best customers sab se upar."""

import json

def score_lead(lead):
    """Har lead ko 0-100 score do."""
    score = 40  # Base score: website nahi hai = pehle se interested

    # Phone hai? Contact karna asaan hai!
    if lead.get("phone"):
        score += 35

    # Email hai? Direct outreach possible!
    if lead.get("email"):
        score += 25

    # Name kaafi detailed hai? Asli business lagta hai
    if len(lead.get("name", "")) > 10:
        score += 5  # "Fort View Hotel & Restaurant" > "BFC"

    return min(score, 100)

def main():
    filename = "leads_restaurant_lahore.json"
    with open(filename, encoding="utf-8") as file:
        leads = json.load(file)

    print(f"Loaded {len(leads)} leads from {filename}\n")

    # Har lead ko score do
    for lead in leads:
        lead["score"] = score_lead(lead)

    # Best leads sab se upar (highest score pehle)
    leads.sort(key=lambda x: x["score"], reverse=True)

    # Scored leads wapas file mein save karo
    with open(filename, "w", encoding="utf-8") as file:
        json.dump(leads, file, indent=2, ensure_ascii=False)

    # Achi tarah dikhaao
    print(f"{'Score':<6} {'Name':<35} Phone")
    print("-" * 60)
    for lead in leads:
        phone = lead.get("phone", "-")
        print(f"{lead['score']:<6} {lead['name'][:34]:<35} {phone}")

    best = leads[0] if leads else None
    if best:
        print(f"\n🏆 BEST LEAD: {best['name']} (score: {best['score']})")

if __name__ == "__main__":
    main()
