import { db } from '../database/db.js';

// Keep transport estimates deterministic and offline: live inventory is never inferred.
const CITY_COORDINATES = {
  Ranchi: { lat: 23.3441, lng: 85.3096 },
  Jamshedpur: { lat: 22.8046, lng: 86.2029 },
  Dhanbad: { lat: 23.7957, lng: 86.4304 },
  Bokaro: { lat: 23.6693, lng: 86.1511 },
  Deoghar: { lat: 24.4826, lng: 86.7003 },
  Hazaribagh: { lat: 23.9933, lng: 85.3622 },
  Latehar: { lat: 23.7437, lng: 84.5027 }
};
const STATION_CODES = {
  Ranchi: 'RNC',
  'Hundru Falls': 'RNC',
  'Dassam Falls': 'RNC',
  'Jonha Falls': 'JONA',
  Netarhat: 'LTHR',
  'Betla National Park': 'BRWD',
  Palamu: 'BRWD',
  Rajrappa: 'RMT',
  Parasnath: 'PNME',
  Deoghar: 'DGHR',
  Hazaribagh: 'HZD',
  Jamshedpur: 'TATA',
  Dhanbad: 'DHN',
  Bokaro: 'BKSC'
};

function stationCodeFor(location) {
  return STATION_CODES[location] || null;
}

const MODES = {
  'Private Car': { speed: 45, rate: 14, fixed: 250, bookingType: 'self-arranged', note: 'Estimated fuel, tolls and parking; arrange a vehicle locally.' },
  Train: { speed: 55, rate: 2.2, fixed: 80, bookingType: 'official-railway', bookingUrl: 'https://www.irctc.co.in/', note: 'Route availability and fares must be checked with Indian Railways.' },
  Bus: { speed: 38, rate: 1.5, fixed: 30, bookingType: 'external-check', bookingUrl: 'https://www.redbus.in/', note: 'Estimated fare only; confirm the route and seat availability on the external provider.' },
};

const round = (value) => Math.round(value * 100) / 100;
const externalSearchUrl = (mode, from, to, tripDate) => {
  const origin = encodeURIComponent(from);
  const destination = encodeURIComponent(to);
  if (mode === 'Train') return 'https://www.irctc.co.in/';
  if (mode === 'Bus') return `https://www.redbus.in/bus-tickets/${encodeURIComponent(from.toLowerCase().replace(/\s+/g, '-'))}-to-${encodeURIComponent(to.toLowerCase().replace(/\s+/g, '-'))}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${tripDate ? `&travelmode=driving` : ''}`;
};

function distanceKm(from, to) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function googleRouteDistance(from, to) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration'
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE'
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const route = data.routes?.[0];
    if (!route?.distanceMeters) return null;
    return {
      distance: Math.round(route.distanceMeters / 100) / 10,
      durationHours: Math.max(0.2, Math.round((parseFloat(route.duration || '0s') / 3600) * 10) / 10),
      source: 'google_routes_api'
    };
  } catch {
    return null;
  }
}

function resolveLocation(location, destinations) {
  if (location && typeof location === 'object' &&
      Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng))) {
    return { name: location.name || 'Origin', lat: Number(location.lat), lng: Number(location.lng) };
  }
  const key = String(location || 'Ranchi').toLowerCase();
  const destination = destinations.find((item) =>
    [item.name, item.slug, item.title].some((value) => String(value || '').toLowerCase() === key)
  );
  if (destination) return { name: destination.name, lat: Number(destination.lat), lng: Number(destination.lng) };
  const city = Object.entries(CITY_COORDINATES).find(([name]) => name.toLowerCase() === key);
  return city ? { name: city[0], ...city[1] } : { name: String(location || 'Ranchi'), ...CITY_COORDINATES.Ranchi };
}

