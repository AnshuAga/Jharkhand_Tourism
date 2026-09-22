import { Router } from 'express';
import { weatherService } from '../services/weatherService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const city = req.query.city || 'Ranchi';
    const data = await weatherService.getWeather(city);
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
