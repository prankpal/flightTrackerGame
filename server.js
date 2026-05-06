// src/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const poller = require('./poller');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ─── API Routes ────────────────────────────────────────────────────────────

/**
 * POST /api/location
 * Called by the phone's browser to register GPS location + phone number
 * Body: { lat, lon, phone }
 */
app.post('/api/location', (req, res) => {
  const { lat, lon, phone } = req.body;

  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return res.status(400).json({ error: 'lat and lon must be numbers' });
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  poller.setLocation(lat, lon, phone || process.env.YOUR_PHONE_NUMBER);
  res.json({ ok: true, message: 'Location registered. Watching for planes...' });
});

/**
 * GET /api/status
 * Returns current state: location, last poll, recent flights, alert history
 */
app.get('/api/status', (req, res) => {
  const state = poller.getState();
  res.json({
    location: state.location,
    lastPollAt: state.lastPollAt,
    pollCount: state.pollCount,
    currentFlights: state.lastFlights,
    recentAlerts: state.alerts.slice(0, 10),
    config: {
      maxAltitudeM: parseInt(process.env.MAX_ALTITUDE_METERS || '4000'),
      searchRadiusKm: parseFloat(process.env.SEARCH_RADIUS_KM || '5'),
      pollIntervalS: parseInt(process.env.POLL_INTERVAL_SECONDS || '60'),
    },
  });
});

/**
 * POST /api/poll
 * Manually trigger a poll (useful for testing)
 */
app.post('/api/poll', async (req, res) => {
  await poller.poll();
  const state = poller.getState();
  res.json({
    ok: true,
    flightsFound: state.lastFlights.length,
    flights: state.lastFlights,
  });
});

/**
 * GET /api/flights
 * Returns just the current overhead flights (no alert sending)
 */
app.get('/api/flights', (req, res) => {
  const state = poller.getState();
  res.json({
    location: state.location,
    lastPollAt: state.lastPollAt,
    flights: state.lastFlights,
  });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║        ✈  PlanеSpotter Server  ✈         ║
╠══════════════════════════════════════════╣
║  Running at http://localhost:${PORT}        ║
║                                          ║
║  1. Open on your phone's browser         ║
║  2. Tap "Share My Location"              ║
║  3. Enter your phone number              ║
║  4. You'll get a text when a plane       ║
║     flies overhead!                      ║
╚══════════════════════════════════════════╝
  `);

  poller.start();
});

module.exports = app;
