# Code W Claw Machine

A purple, live-synced giveaway dashboard and OBS overlay built for Railway.

## Deploy to Railway
1. Upload this folder to a GitHub repository.
2. In Railway choose **New Project → Deploy from GitHub Repo**.
3. Add variables:
   - `ADMIN_KEY`: private password used by the dashboard.
   - `RELAY_KEY`: private key used by your Kick chat relay/bot.
4. Generate a public Railway domain.
5. Open `https://YOUR-DOMAIN/dashboard.html`.
6. Add `https://YOUR-DOMAIN/overlay.html` to OBS as a Browser Source (recommended 1920×1080).

Railway detects `npm start` from package.json and binds to Railway's `PORT` variable.

## Feed Kick chat messages into the app
Send each chat message to:

`POST https://YOUR-DOMAIN/api/chat`

Headers:
- `Content-Type: application/json`
- `X-Relay-Key: YOUR_RELAY_KEY`

Body:
```json
{"username":"viewername","message":"!codew","avatarUrl":"https://optional-avatar-url"}
```

Only exact keyword matches are entered, duplicates are rejected, and closed giveaways reject new entries.

## Local test
```bash
npm install
ADMIN_KEY=test RELAY_KEY=test npm start
```
Then open http://localhost:3000/dashboard.html and press **Add demo plushies**.

## Important
The app deliberately separates the giveaway from Kick's changing chat transport. Connect your existing Kick chat listener/bot to `/api/chat`; this makes the Railway app stable even if Kick changes its websocket implementation.
