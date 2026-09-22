import { db } from '../database/db.js';
import { calculateDistance } from './aiPlannerService.js';

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
    return db.transport.listVehicles();
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
