# AI Khan

AI Khan is a local-first prospect workspace. The Next.js dashboard uses
simulated discovery, campaign, outreach, and site-generation examples, while
the separate Python leads desk can run the repository's lead-processing
scripts. Its send task is dry-run only.

## Run locally

Python 3.10+ is required; the API and SQLite database use only the Python
standard library.

```bash
python3 server.py
```

Open <http://127.0.0.1:8000>. The SQLite database is created as
`siteseller.sqlite3` on first run. Use `--db /path/to/file.sqlite3` to choose a
different location.

Run the tests with:

```bash
python3 -m unittest discover -s tests -v
```

## Python leads desk and task API

Start the script-enabled local desk and backend with:

```bash
python3 desk.py
```

Open <http://127.0.0.1:8000>. It uses the same `siteseller.sqlite3` database
unless `--db` specifies another path. The task engine accepts only `discover`,
`emails`, `score`, `pitch`, `import`, and `send`; tasks are queued in SQLite and
run one at a time. On restart, unfinished tasks are recorded as interrupted
and are not automatically rerun.

- `POST /api/office/tasks` queues a task, for example
  `curl -X POST http://127.0.0.1:8000/api/office/tasks -H 'Content-Type: application/json' -H 'X-Desk: 1' -d '{"task":"score"}'`.
- `GET /api/office/tasks` lists recent tasks.
- `GET /api/office/tasks/{id}` returns task details and bounded output.
- `GET /api/office/tasks/{id}/events` returns that task's persisted events.
- `GET /api/office/events` streams task events as Server-Sent Events.

The `X-Desk` header is only a same-origin/CSRF request marker; it is not
authentication. The task server refuses non-local bind addresses and should
remain on localhost. The `send` task invokes `sender.py` without `--send` and
cannot send real email. Real sending remains a separate manually approved
terminal operation.

## Next.js dashboard

The Next.js dashboard is an additional frontend; the Python server, current
vanilla workspace, API, and SQLite database remain available.
Node.js 20+ and npm are required.

Start the local desk backend in one terminal (it also serves the office task
API):

```bash
python3 desk.py
```

Then start the dashboard in another:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The dashboard proxies `/api/prospects` requests to
the local Python API at `127.0.0.1:8000`. Set `PROSPECT_API_ORIGIN` if the
prospect API is running elsewhere. The new `/office` page uses a same-origin
Next.js API route for the task API and streams SSE responses without buffering;
that proxy is intentionally fixed to the local desk at `127.0.0.1:8000`.
The original UI remains at <http://127.0.0.1:8000>.

- <http://localhost:3000/office> shows the task-backed team, persisted task
  history, errors, and live task events.
- Sender tasks from the office remain dry-run only. Real email sending is not
  available through the web UI.

Build and run the production frontend with `npm run build` and `npm start`.
Revenue, users, orders, traffic, sales, transactions, and project progress are
illustrative examples only; only prospects and their statuses come from the
SQLite API. Keep this preview bound to a trusted local environment. Next.js
15.5.27 is declared in `package.json`; review the current security support
status before exposing it to a network or production users.

## Prototype behavior

The prospect screen is backed by a local JSON API and SQLite. Its seeded
fictional records are marked `DEMO`; manually added prospects are saved to the
database as user-entered records and are not represented as externally verified.
Dashboard metrics are calculated from API records. Search and filters run in
the browser over the same API results. Workspace preferences remain in browser
local storage.

- `GET /api/prospects` lists demo and user-entered records.
- `POST /api/prospects` creates a user-entered record (`name`, `category`, and
  `city` are required).
- `PATCH /api/prospects/{id}/status` updates a record to `new`, `contacted`,
  `replied`, `opted-out`, or `client`.

The app binds to `127.0.0.1` by default. Do not expose this unauthenticated
development server to the public internet. The interface uses system fonts and
inline SVGs; no remote scripts, styles, icons, or fonts are needed.

Campaigns, outreach, discovery, and site generation are clearly labeled
simulations. They do not contact external services, send email, generate or
publish websites, or show invented activity or performance metrics.

Before configuring real outreach, provide an accurate sender identity and
physical mailing address, honor opt-outs, and ensure messages comply with
applicable email laws and provider policies.
