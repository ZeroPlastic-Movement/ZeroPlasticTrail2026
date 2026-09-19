# 🚀 Deployment Guide

## One-time setup

### 1. Set the API token in Vercel

In the Vercel dashboard: **Project → Settings → Environment Variables**.

| Name | Value |
| --- | --- |
| `MONDAY_API_TOKEN` | your Monday.com personal token |

Apply it to **Production**, **Preview** and **Development**.

Do **not** name it `VITE_MONDAY_API_TOKEN`. Vite inlines every `VITE_*` variable
into the public JavaScript bundle, which publishes the token to every visitor.
The variable has no prefix precisely so this cannot happen.

The token itself never goes in this repository — not in `vercel.json`, not in
any source file.

### 2. Connect the repo

Vercel → **New Project** → import `ZeroPlastic-Movement/ZeroPlasticTrail2026`.
Framework preset: **Vite**. Build settings come from `vercel.json`.

After that, every push to `main` deploys to production automatically, and every
branch gets its own preview URL.

## Pre-event checklist

Run through this on the real deployed URL, not locally:

1. **Known NIC** — enter a NIC that is already on the board. You should see that
   person's name, then "Mark Me As Participated" should turn the board's
   *Participated* column to **Yes**.
2. **Same NIC again** — should say you are already checked in, with no second
   write to the board.
3. **Unknown NIC** — should open the registration form. Submit it, then confirm a
   new row appears on the board with NIC, WhatsApp number, university, name with
   initials, medical answer, and *Participated = Yes*.
4. **Bad input** — type `123` and confirm you get a readable error rather than a
   silent failure.
5. **QR code** — click *Download QR Code* and confirm a PNG downloads.

Delete any test rows from the board afterwards.

## Event day

1. Print the QR code, or display it on a tablet at the gate.
2. Participants scan it and enter their NIC.
3. Watch the Monday board update live.

Keep a volunteer at the desk with the board open — if someone's NIC will not
match (a typo in the original registration, for example), they can fix it on the
board directly.

## Troubleshooting

**"Server is not configured"** — `MONDAY_API_TOKEN` is missing in Vercel, or was
added after the last deploy. Environment variables only apply to builds made
after they are set, so redeploy.

**"Monday.com rejected the request"** — check the function logs in Vercel
(**Deployments → the deployment → Functions → `api/checkin`**). The real Monday
error is logged there; participants only ever see the generic message.

**Everyone shows as "not found"** — check `MONDAY_BOARD_ID` points at the right
board and that the NIC column is still `numeric_mm7brhp6`.

**Check-ins stop working mid-event** — first check the Vercel function logs. If
Monday changed their API, set `MONDAY_API_VERSION` to a known-good version and
redeploy.

## Support

nish@zeroplasticmovement.org
