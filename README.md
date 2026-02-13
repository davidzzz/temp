# Setup Checklist Share Invite

Implements a single viral feature end-to-end:
- UI entry point from setup success state: **Share setup checklist** + **Copy link**.
- Authenticated backend endpoint: `POST /api/invites/setup-share`.
- Invite acceptance route: `GET /i/:token`.
- Measurement hooks/events: `share_clicked`, `invite_accepted`.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Verify

1. Click **Share setup checklist**.
2. Confirm success state: `Invite link copied`.
3. Open generated invite URL.
4. Check metrics:

```bash
curl http://localhost:3000/api/metrics
```