function resolveMode(requestedMode, totalDistance, travelers) {
  if (requestedMode !== 'Let AI Decide') return MODES[requestedMode] ? requestedMode : 'Private Car';
  if (totalDistance >= 80) return travelers > 2 ? 'Private Car' : 'Train';
  return 'Private Car';
}

export async function estimateTransportPlan({ startLocation = 'Ranchi', destinations: requestedDestinations = [], mode = 'Private Car', travelers = 1, tripDate = '' } = {}) {
  const destinations = db.destinations.list();
  const stops = requestedDestinations.map((item) => resolveLocation(item, destinations));
  const origin = resolveLocation(startLocation, destinations);
  const points = [origin, ...stops];
  const totalDistance = points.slice(1).reduce((sum, point, index) => sum + distanceKm(points[index], point), 0);
  const selectedMode = resolveMode(mode, totalDistance, Math.max(1, Number(travelers) || 1));
  const config = MODES[selectedMode];
  const travelerCount = Math.max(1, Number(travelers) || 1);
  const intercity = await Promise.all(points.slice(1).map(async (to, index) => {
    const from = points[index];
    const usesRoadRoute = selectedMode === 'Private Car';
    const googleRoute = usesRoadRoute ? await googleRouteDistance(from, to) : null;
    const distance = googleRoute?.distance || distanceKm(from, to);
    const durationHours = googleRoute?.durationHours || Math.max(0.2, round(distance / config.speed));
    const estimatedCost = selectedMode === 'Train'
      ? 0
      : Math.max(config.fixed, Math.round((distance * config.rate + config.fixed) * travelerCount));
    return {
      from: from.name,
      to: to.name,
      fromStationCode: stationCodeFor(from.name),
      toStationCode: stationCodeFor(to.name),
      distance: `${distance} km`,
      duration: `${durationHours} hours`,
      estimatedCost: `₹${estimatedCost.toLocaleString('en-IN')}`,
      estimatedCostValue: estimatedCost,
      distanceKm: distance,
      distanceSource: googleRoute?.source || 'destination_coordinates_haversine_estimate',
      durationHours,
      estimatedCost,
      currency: 'INR',
      mode: selectedMode,
      availabilityStatus: selectedMode === 'Train' ? 'unavailable' : 'not_checked',
      bookingType: config.bookingType,
      bookingUrl: externalSearchUrl(selectedMode, from.name, to.name, tripDate),
      notes: selectedMode === 'Train'
        ? 'Live train fare and seat availability are unavailable until an authorized railway integration returns them. Check IRCTC before booking.'
        : config.note
    };
  }));
  // Train is an intercity option only. Local sightseeing always uses a road-transfer
  // estimate so the same train leg is never charged again as local transport.
  const localMode = selectedMode === 'Train' ? 'Private Car' : selectedMode;
  const localConfig = MODES[localMode];
  const localDistance = stops.length ? Math.max(0, stops.length * 10) : 0;
  const localCost = stops.length ? Math.round((localDistance * localConfig.rate + localConfig.fixed) * travelerCount) : 0;
  const localTransport = [{
    from: stops.length ? stops[0].name : origin.name,
    to: stops.length ? 'Local attractions' : origin.name,
    distance: `${localDistance} km`,
    duration: localDistance ? `${round(localDistance / localConfig.speed)} hours` : 'Not required',
    estimatedCost: `₹${localCost.toLocaleString('en-IN')}`,
    estimatedCostValue: localCost,
    distanceKm: localDistance,
    currency: 'INR',
    mode: localMode,
    availabilityStatus: 'not_checked',
    bookingType: localConfig.bookingType,
    bookingUrl: externalSearchUrl(localMode, stops[0]?.name || origin.name, 'Local attractions', tripDate),
    notes: stops.length
      ? `Allowance for approximately ${localDistance} km of local road movement; intercity train travel is shown separately.`
      : 'No local movement estimate was required.'
  }];
  const intercityCost = intercity.reduce((sum, leg) => sum + leg.estimatedCost, 0);
  return {
    selectedMode,
    requestedMode: mode,
    intercity,
    localTransport,
    estimatedCosts: { intercity: intercityCost, localTransport: localCost, total: intercityCost + localCost, currency: 'INR' },
    estimatedTotalTransportCost: intercityCost + localCost,
    totalDistanceKm: totalDistance,
    totalDurationHours: round(intercity.reduce((sum, leg) => sum + leg.durationHours, 0)),
    availabilityStatus: 'not_checked',
    bookingType: config.bookingType,
    bookingUrl: externalSearchUrl(selectedMode, origin.name, stops[0]?.name || origin.name, tripDate),
    notes: process.env.GOOGLE_MAPS_API_KEY
      ? 'Distance and driving duration use Google Routes when available. Fare and availability are still estimates and must be verified.'
      : 'Google Routes is not configured. Distance uses destination coordinates and fare/duration use estimates; no live availability or pricing has been claimed.'
  };
}

