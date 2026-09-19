# Diecet Gardage — Backend

Express + MongoDB Atlas + Socket.IO API server for the diecast collector app.

## Quick start

### 1. Create a MongoDB Atlas cluster

1. Go to https://cloud.mongodb.com → sign up / log in
2. Create a free-tier **M0** cluster (any cloud provider / region)
3. Under **Database Access** → add a database user with a password
4. Under **Network Access** → allow access from your IP (or `0.0.0.0/0` for local dev)
5. Go to **Database** → **Connect** → **Drivers** → copy the connection string

### 2. Create your `.env`

```bash
cp .env.example .env
```

Open `.env` and fill in:
- `MONGODB_URI` — paste your Atlas connection string (replace `<password>` with the real one).
  If your network/VPN refuses DNS SRV lookups, the app fails to start with
  `querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net`. Fix: paste the **direct**
  (non-SRV) connection string from Atlas instead — `mongodb://` with the three
  `cluster0-shard-00-0N...mongodb.net:27017` hosts, `?ssl=true&replicaSet=atlas-xxxxx&retryWrites=true&authSource=admin`.
  The server connects to it without any SRV lookup. Alternatively keep the `mongodb+srv://`
  string and set `MONGO_DIRECT_HOSTS` (same three `host:port` shard addresses, comma-separated);
  the server then retries the string as a direct connection. The URI is never logged.
- `SESSION_SECRET` — any long random string, e.g.:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- Leave everything else as-is for local dev

### 3. Install dependencies + seed the database

```bash
npm install
npm run seed
```

The seed creates:
- 5 demo user accounts (email: `ari@diecet.demo`, password: `demo1234` — same password for all demo users)
- 8 vault models, 3 wishlist items, 7 finds, 4 posts, 3 auctions, 1 conversation

> The seed script deletes and recreates demo data only (users flagged `demo: true`). Your real accounts are never touched.

### 4. Start the server

```bash
npm run dev
```

You should see:
```
[db] connected to MongoDB
[server] listening on http://localhost:5050
[server] client origin http://localhost:5173
```

### 5. Start the frontend (in the Frontend folder)

```bash
cd ../Frontend
npm run dev
```

The Vite dev server at http://localhost:5173 proxies `/api`, `/uploads` and `/socket.io` to `http://localhost:5050` automatically.

### 6. Test the flows

1. Open http://localhost:5173 → you see the demo vault (localStorage seed)
2. Click **Sign in** (shown in the demo-mode banner at the top, or from the Me tab)
3. Log in as `ari@diecet.demo` / `demo1234`
4. The top banner turns green ("Syncing with your account") and the vault/finds/auctions/posts/messages refresh from the server
5. Add a model, list it for auction, bid on another auction, post to the feed, change a find status — all mutations go through the API and are saved to MongoDB
6. Sign out → returns to demo mode with localStorage data

### 7. Run lint / checks

```bash
npm run lint      # syntax check all source files
npm run check     # smoke tests (if written)
```

---

## API overview

All endpoints live under `/api`. Most mutations require a signed-in session (cookie `dg.sid`).

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | — | Create account (name, email, password ≥8 chars) |
| POST | `/api/auth/login` | — | Log in (email, password) |
| POST | `/api/auth/logout` | ✓ | Log out (destroy session) |
| GET | `/api/auth/me` | ✓ | Current user profile + stats |
| PATCH | `/api/auth/me` | ✓ | Update name / handle / city / bio |
| POST | `/api/auth/forgot` | — | Request password reset token |
| POST | `/api/auth/reset` | — | Set new password with token |

### Vault (your models)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/vault` | ✓ | List your models (filter by q, scale, rarity) |
| POST | `/api/vault` | ✓ | Add a model |
| GET | `/api/vault/:id` | ✓ | Get one model |
| PATCH | `/api/vault/:id` | ✓ | Edit a model (owner only) |
| DELETE | `/api/vault/:id` | ✓ | Delete a model (owner only) |

### Wishlist

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/wishlist` | ✓ | Your wishlist (with live matches against active auctions + finds) |
| POST | `/api/wishlist` | ✓ | Add item |
| PATCH | `/api/wishlist/:id` | ✓ | Edit item |
| DELETE | `/api/wishlist/:id` | ✓ | Remove item |

### Finds

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/finds` | — | Public finds (query: type, q, status, lat, lng, radiusKm) |
| POST | `/api/finds` | ✓ | Post a find (with lat/lng + radius auto-adds your location) |
| GET | `/api/finds/:id` | — | Get one find |
| PATCH | `/api/finds/:id` | ✓ | Update status (active / soldout / grabbed) — owner only |
| DELETE | `/api/finds/:id` | ✓ | Delete — owner only |

