import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';

function validatePayload(body) {
  const preferences = body?.preferences;
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return 'Planner preferences are required.';
  }
  if (JSON.stringify(preferences).length > 100000) return 'Planner preferences are too large.';
  if (body.itinerary !== undefined && JSON.stringify(body.itinerary).length > 500000) {
    return 'Saved itinerary is too large.';
  }
  return null;
}

export const itineraryDraftController = {
  list(req, res) {
    res.json({ success: true, drafts: db.itineraryDrafts.listByUserId(req.user.id) });
  },
  create(req, res) {
    const error = validatePayload(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const draft = db.itineraryDrafts.create({
      id: `draft-${uuidv4()}`,
      user_id: req.user.id,
      title: String(req.body.title || 'Untitled journey').trim().slice(0, 120) || 'Untitled journey',
      preferences: req.body.preferences,
      itinerary: req.body.itinerary || null
    });
    res.status(201).json({ success: true, draft });
  },
  update(req, res) {
    const error = validatePayload(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const draft = db.itineraryDrafts.update(req.params.id, req.user.id, req.body);
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found.' });
    res.json({ success: true, draft });
  },
  remove(req, res) {
    if (!db.itineraryDrafts.delete(req.params.id, req.user.id)) {
      return res.status(404).json({ success: false, message: 'Draft not found.' });
    }
    res.json({ success: true });
  }
};
