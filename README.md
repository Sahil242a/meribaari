# MeriBaari

**Jab Baari Aaye, Tabhi Aayein!**

MeriBaari ("my turn") is a real-time virtual queue for clinics, hospital OPDs and government offices. Patients scan a QR code, get a token on their phone and wait wherever they like. They see their place in line live, and get an SMS when they are 3 turns away. Reception calls the next patient with one click, and a TV in the waiting room shows who is inside.

Built with **React, Node.js, Express, Socket.io and MongoDB**.

![Home](docs/screenshots/01-home.png)

Demo video (90 s): [docs/meribaari-demo.mp4](docs/meribaari-demo.mp4)

---

## The problem

In most clinics and OPDs, people sit in a crowded room for hours without knowing when they'll be called. They can't step out, and reception answers "kitna time lagega?" all day. A paper token doesn't tell you how long the wait is.

## What MeriBaari does

| Screen                                         | Used by                | What it does                                                                                                                                                                 |
| ---------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Patient phone** (`/c/:clinic`, `/t/:token`)  | Patients (no app)      | Take a token, see live position and wait time, get SMS and browser alerts, cancel, share the link                                                                            |
| **Reception panel** (`/staff`)                 | Receptionist, admin    | Call next (or press `N`), complete, no-show, put a missed patient back in line, walk-in tokens, priority for seniors and emergencies, pause for a break, close for the day |
| **Waiting-room TV** (`/display/:clinic`)       | Everyone in the room   | Current token per counter, next tokens with ETAs, bell and Hindi announcement, QR to join                                                                                    |
| **Analytics**                                  | Clinic admin           | Tokens today, average wait, average consultation, no-show rate, busiest hours, 7-day trend                                                                                   |
| **QR poster** (`/staff/poster`)                | Clinic admin           | Printable A4 poster for the entrance                                                                                                                                         |

| Patient waiting                             | Patient called                               | Waiting-room TV                               |
| ------------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| ![](docs/screenshots/03-token.png)          | ![](docs/screenshots/07-token-called.png)    | ![](docs/screenshots/08-display.png)          |

![Reception panel](docs/screenshots/05-dashboard.png)
![Analytics](docs/screenshots/10-analytics.png)

---

## Architecture

```mermaid
flowchart LR
  P[Patient phone<br/>React] -- REST: take token --> API
  R[Reception panel<br/>React] -- REST: call next --> API
  API[Express API] --> DB[(MongoDB)]
  API -- emit --> IO[Socket.io]
  IO -- queue:update --> P
  IO -- queue:update --> TV[TV display<br/>React]
  IO -- staff:update --> R
  IO -- token:alert --> P
  API -- SMS / WhatsApp --> N[Twilio or console]
```

Every change goes through REST (validated, authenticated, rate-limited). The server then recomputes the queue and pushes it to three kinds of Socket.io rooms:

- `clinic:<id>`: public state with token numbers and ETAs only, **no names or phone numbers**
- `staff:<id>`: joined only with a valid httpOnly session cookie
- `token:<id>`: personal "almost your turn" and "your turn" alerts for one patient

**Data model**

- **Clinic:** name, slug, counters, token prefix, minutes per patient, alert threshold, open/paused flags, optional geofence
- **Token:** number (`A-12`), name, phone, source (online / walk-in), priority, status (`waiting → serving → done | no_show | cancelled`), timestamps, consultation time, notifications sent
- **Staff:** email, bcrypt password hash, role (`admin | receptionist`)
- **DayCounter:** atomic per-clinic, per-day sequence, so tokens restart at 1 every morning

## Engineering highlights

1. **The wait time learns from today's real pace.** It uses the average of the last 10 consultations, blended with the clinic's default until there are 3 samples. Accidental clicks under 30 s are ignored. With `c` counters, ETA = time until a counter frees up + `floor(position / c) × average`.
2. **No race conditions.** The next patient is claimed with one atomic `findOneAndUpdate`, so two counters clicking at once never get the same person. A test checks this.
3. **Each SMS is sent exactly once.** An atomic "claim" update runs before sending, so racing queue updates can't double-send.
4. **Real clinic rules.**
   - Seniors and emergencies go first.
   - A no-show who returns is put back after the next 2 people, not at the end.
   - Each phone number can hold one active token per day.
   - An optional geofence stops people joining from home.
   - Reception can pause the queue for a break or close tokens for the day.
5. **Security and privacy.**
   - Session JWT in an httpOnly SameSite cookie, passwords hashed with bcrypt, role-based routes.
   - Zod validation on every input, rate limits on joining and login, Helmet headers with CSP.
   - Public endpoints never return names or phone numbers.
   - Cancelling a token needs a secret key that only the patient's phone has.
6. **Resilient clients.** Every page refetches state when it reconnects, reception also polls every 30 s, and the patient's token is saved on their phone.

---

