# Habitus — Base44 dev environment

## What this is
A static, client-side habit/task tracker ("Habitus"). Single-page app: `Plan.html` + `js/*.js` + `css/**/*.css`. No backend, no build step, no database — all data lives in `localStorage`. Turkish UI (`lang="tr"`).

## Running it
```
docker compose -f docker-compose.base44.yml up -d --build
```
- Served by `nginx:alpine` on host port **3000** (container port 80).
- The repo root is bind-mounted read-only into nginx's html dir, so edits to HTML/CSS/JS appear on browser refresh — no rebuild needed.
- Entry point: `http://localhost:3000/Plan.html` (the app's only page).

## Verifying it works
```
curl -sf -H "Host: external-preview.example.com" http://localhost:3000/Plan.html | head
```
Should return the start of the `Plan.html` document.

## Notes / quirks
- `assets/` (icons, og-image) and `site.webmanifest` are referenced in `Plan.html` but not committed — they 404 gracefully and don't block the app.
- `js/13-calendar.js` fetches a **public** Google Calendar ICS URL (no credentials). Browsers may block it via CORS at runtime; that's a client-side concern, not a setup one.
- No external secrets are required.
