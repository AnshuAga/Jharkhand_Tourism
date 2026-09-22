import { Router } from 'express';
import { enquiryController } from '../controllers/enquiryController.js';

const router = Router();

router.post('/', enquiryController.create);

export default router;
