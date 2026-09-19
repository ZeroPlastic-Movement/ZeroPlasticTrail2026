# 🌍 ZeroPlastic Cleanup Check-In System

A QR code check-in app for ZeroPlastic Trail 2026. Participants scan a QR code or
enter their NIC number to:

- **Quick check-in** — NIC already on the participants board → one tap to mark attendance
- **Register & check-in** — NIC not found → fill a short form → added to the board, already marked as attended

## Architecture

- **Frontend:** React + Vite, served as static files
- **Backend:** one Vercel serverless function (`api/checkin.js`)
- **Data:** Monday.com board `5031418117`
- **Hosting:** Vercel
- **QR code:** `qrcode.react`

The browser never talks to Monday.com. It posts to `/api/checkin`, and that
function — running on Vercel's servers — holds the API token and talks to
Monday. This matters, see below.

## ⚠️ The API token must never be prefixed `VITE_`

Vite compiles **every** `VITE_*` environment variable directly into the
JavaScript bundle it ships to browsers. A Monday token stored that way is
readable by anyone who opens the site and views the page source — putting it in
Vercel's environment variables instead of the repo does not help, because the
build still inlines it.

The variable is therefore called `MONDAY_API_TOKEN`, with no prefix, and is read
only inside `api/checkin.js`, which runs server-side.

An earlier version of this app got this wrong and published a working token. If
you ever see `VITE_MONDAY_API_TOKEN` reappear, treat the token as compromised
and regenerate it at <https://monday.com/users/me/api>.

## Setup

### 1. Get a Monday.com API token

Generate a personal API token at <https://monday.com/users/me/api>.

Note that a personal token carries **all of your own permissions across the
entire Monday account**, not just this board. If you ever need to narrow that,
create a dedicated Monday user with access to only the participants board and
use that user's token.

### 2. Local development

```bash
npm install
cp .env.example .env.local     # then fill in MONDAY_API_TOKEN
npm run dev
```

`.env.local` is gitignored. Never commit it.

Because the check-in endpoint is a serverless function, `npm run dev` alone
serves the frontend but not `/api/checkin`. To run both together:

```bash
npx vercel dev
```

### 3. Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONDAY_API_TOKEN` | yes | Monday.com personal API token. Server-side only. |
| `MONDAY_BOARD_ID` | no | Defaults to `5031418117`. |
| `MONDAY_API_VERSION` | no | Pins the Monday API version, e.g. `2025-01`. Blank tracks Monday's current version. |

**On `MONDAY_API_VERSION`:** the previous version of this app broke because it
used `boards { items }`, a field Monday removed from its API. Queries here use
the current `items_page_by_column_values`, verified working against the live
board. Pinning a version protects you from a future removal doing the same thing
mid-event — check Monday's current supported versions and set it before the
event if you want that guarantee.

## Board structure

Board `5031418117`, columns written by this app:

| Purpose | Column ID | Type |
| --- | --- | --- |
| NIC number | `numeric_mm7brhp6` | numbers |
| Contact (WhatsApp) | `numeric_mm7bz03e` | numbers |
| University / Institution | `color_mm7bmtcx` | status |
| Participated | `color_mm7bt98r` | status (Yes / No) |
| Name with Initials (certificate) | `dropdown_mm7bzxw6` | dropdown |
| Medical conditions | `color_mm7b1hjs` | status |

Two of these are worth knowing about:

- **Medical conditions** is a *status* column whose labels are whatever people
  typed into the original registration form ("No", "no", "None", "-", "Asthma",
  and 28 others). The app writes free text into it with
  `create_labels_if_missing`, matching how the existing rows were created. It
  would be cleaner as a Text column — worth converting after the event.
- **Name with Initials** is a *dropdown* for the same reason.

Because both rely on label creation, registration writes the core fields first
and retries without the two optional ones if Monday rejects the label. A check-in
at the gate will never fail because of an optional field.

## Privacy

Search is filtered **server-side** by NIC, and the endpoint returns only the one
matching participant's name. The browser never receives the participant list.
The previous version downloaded the whole board — every name, NIC, phone number,
email and medical answer — into each participant's browser.

The endpoint is unauthenticated, as an event check-in link has to be. It can
confirm whether a given NIC is on the list, so treat the URL as semi-public and
take it down after the event.

## License

MIT © ZeroPlastic Movement
