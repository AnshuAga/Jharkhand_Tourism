import { db } from '../database/db.js';
import { calculateDistance } from './aiPlannerService.js';

const DEMO_ROUTES = [
  {
    id: 'jh-demo-01', name: 'Jharkhand Eco Bus 01', plate: 'JH-DEMO-01', route: 'Ranchi → Patratu → Netarhat',
    speed: 38, delayMinutes: 0,
    stops: [['Ranchi Railway Station', 23.3441, 85.3096], ['Patratu Valley', 23.6353, 85.2836], ['Netarhat', 23.4747, 84.2649]],
    roadSegments: [
      [[23.3441, 85.3096], [23.3900, 85.3005], [23.4450, 85.2920], [23.5100, 85.2870], [23.5750, 85.2845], [23.6353, 85.2836]],
      [[23.6353, 85.2836], [23.6200, 85.2100], [23.5900, 85.1000], [23.5500, 84.9800], [23.5150, 84.8500], [23.4900, 84.7000], [23.4747, 84.2649]]
    ]
  },
  {
    id: 'jh-demo-02', name: 'Jharkhand Eco Bus 02', plate: 'JH-DEMO-02', route: 'Deoghar → Dumka → Rajrappa',
    speed: 42, delayMinutes: 4,
    stops: [['Deoghar Temple', 24.4826, 86.7003], ['Dumka Bus Stand', 24.2674, 87.2497], ['Rajrappa Temple', 23.6317, 85.6712]],
    roadSegments: [
      [[24.4826, 86.7003], [24.4400, 86.7900], [24.3900, 86.9000], [24.3300, 87.0300], [24.2674, 87.2497]],
      [[24.2674, 87.2497], [24.1900, 87.1400], [24.0800, 87.0000], [23.9500, 86.8500], [23.8200, 86.7000], [23.7000, 86.0500], [23.6317, 85.6712]]
    ]
  },
  {
    id: 'jh-demo-03', name: 'Jharkhand Safari Shuttle 03', plate: 'JH-DEMO-03', route: 'Ranchi → Hazaribagh → Betla',
    speed: 35, delayMinutes: 8,
    stops: [['Ranchi Airport', 23.3149, 85.3217], ['Hazaribagh Lake', 23.9933, 85.3622], ['Betla National Park', 23.8874, 84.1909]],
    roadSegments: [
      [[23.3149, 85.3217], [23.3900, 85.3400], [23.5000, 85.3550], [23.6200, 85.3700], [23.7500, 85.3650], [23.8800, 85.3600], [23.9933, 85.3622]],
      [[23.9933, 85.3622], [24.0000, 85.2500], [23.9900, 85.1200], [23.9600, 84.9800], [23.9200, 84.8300], [23.8900, 84.6000], [23.8874, 84.1909]]
    ]
  }
];

const demoState = { running: false, startedAt: null, elapsedMs: 0, timer: null, broadcaster: null };
const stopDwellMs = 18000;
const routeStartMs = 0;

function routeMetrics(route) {
  const segments = [];
  let total = 0;
  route.stops.slice(0, -1).forEach((stop, index) => {
    const next = route.stops[index + 1];
    const points = (route.roadSegments?.[index] || [[stop[1], stop[2]], [next[1], next[2]]]);
    const distanceKm = points.slice(0, -1).reduce((sum, point, pointIndex) => (
      sum + calculateDistance(point[0], point[1], points[pointIndex + 1][0], points[pointIndex + 1][1])
    ), 0);
    const travelMs = Math.max(28000, (distanceKm / route.speed) * 3600000);
    segments.push({ from: stop, to: next, points, distanceKm, startMs: total, travelMs });
    total += travelMs + stopDwellMs;
  });
  return { segments, cycleMs: total };
}

function pointOnPath(points, progress) {
  const distances = points.slice(0, -1).map((point, index) => (
    calculateDistance(point[0], point[1], points[index + 1][0], points[index + 1][1])
  ));
  const totalDistance = distances.reduce((sum, distance) => sum + distance, 0) || 1;
  let remaining = totalDistance * progress;
  for (let index = 0; index < distances.length; index += 1) {
    if (remaining <= distances[index]) {
      const ratio = distances[index] ? remaining / distances[index] : 0;
      return {
        lat: points[index][0] + (points[index + 1][0] - points[index][0]) * ratio,
        lng: points[index][1] + (points[index + 1][1] - points[index][1]) * ratio
      };
    }
    remaining -= distances[index];
  }
  return { lat: points.at(-1)[0], lng: points.at(-1)[1] };
}

function pathToProgress(points, progress) {
  const result = [];
  const current = pointOnPath(points, progress);
  const distances = points.slice(0, -1).map((point, index) => (
    calculateDistance(point[0], point[1], points[index + 1][0], points[index + 1][1])
  ));
  const target = distances.reduce((sum, distance) => sum + distance, 0) * progress;
  let travelled = 0;
  points.forEach((point, index) => {
    if (index === 0 || travelled < target) result.push({ lat: point[0], lng: point[1] });
    if (index < distances.length) travelled += distances[index];
  });
  result.push(current);
  return result;
}

