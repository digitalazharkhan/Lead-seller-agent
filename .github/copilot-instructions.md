# AI Khan Command Center rules

- Read `docs/PROJECT_MASTER_PROMPT.md` before phase work and follow its phases in order.
- Never touch the header or logo (`public/brand/ai-khan-mark.png`) unless asked.
- Characters: Azhar (Boss), Khan (Senior AI Operations Manager), Ali (Discover), Ayesha (Email Hunter), Hassan (Scorer), Sara (Pitch), Usman (Importer), and Zainab (Sender). Use top-down 16-bit RPG pixel art, with PNG sprite sheets in `public/office/characters/*.png`, 32×32 tiles and 32×48 character frames. Render crisply with `image-rendering: pixelated`; no 3D. Reference Azhar with `public/brand/azhar-reference-*.jpg` when available.
- Use `public/office/office-bg.png` as the office scene background.
- The office scene may use Phaser 3 for sprite animation and walking paths, isolated in a client-only component loaded dynamically.
- Drive animations only from real task-engine events/SSE. Never invent progress or trigger random outbursts.
- Sender is dry-run only. Never add a live-send path.
- Do not run `npm run build` while the dev server is running; use lint and TypeScript checks.
- Do not commit, push to `main`, delete legacy UI, or delete user data.
- At each phase end, report changed files, features, test results, limitations, and approvals needed.
- Tests: `python3 -m unittest discover -s tests -v`, `npm run lint`, `npx tsc --noEmit`, and `git diff HEAD --check`.