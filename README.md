# Code W Claw Machine v2

A purple Code W / Shuffle giveaway dashboard and transparent OBS browser source. It connects directly to the public chat for `kick.com/w`, converts keyword messages into plushies, and performs a server-selected animated claw draw.

## Railway deployment

1. Upload this folder to a GitHub repository.
2. Create a Railway project from that repository.
3. Add these variables:
   - `ADMIN_KEY`: password for dashboard controls.
   - `KICK_CHANNEL=w` (already defaults to `w`).
   - `KICK_CHATROOM_ID`: optional fallback. Only set this if automatic channel lookup is blocked.
   - `RELAY_KEY`: optional password for the fallback `POST /api/chat` endpoint.
4. Generate a Railway public domain.
5. Dashboard: `https://YOUR-DOMAIN/dashboard.html`
6. OBS Browser Source: `https://YOUR-DOMAIN/overlay.html` at 1920×1080.

## How Kick chat works

At startup, the server looks up `https://kick.com/api/v2/channels/w`, reads the channel's chatroom ID, and subscribes to Kick's Pusher channel `chatrooms.<id>.v2`. The dashboard displays the connection status.

Kick's website chat transport is undocumented and may change. If automatic lookup is blocked by Cloudflare, obtain the chatroom ID from the channel response in your browser's Network tab and set `KICK_CHATROOM_ID` in Railway. The app reconnects automatically after a disconnect.

## Giveaway flow

1. Set a keyword, such as `!codew`.
2. Press **Start Entries**.
3. Every unique user who types the exact keyword in `kick.com/w` becomes a plushie.
4. Press **Drop the Claw** or the large Shuffle button.
5. The server securely selects the winner and all dashboards/OBS overlays play the same reveal.

## Fallback relay

You can still feed messages from another Kick bot:

`POST /api/chat`

Header: `X-Relay-Key: YOUR_RELAY_KEY`

```json
{"username":"viewername","message":"!codew","avatarUrl":"https://optional-avatar-url"}
```

## Local test

```bash
npm install
ADMIN_KEY=test npm start
```

Open `http://localhost:3000/dashboard.html` and use **Add Demo Plushies**.
