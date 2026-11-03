# AI Khan

AI Khan is a local-first prospect workspace for organizing manually entered
business records. Discovery, campaigns, outreach, and site generation are
explicitly simulated; only prospect records are persisted by the backend.

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

## Next.js dashboard

The Next.js 14 dashboard is an additional frontend; the Python server, current
vanilla workspace, API, and SQLite database remain available and unchanged.
Node.js 20+ and npm are required.

Start the Python API in one terminal:

```bash
python3 server.py
```

Then start the dashboard in another:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The dashboard proxies `/api/prospects` requests to
the local Python API at `127.0.0.1:8000`. Set `PROSPECT_API_ORIGIN` if the API is
running elsewhere. The original UI remains at <http://127.0.0.1:8000>.

Build and run the production frontend with `npm run build` and `npm start`.
Revenue, users, orders, traffic, sales, transactions, and project progress are
illustrative examples only; only prospects and their statuses come from the
SQLite API. Keep this preview bound to a trusted local environment. Next.js
14.2.35 is pinned to match the requested major version and currently has
reported upstream advisories; review the current security support status before
exposing it to a network or production users.

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
