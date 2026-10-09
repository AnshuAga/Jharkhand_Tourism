import crypto from 'crypto';
import { ethers } from 'ethers';
import { db } from '../database/db.js';
import { tourismVerificationAbi } from '../config/tourismVerificationAbi.js';
import dotenv from 'dotenv';

dotenv.config();

// Helper to compute SHA-256 hash
export function computeSHA256(data) {
  const serialized = typeof data === 'string' ? data : JSON.stringify(data);
  return '0x' + crypto.createHash('sha256').update(serialized).digest('hex');
}

const NETWORK = 'Polygon Amoy';
const CHAIN_ID = 80002;
const DEFAULT_CONTRACT_ADDRESS = '0x35935098b5888b3ce57259d7cd7e01e92556bcd3';
const READ_RPC_FALLBACKS = [
  'https://rpc-amoy.polygon.technology',
  'https://polygon-amoy-bor-rpc.publicnode.com'
];

function getContract({ write = false } = {}) {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
  const contractAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS;
  if (!rpcUrl) throw new Error('Blockchain RPC is not configured. Set BLOCKCHAIN_RPC_URL on the backend.');
  if (!ethers.isAddress(contractAddress)) throw new Error('Blockchain contract address is invalid.');
  const provider = new ethers.JsonRpcProvider(rpcUrl, CHAIN_ID, { staticNetwork: true });
  if (!write) return new ethers.Contract(contractAddress, tourismVerificationAbi, provider);
  if (!process.env.BLOCKCHAIN_PRIVATE_KEY) throw new Error('Blockchain signer is not configured. Set BLOCKCHAIN_PRIVATE_KEY on the backend.');
  let wallet;
  try {
    wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider);
  } catch {
    throw new Error('Blockchain signer configuration is invalid.');
  }
  return new ethers.Contract(contractAddress, tourismVerificationAbi, wallet);
}

function getReadContracts() {
  const configured = process.env.BLOCKCHAIN_RPC_URL;
  const urls = [configured, ...READ_RPC_FALLBACKS].filter((url, index, all) => url && all.indexOf(url) === index);
  return urls.map((rpcUrl) => ({
    url: rpcUrl,
    contract: new ethers.Contract(
      process.env.BLOCKCHAIN_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS,
      tourismVerificationAbi,
      new ethers.JsonRpcProvider(rpcUrl, CHAIN_ID, { staticNetwork: true })
    )
  }));
}

function blockchainError(error) {
  const message = String(error?.shortMessage || error?.reason || error?.message || '');
  if (/insufficient funds/i.test(message)) return new Error('Blockchain transaction failed: the signer has insufficient POL.');
  if (/user rejected|rejected/i.test(message)) return new Error('Blockchain transaction was rejected.');
  if (/revert|execution reverted/i.test(message)) return new Error('Blockchain transaction was reverted by the contract.');
  if (/network|rpc|socket|timeout|missing response|bad data|could not decode|missing revert data|server error|service unavailable|503|unknown error/i.test(message)) return new Error('Polygon Amoy network is temporarily unavailable. Please try again.');
  return new Error('Blockchain transaction failed. Please try again.');
}

function normalizeOnChainCertificate(providerId, raw) {
  const values = Array.isArray(raw) ? raw : [
    raw?.returnedProviderId ?? raw?.[0],
    raw?.certificateHash ?? raw?.[1],
    raw?.issuedAt ?? raw?.[2],
    raw?.validUntil ?? raw?.[3]
  ];
  const returnedProviderId = String(values[0] || '');
  const certificateHash = String(values[1] || '');
  const issuedAt = Number(values[2] || 0);
  const validUntil = Number(values[3] || 0);
  return {
    providerId,
    returnedProviderId,
    certificateHash,
    issuedAt,
    validUntil,
    revoked: false,
    exists: Boolean(returnedProviderId && certificateHash && (issuedAt || validUntil))
  };
}

