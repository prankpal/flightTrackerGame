// src/notifier.js
// Sends SMS via Twilio when a plane is detected overhead

const twilio = require('twilio');

let client = null;

function getClient() {
  if (!client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token || sid.startsWith('AC') === false) {
      throw new Error('Twilio credentials not configured. Check your .env file.');
    }
    client = twilio(sid, token);
  }
  return client;
}

/**
 * Send SMS alert for an overhead flight
 */
async function sendFlightAlert(flight, toNumber) {
  const from = process.env.TWILIO_PHONE_NUMBER;
  const to = toNumber || process.env.YOUR_PHONE_NUMBER;

  if (!from || !to) {
    throw new Error('Phone numbers not configured. Check TWILIO_PHONE_NUMBER and YOUR_PHONE_NUMBER in .env');
  }

  const callsign = flight.callsign || 'Unknown';
  const altFt = flight.altitudeFt ? `${flight.altitudeFt.toLocaleString()}ft` : '?ft';
  const speed = flight.speedKnots ? `${flight.speedKnots}kts` : '';
  const heading = flight.headingCompass || '?';

  const body = [
    `✈️ PLANE OVERHEAD!`,
    ``,
    `Flight: ${callsign}`,
    `Airline: ${flight.airline}`,
    `Altitude: ${altFt}`,
    `Heading: ${heading}${speed ? ` at ${speed}` : ''}`,
    `Distance: ${flight.distanceKm}km away`,
    ``,
    `🎮 Where is it flying from/to?`,
    `Guess before checking:`,
    flight.flightradarUrl || '',
  ].filter(Boolean).join('\n');

  console.log(`[Notifier] Sending SMS to ${to} for flight ${callsign}`);

  const msg = await getClient().messages.create({ body, from, to });
  console.log(`[Notifier] SMS sent: ${msg.sid}`);
  return msg.sid;
}

module.exports = { sendFlightAlert };
