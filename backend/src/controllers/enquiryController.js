import { randomUUID } from 'crypto';
import { db } from '../database/db.js';
import { emailService } from '../services/emailService.js';

const MAX_NAME_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 2000;

export const enquiryController = {
  async create(req, res) {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
    }
    if (name.length > MAX_NAME_LENGTH || message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, message: `Name must be ${MAX_NAME_LENGTH} characters or fewer and message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    try {
      const enquiry = db.enquiries.create({ id: randomUUID(), name, email, message });
      let emailSent = true;
      try {
        await emailService.sendEnquiryNotification({ enquiry });
      } catch (emailError) {
        emailSent = false;
        console.error('[EnquiryController] Enquiry saved but notification email failed:', emailError);
      }
      return res.status(201).json({
        success: true,
        message: emailSent
          ? 'Your enquiry has been sent. Our concierge team will contact you soon.'
          : 'Your enquiry was saved successfully. Our team will review it shortly.',
        enquiry: { id: enquiry.id, createdAt: enquiry.created_at, emailSent }
      });
    } catch (error) {
      console.error('[EnquiryController] Failed to save enquiry:', error);
      return res.status(500).json({ success: false, message: 'Unable to send your enquiry right now. Please try again.' });
    }
  }
};
