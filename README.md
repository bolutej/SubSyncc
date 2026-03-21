# SubSync — Subscription Tracker

SubSync is a lightweight subscription management web app that helps you keep track of recurring payments. It provides a calendar view of upcoming renewals, highlights alerts before charges hit, and summarizes your monthly cost and active subscriptions.

## What It Does
- **Tracks subscriptions** with name, price, billing day, and alert window.
- **Calendar view** shows upcoming renewals and alert days.
- **Stats bar** summarizes monthly cost, active subscriptions, and expiring soon.
- **Alerts panel** lists renewals happening within your alert window.
- **Browser notifications** (optional) for same‑day or next‑day renewals.

## Key Pages
- `home.html` — Landing page with product messaging.
- `index.html` — Main app experience with calendar + sidebar panels.

## How It Works
- Data is stored in `localStorage` under the key `subtrack`.
- The calendar and lists are rendered dynamically by `script.js`.
- A light/dark theme toggle is supported and persisted in `localStorage`.

## Files
- `index.html` — App shell and layout.
- `home.html` — Marketing/landing page.
- `style.css` — Styling for both pages.
- `script.js` — App logic and rendering.

## Run Locally
Open `home.html` or `index.html` in your browser. No build step required.

## Notes
- Subscription icons are fetched from Google’s favicon service based on service name.
- Demo data is cleared when only legacy demo items are detected.
