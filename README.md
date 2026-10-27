# SCR Lien-Waiver System

A small, self-contained web app to order, track, and produce Utah State Construction
Registry (SCR) lien waivers. Built for Old Republic Title; seeded with the Cormont project.

No build step. Node + Express + SQLite. Runs locally and deploys to Render as-is.

## What it does

- **Dashboard** — every waiver order with status, due dates (overdue/soon flagged),
  requestor, sent count. Open an order to update status, edit the vendor email, resend,
  or print. One-click **Resend** and **Print** (coversheet + statutory waiver + Exhibit A).
- **New Request** — raise a request against any vendor; email + SCR entries auto-fill from
  the registry data; due date auto-sets to 10 business days (editable).
- **Templates** — the four Utah statutory waivers (Conditional/Unconditional ×
  Progress/Final) plus the coversheet, editable in place with `{{tokens}}`.
- **Reports** — Status Report (counts + overdue), Missing Requests (vendors from the
  registry scrub with no order yet), All Activity (filter by date / file # / requestor,
  export CSV).
- **Batch Upload** — create many orders from a CSV, or one click to raise requests for
  every vendor that's still missing one.

## Run locally

```bash
npm install
npm start
# open http://localhost:3000
```

Data lives in `data/scr.db` (SQLite). To wipe and reload the Cormont seed: `npm run seed`.

## Deploy to Render

1. Push this folder to a Git repo (GitHub/GitLab).
2. In Render: **New → Blueprint**, point it at the repo. `render.yaml` provisions a web
   service + a 1 GB persistent disk mounted at `/var/data` (so the SQLite file survives
   deploys). Or **New → Web Service** manually: build `npm install`, start `node server.js`.
3. Set **DATA_DIR=/var/data** (already in the blueprint) and copy `data/seed.json` onto the
   disk, or let it seed from the repo copy on first boot.

### Scaling note
SQLite is perfect for one office. For multi-user / high volume, swap `better-sqlite3` for
Postgres (Render offers managed Postgres) — the queries are standard SQL; only `db.js`
changes. Email sending is stubbed as a logged "Sent" action; wire `/resend` to SendGrid or
Microsoft Graph to actually dispatch mail.

## Data model
`projects → vendors → orders`, plus `templates` and an `activity` audit log.
Seeded from the real Cormont registry scrub: 43 vendors / 78 SCR entries.
