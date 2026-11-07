---
applyTo: "app/office/**"
---

# AI Khan office guidance

- The office has a desk area and a lounge area. Each of the eight characters has a personal desk.
- Employee mapping: Discover → Ali, Email Hunter → Ayesha, Scorer → Hassan, Pitch → Sara, Importer → Usman, Sender → Zainab.
- The office uses top-down 16-bit RPG pixel art, not vector illustration or 3D. Use `public/office/office-bg.png` as the scene background and character PNG sprite sheets from `public/office/characters/*.png`; use 32×32 tiles and 32×48 character frames with crisp `image-rendering: pixelated`.
- Phaser 3 is justified for office sprite animation and walking paths. Keep the scene isolated in a client-only component loaded dynamically so it cannot break the rest of Next.js.
- Use a behavior state machine driven only by real task-engine data:
  - A queued or running task puts its assigned employee at their desk working.
  - With no active or queued tasks for about five seconds, free employees may walk to the lounge and chat. Lounge banter must stay casual and must never claim a work status.
  - A new task, failed task, or timed-out task makes Khan show an angry expression with a short call-back bubble and sends everyone back to their own desk.
  - Success may show a short success pose, then follow the idle rules.
- Show an Idle, Working, or Alert indicator and state its real cause; never invent progress or status.
- Drive Phaser sprite states and walking paths only from real task-engine events/SSE; respect `prefers-reduced-motion` and keep hover name/title/status, click-to-open detail, keyboard access, and ARIA support.
