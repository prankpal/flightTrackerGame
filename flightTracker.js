// src/flightTracker.js
// Queries OpenSky Network API for flights within a bounding box

const fetch = require('node-fetch');

const OPENSKY_BASE = 'https://opensky-network.org/api';

// Airline ICAO prefix -> name mapping (common ones)
const AIRLINE_MAP = {
  'AAL': 'American Airlines',
  'UAL': 'United Airlines',
  'DAL': 'Delta Air Lines',
  'SWA': 'Southwest Airlines',
  'ASA': 'Alaska Airlines',
  'JBU': 'JetBlue Airways',
  'FFT': 'Frontier Airlines',
  'NKS': 'Spirit Airlines',
  'SKW': 'SkyWest Airlines',
  'RPA': 'Republic Airways',
  'BAW': 'British Airways',
  'DLH': 'Lufthansa',
  'AFR': 'Air France',
  'KLM': 'KLM Royal Dutch Airlines',
  'UAE': 'Emirates',
  'QTR': 'Qatar Airways',
  'SIA': 'Singapore Airlines',
  'CPA': 'Cathay Pacific',
  'ANA': 'All Nippon Airways',
  'JAL': 'Japan Airlines',
  'QFA': 'Qantas',
  'VIR': 'Virgin Atlantic',
  'EIN': 'Aer Lingus',
  'IBE': 'Iberia',
  'AZA': 'Alitalia',
  'THY': 'Turkish Airlines',
  'ETH': 'Ethiopian Airlines',
  'MSR': 'EgyptAir',
  'SVA': 'Saudi Arabian Airlines',
  'FDX': 'FedEx',
  'UPS': 'UPS Airlines',
  'GTI': 'Atlas Air',
  'CLX': 'Cargolux',
  'SXS': 'Sun Express',
  'WZZ': 'Wizz Air',
  'RYR': 'Ryanair',
  'EZY': 'easyJet',
  'VLG': 'Vueling',
  'BEL': 'Brussels Airlines',
  'SAS': 'Scandinavian Airlines',
  'FIN': 'Finnair',
};

/**
 * Convert km radius to lat/lon degree offsets (approximate)
 */
function getBoundingBox(lat, lon, radiusKm) {
  const latDelta = radiusKm / 111.0;
  const lonDelta = radiusKm / (111.0 * Math.cos(lat * Math.PI / 180));
  return {
    lamin: lat - latDelta,
    lamax: lat + latDelta,
    lomin: lon - lonDelta,
    lomax: lon + lonDelta,
  };
}

/**
 * Calculate distance between two lat/lon points in km (Haversine)
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Get airline name from ICAO callsign prefix
 */
function getAirlineName(callsign) {
  if (!callsign || callsign.trim() === '') return 'Unknown Operator';
  const prefix = callsign.trim().substring(0, 3).toUpperCase();
  return AIRLINE_MAP[prefix] || `Operator: ${prefix}`;
}

/**
 * Heading degrees -> compass direction
 */
function headingToCompass(heading) {
  if (heading === null || heading === undefined) return 'Unknown';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(heading / 45) % 8];
}

/**
 * Fetch flights over a location from OpenSky Network
 * Returns array of flight objects, filtered by radius and altitude
 */
async function getFlightsOverhead(lat, lon, radiusKm, maxAltitudeMeters) {
  const bbox = getBoundingBox(lat, lon, radiusKm);

  const params = new URLSearchParams({
    lamin: bbox.lamin.toFixed(4),
    lamax: bbox.lamax.toFixed(4),
    lomin: bbox.lomin.toFixed(4),
    lomax: bbox.lomax.toFixed(4),
  });

  const username = process.env.OPENSKY_USERNAME;
  const password = process.env.OPENSKY_PASSWORD;
  const authHeader = username && password
    ? 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
    : null;

  const headers = { 'Accept': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  const url = `${OPENSKY_BASE}/states/all?${params}`;
  console.log(`[FlightTracker] Fetching: ${url}`);

  const res = await fetch(url, { headers, timeout: 10000 });

  if (!res.ok) {
    throw new Error(`OpenSky API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (!data.states || data.states.length === 0) {
    return [];
  }

  // OpenSky state vector indices:
  // 0: icao24, 1: callsign, 2: origin_country, 3: time_position,
  // 4: last_contact, 5: longitude, 6: latitude, 7: baro_altitude,
  // 8: on_ground, 9: velocity, 10: true_track (heading), 11: vertical_rate,
  // 12: sensors, 13: geo_altitude, 14: squawk, 15: spi, 16: position_source

  return data.states
    .filter(s => {
      const planeLat = s[6];
      const planeLon = s[5];
      const altitude = s[7] ?? s[13]; // baro_altitude, fallback to geo_altitude
      const onGround = s[8];

      if (onGround) return false;
      if (!planeLat || !planeLon) return false;
      if (altitude === null || altitude > maxAltitudeMeters) return false;

      const dist = haversineKm(lat, lon, planeLat, planeLon);
      return dist <= radiusKm;
    })
    .map(s => {
      const planeLat = s[6];
      const planeLon = s[5];
      const callsign = (s[1] || '').trim();
      const altitudeM = s[7] ?? s[13];
      const altitudeFt = altitudeM ? Math.round(altitudeM * 3.281) : null;
      const speedMs = s[9];
      const speedKnots = speedMs ? Math.round(speedMs * 1.944) : null;
      const heading = s[10];
      const distKm = haversineKm(lat, lon, planeLat, planeLon);

      return {
        icao24: s[0],
        callsign,
        airline: getAirlineName(callsign),
        originCountry: s[2],
        lat: planeLat,
        lon: planeLon,
        altitudeM: Math.round(altitudeM),
        altitudeFt,
        speedKnots,
        heading,
        headingCompass: headingToCompass(heading),
        distanceKm: Math.round(distKm * 10) / 10,
        flightawareUrl: callsign ? `https://flightaware.com/live/flight/${callsign.trim()}` : null,
        flightradarUrl: callsign ? `https://www.flightradar24.com/${callsign.trim()}` : null,
      };
    });
}

module.exports = { getFlightsOverhead, getAirlineName, headingToCompass };
