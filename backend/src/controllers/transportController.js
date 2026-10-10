import { geoTransportService } from '../services/geoTransportService.js';

export const transportController = {
  getMapConfig(req, res) {
    res.json({ success: true, provider: 'google', apiKey: process.env.GOOGLE_MAPS_API_KEY || null });
  },

  getLiveVehicles(req, res) {
    try {
      const vehicles = geoTransportService.getLiveVehicles();
      res.json({
        success: true,
        count: vehicles.length,
        vehicles,
        available: vehicles.length > 0,
        message: 'GPS-free demo simulation data is available for demonstration purposes.',
        source: 'demo',
        demo: true,
        simulation: geoTransportService.getDemoStatus()
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getDemoStatus(req, res) {
    res.json({ success: true, ...geoTransportService.getDemoStatus() });
  },

  controlDemo(req, res) {
    try {
      const action = req.body?.action || req.params.action;
      const actions = { start: 'startDemo', pause: 'pauseDemo', resume: 'resumeDemo', reset: 'resetDemo' };
      if (!actions[action]) return res.status(400).json({ success: false, message: 'Action must be start, pause, resume, or reset.' });
      const status = geoTransportService[actions[action]]();
      req.app.get('io')?.emit('transport:demo:status', status);
      req.app.get('io')?.emit('transport:vehicles', status.vehicles);
      res.json({ success: true, ...status });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getNearby(req, res) {
    try {
      const { lat = 23.3441, lng = 85.3096, radius = 25 } = req.query;
      const result = geoTransportService.findNearby({ lat, lng, radius });
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getRoute(req, res) {
    try {
      const { from = 'Ranchi', to = 'Netarhat' } = req.query;
      const result = await geoTransportService.getRouteDetails(from, to);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getAlerts(req, res) {
    try {
      const alerts = geoTransportService.getTravelAlerts();
      res.json({ success: true, count: alerts.length, alerts });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  createAlert(req, res) {
    try {
      const { type, severity, title, location, message } = req.body;
      if (!title || !message) {
        return res.status(400).json({ success: false, message: 'Title and message are required.' });
      }
      const newAlert = geoTransportService.createAlert({
        type,
        severity,
        title,
        location,
        message,
        createdBy: req.user?.id
      });
      req.app.get('io')?.emit('transport:alerts', geoTransportService.getTravelAlerts());
      res.status(201).json({ success: true, alert: newAlert });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  deleteAlert(req, res) {
    try {
      const deleted = geoTransportService.deleteAlert(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Alert not found.' });
      }
      req.app.get('io')?.emit('transport:alerts', geoTransportService.getTravelAlerts());
      res.json({ success: true, message: 'Alert removed successfully.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  updateTelemetry(req, res) {
    try {
      const { vehicleId, lat, lng } = req.body;
      if (!vehicleId || lat === undefined || lng === undefined) {
        return res.status(400).json({ success: false, message: 'vehicleId, lat, and lng are required.' });
      }

      const updated = geoTransportService.updateVehicleTelemetry(req.body);
      res.json({ success: true, message: 'Vehicle telemetry updated.', vehicle: updated });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};
