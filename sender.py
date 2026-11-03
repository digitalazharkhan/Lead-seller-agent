#!/usr/bin/env python3
"""Automatic email sender — leads file se emails utha ke bhejta hai."""

import json
import smtplib
import time
import os
from email.mime.text import MIMEText

FILE_NAME = "leads_restaurant_lahore.json"

# Gmail App Password
SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "apna-email@gmail.com")
SMTP_PASS = os.environ.get("SMTP_PASS", "apna-16-digit-app-password")

def make_email(name):
    return f"""Subject: Free Website Upgrade for {name} — 2 Min Trial

Hello {name} team!

I noticed your website and I help restaurants get more customers online — 
faster menu pages, WhatsApp ordering button, Google ranking.

Reply "YES" and I will send a FREE 2-minute demo video of your upgraded site.

— Azhar
Digital Marketing
"""

def send_all():
    with open(FILE_NAME, encoding="utf-8") as file:
        leads = json.load(file)

    # Sirf woh leads jinke paas email hai
    targets = [lead for lead in leads if lead.get("email")]
    print(f"📧 {len(targets)} leads ke paas email hai — bhej raha hoon!\n")

    server = smtplib.SMTP("smtp.gmail.com", 587)
    server.starttls()
    server.login(SMTP_EMAIL, SMTP_PASS)

    sent = 0
    for lead in targets:
        name = lead.get("name", "Restaurant")
        to = lead["email"]
        msg = MIMEText(make_email(name), "plain", "utf-8")
        msg["From"] = SMTP_EMAIL
        msg["To"] = to
        msg["Subject"] = f"Free Website Upgrade for {name}"

        try:
            server.send_message(msg)
            sent += 1
            print(f"  ✅ {name} → {to}")
        except Exception as e:
            print(f"  ❌ {name} → {to} | Error: {e}")

        time.sleep(5)  # Spam se bachne ke liye gap

    server.quit()
    print(f"\n🎉 {sent} emails bhej diye gaye!")

if __name__ == "__main__":
    send_all()