export const blockchainService = {
  /**
   * Verify a certificate ID against the application's certificate registry.
   * Certificate IDs are local database identifiers; transaction hashes use
   * the on-chain verification path below.
   */
  verifyCertificateId(certificateId) {
    const normalizedId = String(certificateId || '').trim();
    if (!normalizedId) {
      return { verified: false, valid: false, status: 'Invalid', message: 'A certificate ID is required.' };
    }

    const certificate = db.certificates.findByHashOrId(normalizedId);
    if (!certificate || String(certificate.certificate_id).toLowerCase() !== normalizedId.toLowerCase()) {
      return {
        verified: false,
        valid: false,
        status: 'Not found',
        certificateId: normalizedId,
        registry: 'Local certificate registry',
        message: 'Certificate ID was not found in the local certificate registry.'
      };
    }

    const valid = certificate.status === 'valid' &&
      (!certificate.valid_until || new Date(certificate.valid_until) >= new Date());

    return {
      verified: valid,
      valid,
      status: certificate.status === 'revoked' ? 'Revoked' : valid ? 'Valid' : 'Expired',
      certificateId: certificate.certificate_id,
      providerId: certificate.provider_id,
      certificateHash: certificate.sha256_hash || null,
      issuedAt: certificate.issue_date ? new Date(certificate.issue_date).toISOString() : null,
      validUntil: certificate.valid_until ? new Date(certificate.valid_until).toISOString() : null,
      transactionHash: certificate.blockchain_tx_hash || null,
      network: NETWORK,
      chainId: CHAIN_ID,
      registry: 'Local certificate registry',
      certificate
    };
  },

  /**
   * Verify provider certificate by ID or Cryptographic Hash
   */
  async verifyCertificate(identifier) {
    if (!identifier || !String(identifier).trim()) {
      return { verified: false, status: 'Invalid', message: 'A provider ID is required.' };
    }
    const normalizedIdentifier = String(identifier).trim();
    const stored = db.certificates.findByHashOrId(normalizedIdentifier);
    if (!stored && /^CERT-/i.test(normalizedIdentifier)) {
      return {
        verified: false,
        valid: false,
        status: 'Not found',
        certificateId: normalizedIdentifier,
        network: NETWORK,
        chainId: CHAIN_ID,
        message: 'Certificate ID was not found in the local certificate registry.'
      };
    }
    const normalizedId = stored?.provider_id || normalizedIdentifier;
    try {
      let onChain;
      let lastError;
      for (const { contract } of getReadContracts()) {
        try {
          onChain = normalizeOnChainCertificate(normalizedId, await contract.verifyCertificate(normalizedId));
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!onChain) throw lastError || new Error('No blockchain read provider is available.');
      const certificateRecord = stored || db.certificates.findByProviderId(normalizedId);
      const expired = !onChain.validUntil || onChain.validUntil <= Math.floor(Date.now() / 1000);
      const hashMatches = !certificateRecord || certificateRecord.sha256_hash.toLowerCase() === onChain.certificateHash.toLowerCase();
      const verified = onChain.exists && !onChain.revoked && !expired && hashMatches;
      return {
        verified,
        valid: verified,
        status: !onChain.exists ? 'Invalid' : onChain.revoked ? 'Revoked' : expired ? 'Expired' : verified ? 'Valid' : 'Invalid',
        providerId: normalizedId,
        certificateHash: onChain.certificateHash || null,
        issuedAt: onChain.issuedAt ? new Date(onChain.issuedAt * 1000).toISOString() : null,
        validUntil: onChain.validUntil ? new Date(onChain.validUntil * 1000).toISOString() : null,
        network: NETWORK,
        chainId: CHAIN_ID,
        contractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS,
        transactionHash: certificateRecord?.blockchain_tx_hash || null,
        certificate: certificateRecord || null,
        message: !onChain.exists ? 'Certificate not found on the blockchain.' : !hashMatches ? 'Blockchain certificate does not match the application record.' : undefined
      };
    } catch (error) {
      console.error('[Blockchain] Certificate verification failed:', error?.shortMessage || error?.message || error);
      if (stored) {
        return {
          verified: false,
          valid: false,
          status: 'Network unavailable',
          certificateId: stored.certificate_id,
          providerId: stored.provider_id,
          certificateHash: stored.sha256_hash,
          network: NETWORK,
          chainId: CHAIN_ID,
          contractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS,
          transactionHash: stored.blockchain_tx_hash || null,
          certificate: stored,
          message: 'Certificate ID found locally, but Polygon Amoy could not be reached to confirm its blockchain status.'
        };
      }
      throw blockchainError(error);
    }
  },

  /**
   * Issue and sign a new digital certificate (Admin action upon KYC approval)
   */
  async issueCertificate({ providerId, name, category, district = 'Ranchi', issuer = 'Jharkhand Tourism Development Corporation' }) {
    if (!providerId || !name || !category) throw new Error('Provider ID, name and category are required.');
    const existing = db.certificates.findByProviderId(providerId);
    if (existing?.status === 'valid' && existing.blockchain_tx_hash) return { certificate: existing, message: 'Existing valid certificate found.' };
    const issuedAt = Math.floor(Date.now() / 1000);
    const validUntil = issuedAt + (2 * 365 * 24 * 60 * 60);
    const issueDate = new Date(issuedAt * 1000).toISOString().split('T')[0];
    const expiryDate = new Date(validUntil * 1000).toISOString().split('T')[0];
    const certificateId = existing?.certificate_id || `CERT-JH-${crypto.createHash('sha256').update(providerId).digest('hex').slice(0, 10).toUpperCase()}`;
    const certPayload = { providerId, name, category, issueDate, validUntil: expiryDate };
    const sha256Hash = computeSHA256(certPayload);
    let receipt;
    try {
      const contract = getContract({ write: true });
      const transaction = await contract.issueCertificate(providerId, sha256Hash, validUntil);
      receipt = await transaction.wait();
    } catch (error) {
      throw blockchainError(error);
    }
    const transactionHash = receipt.hash || receipt.transactionHash;
    const qrCodeUrl = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/verify/guide/${encodeURIComponent(providerId)}`;
    const certificateData = {
      id: existing?.id || `cert-${Date.now()}`,
      certificate_id: certificateId,
      provider_id: providerId,
      name,
      category,
      district,
      issue_date: issueDate,
      valid_until: expiryDate,
      issuer,
      sha256_hash: sha256Hash,
      ipfs_hash: null,
      blockchain_tx_hash: transactionHash,
      block_number: receipt.blockNumber || null,
      status: 'valid',
      qr_code_url: qrCodeUrl
    };
    const newCert = existing
      ? db.certificates.updateBlockchainRecord(certificateData)
      : db.certificates.create(certificateData);
    db.blockchainTransactions.create({
      tx_hash: transactionHash,
      contract_address: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS,
      action: 'CERTIFICATE_ISSUED',
      payload: { providerId, certificateHash: sha256Hash, validUntil },
      status: 'confirmed',
      block_number: receipt.blockNumber
    });

    // Update provider profile status to approved
    db.providerProfiles.updateStatus(providerId, 'approved');

    // Notify provider
    db.notifications.create({
      id: `notif-${Date.now()}`,
      user_id: providerId,
      role: 'vendor',
      title: 'KYC Verified & Certificate Issued',
      message: `Your credentials have been verified and Digital Certificate #${certificateId} has been minted with SHA-256 hash ${sha256Hash.slice(0, 16)}...`,
      type: 'kyc'
    });

    return { certificate: newCert, transactionHash, network: NETWORK, contractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS };
  },

  async revokeCertificate(providerId) {
    if (!providerId) throw new Error('Provider ID is required.');
    try {
      const contract = getContract({ write: true });
      const transaction = await contract.revokeCertificate(String(providerId).trim());
      const receipt = await transaction.wait();
      const transactionHash = receipt.hash || receipt.transactionHash;
      db.providerProfiles.updateStatus(providerId, 'revoked');
      db.certificates.markRevoked(providerId);
      db.blockchainTransactions.create({
        tx_hash: transactionHash,
        contract_address: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS,
        action: 'CERTIFICATE_REVOKED',
        payload: { providerId },
        status: 'confirmed',
        block_number: receipt.blockNumber
      });
      return { providerId, transactionHash, status: 'revoked', network: NETWORK, contractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS };
    } catch (error) {
      throw blockchainError(error);
    }
  },

  /**
   * Release Escrow funds upon service completion
   */
  releaseEscrow(bookingId, confirmedBy) {
    const booking = db.bookings.findById(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found.`);
    }

    if (booking.escrow_status !== 'locked') {
      throw new Error(`Escrow funds for booking ${bookingId} are already ${booking.escrow_status}.`);
    }

    const updated = db.bookings.settleEscrow(bookingId);

    // Record blockchain ledger transaction
    const txHash = '0x' + crypto.createHash('sha256').update(bookingId + Date.now() + 'RELEASE').digest('hex');
    db.blockchainTransactions.create({
      id: `tx-${Date.now()}`,
      tx_hash: txHash,
      contract_address: booking.contract_address,
      action: 'ESCROW_SETTLEMENT_RELEASE',
      from_address: '0xEscrowVault',
      to_address: booking.provider_id,
      payload: {
        bookingId,
        amount: booking.total_amount,
        settledBy: confirmedBy
      },
      status: 'confirmed',
      block_number: 10430
    });

    return { success: true, booking: updated, txHash };
  },

  /**
   * Refund Escrow funds to tourist
   */
  refundEscrow(bookingId, reason = 'Tour cancelled or provider did not attend') {
    const booking = db.bookings.findById(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found.`);
    }

    const updated = db.bookings.refundEscrow(bookingId, reason);

    if (booking.item_type === 'product' && booking.item_id) {
      db.products.restoreStock(booking.item_id);
    }

    const txHash = '0x' + crypto.createHash('sha256').update(bookingId + Date.now() + 'REFUND').digest('hex');
    db.blockchainTransactions.create({
      id: `tx-${Date.now()}`,
      tx_hash: txHash,
      contract_address: booking.contract_address,
      action: 'ESCROW_REFUND_TRIGGER',
      from_address: '0xEscrowVault',
      to_address: booking.user_id,
      payload: {
        bookingId,
        amount: booking.total_amount,
        reason
      },
      status: 'confirmed',
      block_number: 10431
    });

    return { success: true, booking: updated, txHash };
  },

  /**
   * Retrieve immutable audit transactions
   */
  getAuditLedger(user = null) {
    const transactions = db.blockchainTransactions.listRecent(50).map((transaction) => ({
      ...transaction,
      network: transaction.network || NETWORK
    }));
    if (!user || user.role === 'admin') return transactions;

    return transactions.filter((transaction) => {
      const payload = transaction.payload || {};
      if (user.role === 'tourist') {
        return transaction.from_address === user.id || payload.touristId === user.id || payload.userId === user.id;
      }
      if (['vendor', 'guide'].includes(user.role)) {
        return transaction.to_address === user.id || payload.providerId === user.id || payload.ownerId === user.id;
      }
      return false;
    });
  }
};
