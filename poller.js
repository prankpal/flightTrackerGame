// src/poller.js
// Periodically checks for flights overhead and sends alerts

const { getFlightsOverhead } = require('./flightTracker');
const { sendFlightAlert } = require('./notifier');

// In-memory state (survives as long as server runs)
const state = {
  location: null,         // { lat, lon, updatedAt, phone }
  lastAlerted: {},        // icao24 -> timestamp, prevents re-alerting same plane
  lastPollAt: null,
  lastFlights: [],        // most recent flight list (for /api/status)
  pollCount: 0,
  alerts: [],             // history of sent alerts
};

const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // Don't re-alert same plane for 10 minutes

let pollTimer = null;

async function poll() {
  if (!state.location) {
    console.log('[Poller] No location set, skipping poll');
    return;
  }

  const { lat, lon, phone } = state.location;
  const maxAlt = parseInt(process.env.MAX_ALTITUDE_METERS || '4000');
  const radius = parseFloat(process.env.SEARCH_RADIUS_KM || '15');

  state.pollCount++;
  state.lastPollAt = new Date().toISOString();

  try {
    const flights = await getFlightsOverhead(lat, lon, radius, maxAlt);
    state.lastFlights = flights;
    console.log(`[Poller] Poll #${state.pollCount}: found ${flights.length} flight(s) overhead`);

    // Clean up old cooldown entries
    const now = Date.now();
    for (const icao of Object.keys(state.lastAlerted)) {
      if (now - state.lastAlerted[icao] > ALERT_COOLDOWN_MS) {
        delete state.lastAlerted[icao];
      }
    }

    for (const flight of flights) {
      const key = flight.icao24;
      if (state.lastAlerted[key]) {
        console.log(`[Poller] Skipping ${flight.callsign} (already alerted recently)`);
        continue;
      }

      state.lastAlerted[key] = now;

      const alertEntry = {
        flight,
        alertedAt: new Date().toISOString(),
        smsSent: false,
        smsError: null,
      };

      try {
        await sendFlightAlert(flight, phone);
        alertEntry.smsSent = true;
        console.log(`[Poller] ✅ Alerted for ${flight.callsign}`);
      } catch (err) {
        alertEntry.smsError = err.message;
        console.error(`[Poller] ❌ SMS failed for ${flight.callsign}:`, err.message);
      }

      state.alerts.unshift(alertEntry);
      if (state.alerts.length > 50) state.alerts.pop(); // Keep last 50
    }
  } catch (err) {
    console.error('[Poller] Poll error:', err.message);
  }
}

function start() {
  if (pollTimer) return;
  const intervalMs = parseInt(process.env.POLL_INTERVAL_SECONDS || '60') * 1000;
  console.log(`[Poller] Starting, polling every ${intervalMs / 1000}s`);
  poll(); // Immediate first poll
  pollTimer = setInterval(poll, intervalMs);
}

function stop() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function setLocation(lat, lon, phone) {
  state.location = { lat, lon, phone, updatedAt: new Date().toISOString() };
  console.log(`[Poller] Location updated: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  // Trigger immediate poll when location updates
  poll();
}

function getState() {
  return state;
}

module.exports = { start, stop, setLocation, getState, poll };