## Run locally

You need **Node.js 22.9+** and a MongoDB database. A free MongoDB Atlas cluster works, or you can install MongoDB Community Server.

```bash
npm run install:all
cp server/.env.example server/.env    # Windows: copy server\.env.example server\.env
# edit server/.env: set MONGO_URL (for Atlas: mongodb+srv://user:pass@cluster.../meribaari?...)
npm run seed                           # demo clinic, staff logins and a week of history
npm run dev                            # API on :4000, web on :5173
```

Open http://localhost:5173. The demo clinic is at `/c/city-care`, the TV at `/display/city-care`, and staff log in at `/staff/login` with `reception@meribaari.in` / `demo1234`.

If you get **`querySrv ECONNREFUSED`** with Atlas, your network's DNS is blocking the lookup. The server retries with public DNS automatically. If it still fails, set `DNS_SERVERS=8.8.8.8,1.1.1.1` in `server/.env`.

SMS messages are printed in the server terminal by default. For real SMS or WhatsApp, set `NOTIFY_PROVIDER=twilio-sms` (or `twilio-whatsapp`) and the Twilio keys.

### Scripts

| Command          | What it does                                   |
| ---------------- | ---------------------------------------------- |
| `npm run dev`    | API + web with live reload                     |
| `npm run seed`   | Demo data (refuses to run in production)       |
| `npm test`       | 18 unit and integration tests (needs MongoDB)  |
| `npm run lint`   | oxlint on client and server                    |
| `npm run format` | Prettier on all source files                   |
| `npm start`      | Production build served on :4000               |

## Deploy (free: Render + MongoDB Atlas)

1. Push this repo to GitHub.
2. In Atlas, go to **Network Access** and allow `0.0.0.0/0`. Render has no fixed IP address.
3. On Render, choose **New → Blueprint** and pick the repo. The included `render.yaml` sets everything up. Then fill in:
   - `MONGO_URL`: your Atlas string. Use a fresh database name, for example `/meribaari-prod`.
   - `PUBLIC_URL` and `CLIENT_ORIGIN`: your Render URL.

   `JWT_SECRET` is generated for you.
4. Open the site and register your clinic. **Don't run the seed in production.**

In production, Express serves the built React app, so it's one service on one URL, and cookies and websockets just work. There's also a `Dockerfile` and `docker-compose.yml` if you prefer containers.

---

## API

| Method    | Path                                             | Auth                  | Purpose                                     |
| --------- | ------------------------------------------------ | --------------------- | ------------------------------------------- |
| GET       | `/api/clinics/:slug`                             | public                | Live public queue                           |
| POST      | `/api/clinics/:slug/tokens`                      | public, rate-limited  | Take a token                                |
| GET       | `/api/tokens/:id`                                | public                | Token position and ETA (no personal data)   |
| POST      | `/api/tokens/:id/cancel`                         | patient key           | Cancel own token                            |
| POST      | `/api/auth/register`, `/login`, `/logout`        | public                | Clinic sign-up and session cookie           |
| GET       | `/api/auth/me`                                   | cookie                | Current staff member (or null)              |
| GET       | `/api/staff/queue`                               | staff                 | Full queue with names and phones            |
| POST      | `/api/staff/queue/next`, `/complete`, `/no-show` | staff                 | Counter actions                             |
| POST      | `/api/staff/tokens/:id/requeue`                  | staff                 | Put a missed patient back                   |
| POST      | `/api/staff/walk-in`                             | staff                 | Token for someone without a phone           |
| POST      | `/api/staff/pause`, `/open`                      | staff                 | Break and closing                           |
| GET       | `/api/staff/analytics`                           | staff                 | Today + 7-day stats                         |
| GET/PATCH | `/api/staff/clinic`                              | staff / admin         | Settings, counters, geofence                |
| GET/POST  | `/api/staff/members`                             | staff / admin         | Team                                        |

Socket events: the client emits `join:clinic`, `join:staff` and `join:token`, and the server emits `queue:update`, `staff:update` and `token:alert`.

## Project structure

```
meribaari/
  server/
    src/
      models/        Clinic, Token, Staff, DayCounter
      services/      queueService (core rules), estimator, notifier, analytics
      routes/        public, auth, staff + zod schemas
      realtime/      Socket.io rooms
      middleware/    auth, validation, errors
    scripts/seed.js
    tests/
  client/
    src/
      pages/         Home, Join, TokenPage, Display, StaffAuth, Dashboard (+ tabs), Poster
      lib/           api, realtime hooks, auth, sound, saved tokens
      components/    shared UI (logo, progress bar, form fields, charts)
```

## Roadmap

- Book a time slot from home
- Separate queues per doctor
- Offline-first reception panel for patchy clinic Wi-Fi
- Redis adapter for Socket.io to run several server instances
- WhatsApp bot: send "Hi" to the clinic number to get a token