### Auctions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auctions` | — | List (query: status=live|ended, q, seller) |
| GET | `/api/auctions/:id` | — | Get one auction (with full bid history + profiles) |
| POST | `/api/auctions` | ✓ | Create auction (from your vault model, or new inline) |
| POST | `/api/auctions/:id/bid` | ✓ | Place a bid (atomic — server rejects ties / losses) |
| POST | `/api/auctions/:id/buy` | ✓ | Buy now (atomic — ends auction immediately) |
| POST | `/api/auctions/:id/close` | ✓ | Seller closes auction (winner = current bidder) |

Auctions auto-close via a sweep timer every 60 seconds.

### Posts & comments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/posts` | — | Feed (all posts, newest first) |
| POST | `/api/posts` | ✓ | Create a post |
| POST | `/api/posts/:id/like` | ✓ | Toggle like |
| GET | `/api/posts/:id/comments` | — | List comments |
| POST | `/api/posts/:id/comments` | ✓ | Add comment |
| DELETE | `/api/posts/:id` | ✓ | Delete (author only) |

### Messages & conversations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/conversations` | ✓ | Your conversations |
| POST | `/api/conversations` | ✓ | Start conversation (with userId + optional message + tradeRequestId) |
| GET | `/api/conversations/:id/messages` | ✓ | Message history (marks as read) |
| POST | `/api/conversations/:id/messages` | ✓ | Send message (pushes over Socket.IO to the other user) |

### Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | ✓ | Recent notifications + unread count |
| GET | `/api/notifications/unread-count` | ✓ | Unread count only |
| POST | `/api/notifications/:id/read` | ✓ | Mark one as read |
| POST | `/api/notifications/read-all` | ✓ | Mark all as read |

### Uploads

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/upload` | ✓ | Upload photo (multipart, field `photo`, max 5 MB JPG/PNG/WEBP/GIF). Returns `{ photo: { url, filename, size, mime } }` |

Uploaded files are served at `/uploads/<filename>`.

### Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/reports` | ✓ | Report content (targetType: find|post|auction|user, targetId, reason) |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | `{ ok: true, time: ... }` |

---

## Socket.IO events

Connect from the frontend:
```js
import { io } from 'socket.io-client'
const socket = io('http://localhost:5050', { auth: { userId: 'user-id-here' } })
```

### Rooms (server-side)

- `user:{userId}` — auto-joined on connect
- `conversation:{conversationId}` — join via `conversation:join`
- `auction:{auctionId}` — join via `auction:join`

### Events the server emits

| Event | Payload | When |
|-------|---------|------|
| `notification` | `{ id, type, text, href, read, ts }` | New notification for the user |
| `message:new` | `{ message, conversation }` | New message in a conversation you're in |
| `conversation:message` | `{ id, conversationId, senderId, text, read, ts }` | New message in a joined conversation |
| `auction:bid` | `{ auction }` | New bid on a joined auction |
| `auction:ended` | `{ auction }` | Auction closed / bought now / swept |

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | ✓ | — | MongoDB Atlas connection string |
| `PORT` | — | `5050` | Server port |
| `CLIENT_ORIGIN` | — | `http://localhost:5173` | CORS origin for the frontend |
| `SESSION_SECRET` | ✓ | — | Secret for signing session cookies |
| `SECURE_COOKIES` | — | `false` | Set `true` in production (HTTPS required) |
| `API_BASE_URL` | — | `http://localhost:5050` | Used to build absolute upload URLs |
| `UPLOAD_DIR` | — | `uploads` | Where uploaded photos are stored on disk |
| `NODE_ENV` | — | `development` | `production` enables secure cookies + hides stack traces |

---

## Production notes

- **Cookie storage**: The default setup uses MongoDB Atlas via `connect-mongo` for session storage. Works with a single server instance.
- **File uploads**: Files are stored on the local filesystem. For production, swap `multer` for S3 or Cloudinary and set the upload URL builder accordingly.
- **Rate limits**: Use an in-memory store by default. For multi-instance deployments, switch to a Redis-backed rate limiter.
- **Sweep timer**: The auction auto-close sweep runs every 60 seconds in-process. For production, consider a scheduled job.
- **Password storage**: Passwords are hashed with `bcryptjs` (10 rounds). Reset tokens are SHA-256 hashed before storage.
- **Never store secrets in client code**: The frontend receives only public profile data; passwords and reset tokens are never exposed via the API.
