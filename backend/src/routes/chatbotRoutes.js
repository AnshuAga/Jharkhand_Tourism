import { Router } from 'express';
import { chatbotController } from '../controllers/chatbotController.js';

const router = Router();

router.post('/message', chatbotController.sendMessage);

export default router;
