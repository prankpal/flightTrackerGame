# ✈️ PlaneSpotter

Get SMS alerts when planes fly overhead, then guess where they're flying to.

## How it works

1. Open the app on your phone
2. Share your location once (low-accuracy / cell tower is fine)
3. Server polls OpenSky Network every 60s for planes within 15km and under 4,000m altitude
4. When a plane is detected → Twilio sends you an SMS
5. Open the app, pick from 4 multiple-choice destinations, then tap Reveal to check your answer

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your real values (never commit this file):

| Variable | Where to get it |
|----------|----------------|
| `TWILIO_ACCOUNT_SID` | [twilio.com/console](https://console.twilio.com) |
| `TWILIO_AUTH_TOKEN` | twilio.com/console |
| `TWILIO_PHONE_NUMBER` | Buy a number in Twilio (~$1/mo) |
| `YOUR_PHONE_NUMBER` | Your personal number in E.164 format (`+15550001234`) |
| `OPENSKY_USERNAME` | Optional — register free at [opensky-network.org](https://opensky-network.org) |
| `OPENSKY_PASSWORD` | Same as above |

### 3. Run the server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

### 4. Open on your phone

**Option A — Deploy to Railway (recommended, runs 24/7):**

Push to GitHub, connect the repo in [railway.app](https://railway.app), and set your `.env` values in the Railway dashboard. Railway auto-detects the `railway.toml` config and gives you a permanent public URL.

**Option B — Local with a tunnel:**

```bash
# No account needed:
npx localtunnel --port 3000
```

Open the printed URL in your phone's browser, tap **Locate Me**, enter your phone number, and you're watching.

---

## The game

When a flight is detected:

1. The app shows 4 city choices for where the plane is heading — biased toward the flight's actual heading as a hint
2. Tap your guess, then tap **Reveal Answer**
3. FlightRadar24 and FlightAware links appear so you can check the real route
4. Tap **✓ I was right!** or **✗ I was wrong** to log the result
5. All your past guesses are saved in the History tab

---

## Tuning

Edit `.env` to adjust:

- **`MAX_ALTITUDE_METERS`**: `4000` (≈13,000ft) catches most low-to-mid flights visually overhead. Set to `12000` (≈40,000ft) for everything including cruising altitude.
- **`SEARCH_RADIUS_KM`**: `15` is a good default. Near airports, lower it to `5` to reduce noise.
- **`POLL_INTERVAL_SECONDS`**: Without an OpenSky account, keep at `60` to avoid rate limits. With a free account, `20` is safe.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/location` | Register GPS location `{lat, lon, phone}` |
| `GET` | `/api/status` | Current state, flights, alert history |
| `GET` | `/api/flights` | Just current overhead flights |
| `POST` | `/api/poll` | Manually trigger a poll |

---

## Tech stack

- **Backend**: Node.js + Express
- **Flight data**: [OpenSky Network](https://opensky-network.org) (free, no key needed)
- **SMS**: [Twilio](https://twilio.com) (~$0.01/text)
- **Frontend**: Vanilla JS PWA, no build step
- **Hosting**: [Railway](https://railway.app) (optional, free tier available)

---

## Limitations

- OpenSky free tier: ~400 requests/day (enough for ~6 hours of 60s polling). Free account: 4,000/day.
- OpenSky data can be 10–30 seconds delayed vs real-time.
- Plane must be actively broadcasting ADS-B. Private/military craft may not appear.
- Works best in areas with good ADS-B receiver coverage (cities, airports nearby).
- State is in-memory only — location and alert history reset if the server restarts.