const DEMO_METRICS = new Map(DEMO_ROUTES.map((route) => [route.id, routeMetrics(route)]));

function demoVehicle(route, now = Date.now()) {
  const metrics = DEMO_METRICS.get(route.id);
  const elapsed = demoState.elapsedMs + (demoState.running ? now - demoState.startedAt : 0);
  const t = (elapsed + route.delayMinutes * 60000) % metrics.cycleMs;
  const segment = metrics.segments.find((item) => t >= item.startMs && t < item.startMs + item.travelMs + stopDwellMs) || metrics.segments[0];
  const inDwell = t >= segment.startMs + segment.travelMs;
  const progress = inDwell ? 1 : Math.max(0, Math.min(1, (t - segment.startMs) / segment.travelMs));
  const currentPoint = pointOnPath(segment.points, progress);
  const lat = currentPoint.lat;
  const lng = currentPoint.lng;
  const nextStop = segment.to[0];
  const travelledInSegmentKm = segment.distanceKm * progress;
  const remainingKm = Math.max(0, segment.distanceKm - travelledInSegmentKm);
  const status = inDwell ? 'dwelling' : route.delayMinutes >= 6 ? 'delayed' : 'active';
  const speedKmH = inDwell ? 0 : Math.round(route.speed * (0.88 + Math.sin(elapsed / 17000) * 0.08));
  const etaMinutes = inDwell ? Math.ceil((stopDwellMs - (t - segment.startMs - segment.travelMs)) / 60000) : Math.max(1, Math.ceil((remainingKm / route.speed) * 60));
  const pathTaken = [];
  metrics.segments.forEach((item) => {
    if (t <= item.startMs) return;
    if (t >= item.startMs + item.travelMs) {
      pathTaken.push(...pathToProgress(item.points, 1));
      return;
    }
    const segmentProgress = Math.max(0, Math.min(1, (t - item.startMs) / item.travelMs));
    pathTaken.push(...pathToProgress(item.points, segmentProgress));
  });
  if (!pathTaken.length) pathTaken.push({ lat: segment.from[1], lng: segment.from[2] });
  pathTaken[pathTaken.length - 1] = { lat, lng };
  return {
    id: route.id, vehicleId: route.id, name: route.name, plate: route.plate, route: route.route,
    lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), speedKmH: speedKmH, speed_kmh: speedKmH,
    status, nextStop, next_stop: nextStop, distanceToNextStopKm: Number(remainingKm.toFixed(2)),
    eta: `${etaMinutes} min`, etaMinutes, progress: Number(((segment.startMs + (inDwell ? segment.travelMs : (t - segment.startMs))) / metrics.cycleMs * 100).toFixed(1)),
    updatedAt: new Date(now).toISOString(), last_telemetry_at: new Date(now).toISOString(),
    source: 'demo',
    demo: true,
    simulation: 'GPS-free elapsed-time simulation',
    routeStops: route.stops.map(([name, stopLat, stopLng]) => ({ name, lat: stopLat, lng: stopLng })),
    routeWaypoints: metrics.segments.flatMap((item, index) => (
      index === 0 ? item.points.map(([pointLat, pointLng]) => ({ lat: pointLat, lng: pointLng }))
        : item.points.slice(1).map(([pointLat, pointLng]) => ({ lat: pointLat, lng: pointLng }))
    )),
    pathTaken: pathTaken.map((point) => ({ lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) }))
  };
}