export async function searchTrainOptions({ from, to, date, travelClass = '', passengers = {} } = {}) {
  if (!from || !to || !date) {
    const error = new Error('Origin, destination, and travel date are required for train search.');
    error.status = 400;
    throw error;
  }
  const requestedDate = String(date).slice(0, 10);
  const parsedDate = new Date(`${requestedDate}T00:00:00Z`);
  const normalizedDate = !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toISOString().slice(0, 10)
    : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || normalizedDate !== requestedDate) {
    const error = new Error('Travel date must be a valid YYYY-MM-DD date.');
    error.status = 400;
    throw error;
  }
  const configuredUrl = process.env.TRAIN_SEARCH_API_URL;
  if (!configuredUrl) {
    return {
      status: 'unavailable',
      dataClassification: 'unavailable',
      results: [],
      message: 'Live train schedules are not configured. Check Indian Railways directly.',
      bookingUrl: 'https://www.irctc.co.in/'
    };
  }
  let url;
  try {
    url = new URL(configuredUrl);
  } catch {
    return {
      status: 'unavailable',
      dataClassification: 'unavailable',
      results: [],
      message: 'The configured train integration URL is invalid.',
      bookingUrl: 'https://www.irctc.co.in/'
    };
  }
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  url.searchParams.set('date', date);
  if (travelClass) url.searchParams.set('class', travelClass);
  if (passengers.adults) url.searchParams.set('adults', passengers.adults);
  if (passengers.children) url.searchParams.set('children', passengers.children);
  if (passengers.seniors) url.searchParams.set('seniors', passengers.seniors);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const headers = { Accept: 'application/json' };
    if (process.env.TRAIN_SEARCH_API_KEY) headers.Authorization = `Bearer ${process.env.TRAIN_SEARCH_API_KEY}`;
    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) {
      throw new Error(`Train provider returned HTTP ${response.status}.`);
    }
    const payload = await response.json();
    if (!Array.isArray(payload.results)) {
      throw new Error('Train provider returned an invalid result shape.');
    }
    return {
      status: 'live',
      dataClassification: 'live',
      results: payload.results.map((result) => ({
        trainName: result.trainName || result.name || null,
        trainNumber: result.trainNumber || result.number || null,
        origin: result.origin || result.from || from,
        destination: result.destination || result.to || to,
        departure: result.departure || result.departureTime || null,
        arrival: result.arrival || result.arrivalTime || null,
        duration: result.duration || null,
        fare: result.fare ?? null,
        availability: result.availability ?? null
      })),
      bookingUrl: 'https://www.irctc.co.in/'
    };
  } catch (error) {
    if (error.name === 'AbortError') error.message = 'Train provider timed out.';
    return {
      status: 'unavailable',
      dataClassification: 'unavailable',
      results: [],
      message: `Live train schedules are temporarily unavailable: ${error.message}`,
      bookingUrl: 'https://www.irctc.co.in/'
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const transportService = { estimateTransportPlan };
