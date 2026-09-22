import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

export const destinationsController = {
  getAll(req, res) {
    try {
      const { search, category, district } = req.query;
      const onlyActive = req.query.onlyActive !== 'false';
      const list = db.destinations.list({ search, category, district, onlyActive });
      res.json({ success: true, count: list.length, destinations: list, data: list });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getById(req, res) {
    try {
      const { id } = req.params;
      const match = db.destinations.findById(id);
      if (!match) {
        return res.status(404).json({ success: false, message: 'Destination not found.' });
      }
      res.json({ success: true, destination: match });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  create(req, res) {
    try {
      const {
        name,
        title,
        district,
        category,
        lat,
        lng,
        avgCost,
        bestSeason,
        crowdLevel,
        image,
        description,
        openingHours,
        ticketInfo,
        attractions,
        activities,
        nearbyHotels,
        interests
      } = req.body;

      if (!String(name || '').trim() || !String(title || '').trim() || !String(district || '').trim() ||
        !String(category || '').trim() || !String(description || '').trim() || !String(image || '').trim() ||
        lat === undefined || lng === undefined || !String(bestSeason || '').trim() ||
        !String(openingHours || '').trim() || !String(ticketInfo || '').trim() ||
        !String(activities || '').trim() || avgCost === undefined || avgCost === null || avgCost === '') {
        return res.status(400).json({ success: false, message: 'Name, title, district, category, description, image, coordinates, best season, opening hours, verified ticket information, estimated local spend, and activities are required.' });
      }
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
        return res.status(400).json({ success: false, message: 'Latitude and longitude must be valid numbers.' });
      }
      if (!Number.isFinite(Number(avgCost)) || Number(avgCost) < 0) {
        return res.status(400).json({ success: false, message: 'Estimated local spend must be a valid non-negative number.' });
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const existing = db.destinations.findById(slug);
      if (existing) {
        return res.status(400).json({ success: false, message: `A destination with name '${name}' already exists.` });
      }

      const id = slug || `dest-${uuidv4().slice(0, 8)}`;
      const newDest = db.destinations.create({
        id,
        slug,
        name: name.trim(),
        title: title || `${name} - Jharkhand`,
        district: district.trim(),
        category: category.trim(),
        lat: Number(lat),
        lng: Number(lng),
        rating: 5.0,
        review_count: 0,
        avg_cost: Number(avgCost),
        best_season: bestSeason.trim(),
        crowd_level: crowdLevel || 'Moderate',
        image: image.trim(),
        description: description.trim(),
        opening_hours: openingHours.trim(),
        ticket_info: ticketInfo.trim(),
        attractions: attractions || [],
        activities: activities || [],
        nearby_hotels: nearbyHotels || [],
        interests: interests || ['nature'],
        is_active: 1
      });

      // Log audit
      db.auditLogs.log({
        id: `log-${Date.now()}`,
        user_id: req.user.id,
        action: 'DESTINATION_CREATED',
        entity_type: 'destination',
        entity_id: newDest.id,
        ip_address: req.ip || '127.0.0.1',
        details: { name: newDest.name, district: newDest.district }
      });

      res.status(201).json({
        success: true,
        message: `Destination '${newDest.name}' added successfully and is now active across the platform.`,
        destination: newDest
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  update(req, res) {
    try {
      const { id } = req.params;
      const {
        name, title, district, category, lat, lng, avgCost, avg_cost,
        bestSeason, best_season, crowdLevel, crowd_level, image,
        description, openingHours, opening_hours, ticketInfo, ticket_info,
        attractions, activities, nearbyHotels, nearby_hotels, interests, is_active
      } = req.body;
      const updates = {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(title !== undefined && { title: String(title).trim() }),
        ...(district !== undefined && { district: String(district).trim() }),
        ...(category !== undefined && { category: String(category).trim() }),
        ...(lat !== undefined && { lat: Number(lat) }),
        ...(lng !== undefined && { lng: Number(lng) }),
        ...(avgCost !== undefined || avg_cost !== undefined ? { avg_cost: Number(avgCost ?? avg_cost) } : {}),
        ...(bestSeason !== undefined || best_season !== undefined ? { best_season: bestSeason ?? best_season } : {}),
        ...(crowdLevel !== undefined || crowd_level !== undefined ? { crowd_level: crowdLevel ?? crowd_level } : {}),
        ...(image !== undefined && { image }),
        ...(description !== undefined && { description: String(description).trim() }),
        ...(openingHours !== undefined || opening_hours !== undefined ? { opening_hours: openingHours ?? opening_hours } : {}),
        ...(ticketInfo !== undefined || ticket_info !== undefined ? { ticket_info: ticketInfo ?? ticket_info } : {}),
        ...(attractions !== undefined && { attractions }),
        ...(activities !== undefined && { activities }),
        ...(nearbyHotels !== undefined || nearby_hotels !== undefined ? { nearby_hotels: nearbyHotels ?? nearby_hotels } : {}),
        ...(interests !== undefined && { interests }),
        ...(is_active !== undefined && { is_active: is_active ? 1 : 0 })
      };
      if (!updates.name || !updates.title || !updates.district || !updates.category || !updates.description || !updates.image ||
        !updates.best_season || !updates.opening_hours || !updates.ticket_info || !updates.activities ||
        updates.avg_cost === undefined || updates.avg_cost === null || updates.avg_cost === '') {
        return res.status(400).json({ success: false, message: 'Name, title, district, category, description, image, coordinates, best season, opening hours, verified ticket information, estimated local spend, and activities are required.' });
      }
      if (!Number.isFinite(updates.lat) || !Number.isFinite(updates.lng)) {
        return res.status(400).json({ success: false, message: 'Latitude and longitude must be valid numbers.' });
      }
      if (!Number.isFinite(updates.avg_cost) || updates.avg_cost < 0) {
        return res.status(400).json({ success: false, message: 'Estimated local spend must be a valid non-negative number.' });
      }
      const updated = db.destinations.update(id, updates);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Destination not found.' });
      }

      db.auditLogs.log({
        id: `log-${Date.now()}`,
        user_id: req.user.id,
        action: 'DESTINATION_UPDATED',
        entity_type: 'destination',
        entity_id: id,
        details: req.body
      });

      res.json({ success: true, message: 'Destination updated successfully.', destination: updated });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  delete(req, res) {
    try {
      const { id } = req.params;
      db.destinations.delete(id);

      db.auditLogs.log({
        id: `log-${Date.now()}`,
        user_id: req.user.id,
        action: 'DESTINATION_DELETED',
        entity_type: 'destination',
        entity_id: id,
        details: {}
      });

      res.json({ success: true, message: 'Destination removed from database.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