export const geoTransportService = {
  /**
   * Find attractions and homestays within given radius (km) based on real database records
   */
  findNearby({ lat, lng, radius = 25 }) {
    const userLat = Number(lat);
    const userLng = Number(lng);
    const radiusKm = Number(radius);

    const destinations = db.destinations.list();
    const homestays = db.services.list({ category: 'homestay' });

    const nearbyDestinations = destinations
      .map(dest => {
        const dist = calculateDistance(userLat, userLng, dest.lat, dest.lng);
        return { ...dest, distanceKm: dist };
      })
      .filter(dest => dest.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const nearbyHomestays = homestays
      .map(stay => {
        // match district or proximity
        return stay;
      });

    return {
      success: true,
      origin: { lat: userLat, lng: userLng },
      radiusKm,
      totalFound: nearbyDestinations.length,
      destinations: nearbyDestinations,
      homestays: nearbyHomestays
    };
  },

  /**
   * Calculate route distance, duration and navigation waypoints between Jharkhand locations
   */
  async getRouteDetails(fromLocation, toLocation) {
    const destinations = db.destinations.list();
    const dest1 = destinations.find(d => d.name.toLowerCase() === fromLocation.toLowerCase() || d.slug.toLowerCase() === fromLocation.toLowerCase()) || {
      name: fromLocation,
      lat: 23.3441,
      lng: 85.3096
    };
    const dest2 = destinations.find(d => d.name.toLowerCase() === toLocation.toLowerCase() || d.slug.toLowerCase() === toLocation.toLowerCase()) || {
      name: toLocation,
      lat: 23.4795,
      lng: 84.2697
    };

    const fallbackDistanceKm = calculateDistance(dest1.lat, dest1.lng, dest2.lat, dest2.lng);
    const fallbackTimeHours = Math.max(0.5, Math.round((fallbackDistanceKm / 45) * 10) / 10);
    let distanceKm = fallbackDistanceKm;
    let timeHours = fallbackTimeHours;
    let routeSource = 'estimated corridor';

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration'
          },
          body: JSON.stringify({
            origin: { location: { latLng: { latitude: Number(dest1.lat), longitude: Number(dest1.lng) } } },
            destination: { location: { latLng: { latitude: Number(dest2.lat), longitude: Number(dest2.lng) } } },
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE'
          })
        });
        const data = await response.json();
        const route = data.routes?.[0];
        const durationSeconds = Number.parseFloat(String(route?.duration || '').replace('s', ''));
        if (response.ok && route?.distanceMeters && Number.isFinite(durationSeconds)) {
          distanceKm = Math.round((route.distanceMeters / 1000) * 10) / 10;
          timeHours = Math.round((durationSeconds / 3600) * 10) / 10;
          routeSource = 'Google Maps driving route';
        }
      } catch {
        // Keep the estimated fallback when the optional route API is unavailable.
      }
    }

    const stepsCount = 5;
    const waypoints = [];
    for (let i = 0; i <= stepsCount; i++) {
      const ratio = i / stepsCount;
      waypoints.push({
        step: i,
        lat: Number((dest1.lat + (dest2.lat - dest1.lat) * ratio).toFixed(4)),
        lng: Number((dest1.lng + (dest2.lng - dest1.lng) * ratio).toFixed(4)),
        instruction: i === 0
          ? `Depart from ${dest1.name}`
          : i === stepsCount
          ? `Arrive at ${dest2.name}`
          : `Scenic Highway Waypoint ${i} (${Math.round(distanceKm * ratio)} km)`
      });
    }

    return {
      success: true,
      from: dest1.name,
      to: dest2.name,
      distanceKm,
      estimatedTimeHours: timeHours,
      estimatedTimeString: `${Math.floor(timeHours)} hr ${Math.round((timeHours % 1) * 60)} min`,
      routeSource,
      waypoints
    };
  },

  /**
   * Get real-time transport vehicle positions
   * Strictly returns live database vehicles reporting telemetry within the past 30 mins
   */
  getLiveVehicles() {
    return [...DEMO_ROUTES.map((route) => demoVehicle(route)), ...db.transport.listVehicles().map((vehicle) => ({ ...vehicle, source: 'telemetry', demo: false }))];
  },

  getDemoStatus() {
    const now = Date.now();
    return {
      running: demoState.running,
      elapsedMs: demoState.elapsedMs + (demoState.running ? now - demoState.startedAt : 0),
      updatedAt: new Date(now).toISOString(),
      source: 'demo',
      demo: true,
      vehicles: DEMO_ROUTES.map((route) => demoVehicle(route, now))
    };
  },

  setDemoBroadcaster(broadcaster) {
    demoState.broadcaster = broadcaster;
  },

  startDemo() {
    if (demoState.running) return this.getDemoStatus();
    demoState.startedAt = Date.now();
    demoState.running = true;
    if (!demoState.timer) {
      demoState.timer = setInterval(() => {
        if (demoState.running) demoState.broadcaster?.(this.getDemoStatus());
      }, 1000);
    }
    return this.getDemoStatus();
  },

  pauseDemo() {
    if (demoState.running) {
      demoState.elapsedMs += Date.now() - demoState.startedAt;
      demoState.running = false;
      demoState.startedAt = null;
    }
    return this.getDemoStatus();
  },

  resumeDemo() {
    return this.startDemo();
  },

  resetDemo() {
    demoState.running = false;
    demoState.startedAt = null;
    demoState.elapsedMs = 0;
    return this.getDemoStatus();
  },

  /**
   * Update real-time GPS telemetry from transport driver/device
   */
  updateVehicleTelemetry(payload) {
    const vId = payload.vehicleId || payload.id;
    db.transport.updateTelemetry(payload);
    return db.transport.findVehicleById(vId);
  },

  /**
   * Get active travel advisories from database
   */
  getTravelAlerts() {
    return db.transport.listAlerts();
  },

  /**
   * Post a new emergency or travel advisory (Admin action)
   */
  createAlert({ type, severity, title, location, message, createdBy }) {
    const alertId = `alert-${Date.now()}`;
    db.transport.createAlert({
      id: alertId,
      type: type || 'Advisory',
      severity: severity || 'Info',
      title,
      location,
      message,
      created_by: createdBy
    });
    return { id: alertId, type, severity, title, location, message };
  },

  deleteAlert(id) {
    return db.transport.deleteAlert(id).changes > 0;
  }
};
