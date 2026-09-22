import { blockchainService } from '../services/blockchainService.js';
import { db } from '../database/db.js';

export const blockchainController = {
  verify(req, res) {
    try {
      const identifier = req.body?.certId || req.body?.identifier || req.query?.certId || req.params?.id;
      const result = blockchainService.verifyCertificate(identifier);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getAllCertificates(req, res) {
    try {
      const certs = db.certificates.listValid();
      res.json({ success: true, count: certs.length, certificates: certs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async issueCertificate(req, res) {
    try {
      const { providerId, name, category, district, issuer } = req.body;
      if (!providerId || !name || !category) {
        return res.status(400).json({ success: false, message: 'providerId, name, and category are required.' });
      }
      const result = await blockchainService.issueCertificate({ providerId, name, category, district, issuer });
      res.status(201).json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  releaseEscrow(req, res) {
    try {
      const { bookingId } = req.body;
      if (!bookingId) {
        return res.status(400).json({ success: false, message: 'bookingId is required.' });
      }
      const confirmedBy = req.user ? `${req.user.name} (${req.user.role})` : 'System Verified Check-in';
      const result = blockchainService.releaseEscrow(bookingId, confirmedBy);
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  refundEscrow(req, res) {
    try {
      const { bookingId, reason } = req.body;
      if (!bookingId) {
        return res.status(400).json({ success: false, message: 'bookingId is required.' });
      }
      const result = blockchainService.refundEscrow(bookingId, reason);
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  getLedger(req, res) {
    try {
      const ledger = blockchainService.getAuditLedger(req.user);
      res.json({ success: true, totalTransactions: ledger.length, ledger, transactions: ledger });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
