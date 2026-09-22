import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(__dirname, '../../', process.env.SQLITE_DB_PATH)
  : path.resolve(__dirname, 'jharkhand_tourism.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite with WAL mode & foreign keys
export const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Initialize schema
const schemaPath = path.resolve(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  sqlite.exec(schemaSql);
}
// Older installations predate destination bookings. Rebuild the small bookings
// table when necessary so the CHECK constraint matches the current schema.
try {
  const bookingSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bookings'").get()?.sql || '';
  if (!bookingSql.includes("'destination'")) {
    sqlite.pragma('foreign_keys = OFF');
    sqlite.exec(`
      ALTER TABLE bookings RENAME TO bookings_legacy;
      CREATE TABLE bookings (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
        provider_id TEXT REFERENCES users(id),
        item_type TEXT NOT NULL CHECK(item_type IN ('product','service','package','homestay','guide','destination')),
        item_id TEXT NOT NULL, item_title TEXT NOT NULL, travelers INTEGER DEFAULT 1,
        check_in_date TEXT, check_out_date TEXT, days INTEGER DEFAULT 1,
        total_amount REAL NOT NULL, escrow_amount REAL NOT NULL,
        escrow_status TEXT NOT NULL CHECK(escrow_status IN ('locked','released','refunded')),
        contract_address TEXT, contract_tx_hash TEXT,
        status TEXT NOT NULL CHECK(status IN ('initiated','payment_pending','confirmed','in_progress','completed','cancelled','refunded')),
        cancellation_reason TEXT, settled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO bookings SELECT id,user_id,provider_id,item_type,item_id,item_title,travelers,
        check_in_date,check_out_date,days,total_amount,escrow_amount,escrow_status,
        contract_address,contract_tx_hash,status,cancellation_reason,settled_at,created_at,updated_at
        FROM bookings_legacy;
      DROP TABLE bookings_legacy;
      CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
    `);
    sqlite.pragma('foreign_keys = ON');
  }
} catch (migrationError) {
  sqlite.pragma('foreign_keys = ON');
  console.warn('[Database] Booking migration skipped:', migrationError.message);
}
try { sqlite.exec('ALTER TABLE users ADD COLUMN profile_image TEXT'); } catch { /* column already exists */ }
try { sqlite.exec("ALTER TABLE tourist_profiles ADD COLUMN nationality TEXT DEFAULT 'Indian'"); } catch { /* column already exists */ }
try { sqlite.exec('ALTER TABLE tourist_profiles ADD COLUMN state TEXT'); } catch { /* column already exists */ }
try { sqlite.exec('ALTER TABLE provider_profiles ADD COLUMN address TEXT'); } catch { /* column already exists */ }
try { sqlite.exec('ALTER TABLE provider_profiles ADD COLUMN state TEXT'); } catch { /* column already exists */ }
try { sqlite.exec("ALTER TABLE tourist_profiles ADD COLUMN country_of_residence TEXT DEFAULT 'India'"); } catch { /* column already exists */ }
try { sqlite.exec('ALTER TABLE tourist_profiles ADD COLUMN date_of_birth TEXT'); } catch { /* column already exists */ }
try { sqlite.exec("ALTER TABLE tourist_profiles ADD COLUMN preferred_language TEXT DEFAULT 'English'"); } catch { /* column already exists */ }
try { sqlite.exec("ALTER TABLE services ADD COLUMN review_reason TEXT"); } catch { /* column already exists */ }
try { sqlite.exec("ALTER TABLE services ADD COLUMN reviewed_at DATETIME"); } catch { /* column already exists */ }
try { sqlite.exec("ALTER TABLE services ADD COLUMN reviewed_by TEXT"); } catch { /* column already exists */ }
try {
  const serviceSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'services'").get()?.sql || '';
  if (serviceSql && (!serviceSql.includes('changes_requested') || !serviceSql.includes("'restaurant'"))) {
    sqlite.pragma('foreign_keys = OFF');
    sqlite.exec(`
      ALTER TABLE services RENAME TO services_legacy;
      CREATE TABLE services (
        id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL, description TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('guide','homestay','package','transport','restaurant')),
        price REAL NOT NULL, district TEXT NOT NULL, duration_days INTEGER DEFAULT 1,
        image TEXT, amenities TEXT DEFAULT '[]', availability TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        approval_status TEXT DEFAULT 'approved' CHECK(approval_status IN ('pending','approved','rejected','changes_requested')),
        review_reason TEXT, reviewed_at DATETIME, reviewed_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO services (id, provider_id, title, description, category, price, district, duration_days, image, amenities, availability, is_active, approval_status, review_reason, reviewed_at, reviewed_by, created_at, updated_at)
        SELECT id, provider_id, title, description, category, price, district, duration_days, image, amenities, availability, is_active, approval_status, review_reason, reviewed_at, reviewed_by, created_at, updated_at FROM services_legacy;
      DROP TABLE services_legacy;
      CREATE INDEX IF NOT EXISTS idx_services_provider ON services(provider_id);
      CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
    `);
    sqlite.pragma('foreign_keys = ON');
  }
} catch (serviceMigrationError) {
  sqlite.pragma('foreign_keys = ON');
  console.warn('[Database] Service status migration skipped:', serviceMigrationError.message);
}

// Helper to safely parse JSON
export function safeJSONParse(str, fallback = null) {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Transaction wrapper helper
export function runTransaction(fn) {
  return sqlite.transaction(fn)();
}

export const db = {
  raw: sqlite,
  runTransaction,

  // Users
  users: {
    findById: (id) => sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id),
    findByEmail: (email) => sqlite.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email),
    list: ({ role, search, limit = 50, offset = 0 } = {}) => {
      let query = 'SELECT id, name, email, phone, role, is_email_verified, is_active, created_at FROM users WHERE 1=1';
      const params = [];
      if (role) {
        query += ' AND role = ?';
        params.push(role);
      }
      if (search) {
        query += ' AND (LOWER(name) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?))';
        params.push(`%${search}%`, `%${search}%`);
      }
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      return sqlite.prepare(query).all(...params);
    },
    count: ({ role } = {}) => {
      let query = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
      const params = [];
      if (role) {
        query += ' AND role = ?';
        params.push(role);
      }
      return sqlite.prepare(query).get(...params).count;
    },
    create: (user) => {
      const stmt = sqlite.prepare(`
        INSERT INTO users (id, name, email, phone, password_hash, role, is_email_verified, is_active, created_at, updated_at)
        VALUES (@id, @name, LOWER(@email), @phone, @password_hash, @role, @is_email_verified, @is_active, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      stmt.run(user);
      return db.users.findById(user.id);
    },
    updateEmailVerified: (email) => {
      sqlite.prepare('UPDATE users SET is_email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER(?)').run(email);
    },
    updatePassword: (email, passwordHash) => {
      sqlite.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER(?)').run(passwordHash, email);
    },
    updateProfile: (id, { name, phone, profileImage }) => {
      sqlite.prepare('UPDATE users SET name = ?, phone = ?, profile_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, phone || null, profileImage || null, id);
      return db.users.findById(id);
    },
    toggleActive: (id, isActive) => {
      sqlite.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(isActive ? 1 : 0, id);
      return db.users.findById(id);
    }
  },

  // Email OTPs
  otps: {
    create: (otp) => {
      sqlite.prepare(`
        INSERT INTO email_otps (id, email, otp_hash, type, expires_at, attempts, resend_cooldown_until, is_used, created_at)
        VALUES (@id, LOWER(@email), @otp_hash, @type, @expires_at, 0, @resend_cooldown_until, 0, CURRENT_TIMESTAMP)
      `).run(otp);
    },
    getLatestValid: (email, type) => {
      return sqlite.prepare(`
        SELECT * FROM email_otps
        WHERE LOWER(email) = LOWER(?) AND type = ? AND is_used = 0 AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC LIMIT 1
      `).get(email, type);
    },
    incrementAttempts: (id) => {
      sqlite.prepare('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?').run(id);
    },
    markUsed: (id) => {
      sqlite.prepare('UPDATE email_otps SET is_used = 1 WHERE id = ?').run(id);
    }
  },

  // Tourist Profiles
  touristProfiles: {
    findByUserId: (userId) => {
      const row = sqlite.prepare('SELECT * FROM tourist_profiles WHERE user_id = ?').get(userId);
      if (!row) return null;
      return { ...row, interests: safeJSONParse(row.interests, []) };
    },
    upsert: (profile) => {
      sqlite.prepare(`
        INSERT INTO tourist_profiles (user_id, budget, travel_duration, interests, starting_location, group_size, group_type, nationality, state, date_of_birth, bio, updated_at)
        VALUES (@user_id, @budget, @travel_duration, @interests, @starting_location, @group_size, @group_type, @nationality, @state, @date_of_birth, @bio, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          budget = excluded.budget,
          travel_duration = excluded.travel_duration,
          interests = excluded.interests,
          starting_location = excluded.starting_location,
          group_size = excluded.group_size,
          group_type = excluded.group_type,
          nationality = excluded.nationality,
          state = excluded.state,
          date_of_birth = excluded.date_of_birth,
          bio = excluded.bio,
          updated_at = CURRENT_TIMESTAMP
      `).run({
        ...profile,
        nationality: profile.nationality || 'Indian',
        state: profile.state || null,
        date_of_birth: profile.date_of_birth || null,
        interests: typeof profile.interests === 'object' ? JSON.stringify(profile.interests) : profile.interests
      });
      return db.touristProfiles.findByUserId(profile.user_id);
    }
  },

  // Provider Profiles
  providerProfiles: {
    findByUserId: (userId) => {
      const row = sqlite.prepare('SELECT * FROM provider_profiles WHERE user_id = ?').get(userId);
      if (!row) return null;
      return {
        ...row,
        languages: safeJSONParse(row.languages, []),
        payout_details: safeJSONParse(row.payout_details, {})
      };
    },
    upsert: (profile) => {
      sqlite.prepare(`
        INSERT INTO provider_profiles (user_id, provider_type, business_name, license_number, district, address, state, service_area, specialization, languages, daily_rate, verification_status, rejection_reason, payout_details, updated_at)
        VALUES (@user_id, @provider_type, @business_name, @license_number, @district, @address, @state, @service_area, @specialization, @languages, @daily_rate, @verification_status, @rejection_reason, @payout_details, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          provider_type = excluded.provider_type,
          business_name = excluded.business_name,
          license_number = excluded.license_number,
          district = excluded.district,
          address = excluded.address,
          state = excluded.state,
          service_area = excluded.service_area,
          specialization = excluded.specialization,
          languages = excluded.languages,
          daily_rate = excluded.daily_rate,
          verification_status = excluded.verification_status,
          rejection_reason = excluded.rejection_reason,
          payout_details = excluded.payout_details,
          updated_at = CURRENT_TIMESTAMP
      `).run({
        ...profile,
        languages: typeof profile.languages === 'object' ? JSON.stringify(profile.languages) : profile.languages,
        payout_details: typeof profile.payout_details === 'object' ? JSON.stringify(profile.payout_details) : profile.payout_details
      });
      return db.providerProfiles.findByUserId(profile.user_id);
    },
    updateStatus: (userId, status, reason = null) => {
      sqlite.prepare('UPDATE provider_profiles SET verification_status = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(status, reason, userId);
      return db.providerProfiles.findByUserId(userId);
    },
    list: ({ status, district, limit = 50 } = {}) => {
      let query = `
        SELECT p.*, u.name, u.email, u.phone
        FROM provider_profiles p
        JOIN users u ON p.user_id = u.id
        WHERE 1=1
      `;
      const params = [];
      if (status) {
        query += ' AND p.verification_status = ?';
        params.push(status);
      }
      if (district) {
        query += ' AND p.district = ?';
        params.push(district);
      }
      query += ' ORDER BY p.created_at DESC LIMIT ?';
      params.push(limit);
      return sqlite.prepare(query).all(...params).map(r => ({
        ...r,
        languages: safeJSONParse(r.languages, []),
        payout_details: safeJSONParse(r.payout_details, {})
      }));
    }
  },

  // Verification Requests & KYC Documents
  verificationRequests: {
    create: (req) => {
      sqlite.prepare(`
        INSERT INTO verification_requests (id, provider_id, status, documents, admin_notes, submitted_at)
        VALUES (@id, @provider_id, @status, @documents, @admin_notes, CURRENT_TIMESTAMP)
      `).run({
        ...req,
        documents: typeof req.documents === 'object' ? JSON.stringify(req.documents) : req.documents
      });
      return db.verificationRequests.findById(req.id);
    },
    findById: (id) => {
      const row = sqlite.prepare('SELECT * FROM verification_requests WHERE id = ?').get(id);
      if (!row) return null;
      return { ...row, documents: safeJSONParse(row.documents, []) };
    },
    findByProviderId: (providerId) => {
      const rows = sqlite.prepare('SELECT * FROM verification_requests WHERE provider_id = ? ORDER BY submitted_at DESC').all(providerId);
      return rows.map(r => ({ ...r, documents: safeJSONParse(r.documents, []) }));
    },
    reserveAvailability: (id, quantity = 1) => {
      const service = db.services.findById(id);
      const availableRooms = Number(service?.availability?.availableRooms);
      if (!service || !Number.isFinite(availableRooms) || availableRooms <= 0 || availableRooms < quantity) return false;
      const availability = { ...service.availability, availableRooms: availableRooms - quantity };
      sqlite.prepare('UPDATE services SET availability = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(availability), id);
      return true;
    },
    listPending: () => {
      const rows = sqlite.prepare(`
        SELECT v.*, u.name as provider_name, u.email as provider_email, p.business_name, p.provider_type, p.district
        FROM verification_requests v
        JOIN users u ON v.provider_id = u.id
        LEFT JOIN provider_profiles p ON v.provider_id = p.user_id
        WHERE v.status IN ('pending', 'under_review')
        ORDER BY v.submitted_at ASC
      `).all();
      return rows.map(r => ({ ...r, documents: safeJSONParse(r.documents, []) }));
    },
    updateStatus: (id, status, notes = '', reviewerId = null) => {
      sqlite.prepare(`
        UPDATE verification_requests
        SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, notes, reviewerId, id);
    }
  },

  // Certificates
  certificates: {
    create: (cert) => {
      sqlite.prepare(`
        INSERT INTO certificates (id, certificate_id, provider_id, name, category, district, issue_date, valid_until, issuer, sha256_hash, ipfs_hash, blockchain_tx_hash, block_number, status, qr_code_url, created_at)
        VALUES (@id, @certificate_id, @provider_id, @name, @category, @district, @issue_date, @valid_until, @issuer, @sha256_hash, @ipfs_hash, @blockchain_tx_hash, @block_number, @status, @qr_code_url, CURRENT_TIMESTAMP)
      `).run(cert);
      return db.certificates.findByCertificateId(cert.certificate_id);
    },
    findByCertificateId: (certId) => sqlite.prepare('SELECT * FROM certificates WHERE certificate_id = ?').get(certId),
    findByProviderId: (providerId) => sqlite.prepare('SELECT * FROM certificates WHERE provider_id = ? ORDER BY created_at DESC LIMIT 1').get(providerId),
    findByHashOrId: (term) => {
      return sqlite.prepare(`
        SELECT * FROM certificates
        WHERE LOWER(certificate_id) = LOWER(?) OR LOWER(sha256_hash) = LOWER(?) OR LOWER(provider_id) = LOWER(?) OR LOWER(blockchain_tx_hash) = LOWER(?)
        LIMIT 1
      `).get(term, term, term, term);
    },
    listValid: () => sqlite.prepare("SELECT * FROM certificates WHERE status = 'valid' ORDER BY created_at DESC").all(),
    countValid: () => sqlite.prepare("SELECT COUNT(*) as count FROM certificates WHERE status = 'valid'").get().count
  },

  // Blockchain Transactions
  blockchainTransactions: {
    create: (tx) => {
      sqlite.prepare(`
        INSERT INTO blockchain_transactions (id, tx_hash, contract_address, action, from_address, to_address, payload, status, block_number, created_at)
        VALUES (@id, @tx_hash, @contract_address, @action, @from_address, @to_address, @payload, @status, @block_number, CURRENT_TIMESTAMP)
      `).run({
        id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        tx_hash: tx.tx_hash,
        contract_address: tx.contract_address || null,
        action: tx.action || 'TRANSACTION',
        from_address: tx.from_address || '0x0000000000000000000000000000000000000000',
        to_address: tx.to_address || '0x0000000000000000000000000000000000000000',
        payload: typeof tx.payload === 'object' ? JSON.stringify(tx.payload) : (tx.payload || null),
        status: tx.status || 'confirmed',
        block_number: tx.block_number || Math.floor(10000 + Math.random() * 5000)
      });
    },
    listRecent: (limit = 10) => {
      return sqlite.prepare('SELECT * FROM blockchain_transactions ORDER BY created_at DESC LIMIT ?').all(limit).map(r => ({
        ...r,
        payload: safeJSONParse(r.payload, {})
      }));
    }
  },

  // Destinations
  destinations: {
    list: ({ search, category, district, onlyActive = true } = {}) => {
      let query = 'SELECT * FROM destinations WHERE 1=1';
      const params = [];
      if (onlyActive) {
        query += ' AND is_active = 1';
      }
      if (category && category !== 'All') {
        query += ' AND LOWER(category) LIKE LOWER(?)';
        params.push(`%${category}%`);
      }
      if (district && district !== 'All') {
        query += ' AND LOWER(district) = LOWER(?)';
        params.push(district);
      }
      if (search) {
        const searchTerm = `%${String(search).trim()}%`;
        query += ` AND (
          LOWER(name) LIKE LOWER(?) OR
          LOWER(title) LIKE LOWER(?) OR
          LOWER(district) LIKE LOWER(?) OR
          LOWER(category) LIKE LOWER(?) OR
          LOWER(description) LIKE LOWER(?) OR
          LOWER(attractions) LIKE LOWER(?) OR
          LOWER(activities) LIKE LOWER(?)
        )`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }
      query += ' ORDER BY rating DESC, review_count DESC';
      return sqlite.prepare(query).all(...params).map(r => ({
        ...r,
        attractions: safeJSONParse(r.attractions, []),
        activities: safeJSONParse(r.activities, []),
        nearby_hotels: safeJSONParse(r.nearby_hotels, []),
        interests: safeJSONParse(r.interests, [])
      }));
    },
    findById: (id) => {
      const row = sqlite.prepare('SELECT * FROM destinations WHERE id = ? OR slug = ?').get(id, id);
      if (!row) return null;
      return {
        ...row,
        attractions: safeJSONParse(row.attractions, []),
        activities: safeJSONParse(row.activities, []),
        nearby_hotels: safeJSONParse(row.nearby_hotels, []),
        interests: safeJSONParse(row.interests, [])
      };
    },
    create: (dest) => {
      sqlite.prepare(`
        INSERT INTO destinations (id, slug, name, title, district, category, lat, lng, rating, review_count, avg_cost, best_season, crowd_level, image, description, opening_hours, ticket_info, attractions, activities, nearby_hotels, interests, is_active, created_at, updated_at)
        VALUES (@id, @slug, @name, @title, @district, @category, @lat, @lng, @rating, @review_count, @avg_cost, @best_season, @crowd_level, @image, @description, @opening_hours, @ticket_info, @attractions, @activities, @nearby_hotels, @interests, @is_active, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run({
        ...dest,
        rating: dest.rating ?? 0,
        review_count: dest.review_count ?? 0,
        avg_cost: dest.avg_cost ?? 0,
        best_season: dest.best_season || 'October to March',
        crowd_level: dest.crowd_level || 'Moderate',
        title: dest.title || dest.name,
        description: dest.description || 'Scenic destination in Jharkhand.',
        opening_hours: dest.opening_hours || 'Sunrise to Sunset',
        ticket_info: dest.ticket_info || 'Entry information unavailable.',
        image: dest.image || '',
        is_active: dest.is_active ?? 1,
        attractions: typeof dest.attractions === 'object' ? JSON.stringify(dest.attractions) : (dest.attractions || '[]'),
        activities: typeof dest.activities === 'object' ? JSON.stringify(dest.activities) : (dest.activities || '[]'),
        nearby_hotels: typeof dest.nearby_hotels === 'object' ? JSON.stringify(dest.nearby_hotels) : (dest.nearby_hotels || '[]'),
        interests: typeof dest.interests === 'object' ? JSON.stringify(dest.interests) : (dest.interests || '["nature"]')
      });
      return db.destinations.findById(dest.id);
    },
    update: (id, updates) => {
      const existing = db.destinations.findById(id);
      if (!existing) return null;
      const merged = { ...existing, ...updates };
      sqlite.prepare(`
        UPDATE destinations SET
          name = @name,
          title = @title,
          district = @district,
          category = @category,
          lat = @lat,
          lng = @lng,
          avg_cost = @avg_cost,
          best_season = @best_season,
          crowd_level = @crowd_level,
          image = @image,
          description = @description,
          opening_hours = @opening_hours,
          ticket_info = @ticket_info,
          attractions = @attractions,
          activities = @activities,
          nearby_hotels = @nearby_hotels,
          interests = @interests,
          is_active = @is_active,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        ...merged,
        attractions: typeof merged.attractions === 'object' ? JSON.stringify(merged.attractions) : merged.attractions,
        activities: typeof merged.activities === 'object' ? JSON.stringify(merged.activities) : merged.activities,
        nearby_hotels: typeof merged.nearby_hotels === 'object' ? JSON.stringify(merged.nearby_hotels) : merged.nearby_hotels,
        interests: typeof merged.interests === 'object' ? JSON.stringify(merged.interests) : merged.interests
      });
      return db.destinations.findById(id);
    },
    delete: (id) => sqlite.prepare('DELETE FROM destinations WHERE id = ?').run(id),
    count: () => sqlite.prepare('SELECT COUNT(*) as count FROM destinations WHERE is_active = 1').get().count
  },

  // Products
  products: {
    list: ({ category, district, search, onlyApproved = true, limit = 50 } = {}) => {
      let query = `
        SELECT pr.*, u.name as vendor_name, p.verification_status as vendor_verified
        FROM products pr
        JOIN users u ON pr.vendor_id = u.id
        LEFT JOIN provider_profiles p ON pr.vendor_id = p.user_id
        WHERE pr.is_active = 1
      `;
      const params = [];
      if (onlyApproved) {
        query += " AND pr.approval_status = 'approved'";
      }
      if (category && category !== 'All') {
        query += ' AND LOWER(pr.category) = LOWER(?)';
        params.push(category);
      }
      if (district && district !== 'All') {
        query += ' AND LOWER(pr.district) = LOWER(?)';
        params.push(district);
      }
      if (search) {
        query += ' AND (LOWER(pr.name) LIKE LOWER(?) OR LOWER(pr.description) LIKE LOWER(?))';
        params.push(`%${search}%`, `%${search}%`);
      }
      query += ' ORDER BY pr.created_at DESC LIMIT ?';
      params.push(limit);
      return sqlite.prepare(query).all(...params);
    },
    findById: (id) => sqlite.prepare('SELECT * FROM products WHERE id = ?').get(id),
    findByVendorId: (vendorId) => sqlite.prepare('SELECT * FROM products WHERE vendor_id = ? ORDER BY created_at DESC').all(vendorId),
    reserveStock: (id, quantity = 1) => {
      const result = sqlite.prepare(`
        UPDATE products
        SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1 AND approval_status = 'approved' AND stock >= ?
      `).run(quantity, id, quantity);
      return result.changes > 0;
    },
    restoreStock: (id, quantity = 1) => {
      sqlite.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quantity, id);
    },
    create: (prod) => {
      sqlite.prepare(`
        INSERT INTO products (id, vendor_id, name, description, category, price, stock, district, material, image, badge, is_active, approval_status, created_at, updated_at)
        VALUES (@id, @vendor_id, @name, @description, @category, @price, @stock, @district, @material, @image, @badge, @is_active, @approval_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(prod);
      return db.products.findById(prod.id);
    },
    update: (id, updates) => {
      const existing = db.products.findById(id);
      if (!existing) return null;
      const merged = { ...existing, ...updates };
      sqlite.prepare(`
        UPDATE products SET
          name = @name,
          description = @description,
          category = @category,
          price = @price,
          stock = @stock,
          district = @district,
          material = @material,
          image = @image,
          badge = @badge,
          is_active = @is_active,
          approval_status = @approval_status,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run(merged);
      return db.products.findById(id);
    },
    delete: (id) => sqlite.prepare('DELETE FROM products WHERE id = ?').run(id),
    count: () => sqlite.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get().count
  },

  // Services (Guides & Homestays)
  services: {
    list: ({ category, district } = {}) => {
      let query = `
        SELECT s.*, u.name as provider_name, p.verification_status as provider_verified, p.rating as provider_rating
        FROM services s
        JOIN users u ON s.provider_id = u.id
        LEFT JOIN provider_profiles p ON s.provider_id = p.user_id
        WHERE s.is_active = 1
          AND u.is_active = 1
          AND s.approval_status = 'approved'
          AND (s.category = 'package' OR p.verification_status = 'approved')
      `;
      const params = [];
      if (category && category !== 'All') {
        query += ' AND s.category = ?';
        params.push(category);
      }
      if (district && district !== 'All') {
        query += ' AND s.district = ?';
        params.push(district);
      }
      query += ' ORDER BY s.created_at DESC';
      return sqlite.prepare(query).all(...params).map(r => ({
        ...r,
        amenities: safeJSONParse(r.amenities, []),
        availability: safeJSONParse(r.availability, {})
      }));
    },
    findById: (id) => {
      const row = sqlite.prepare('SELECT * FROM services WHERE id = ?').get(id);
      if (!row) return null;
      return {
        ...row,
        amenities: safeJSONParse(row.amenities, []),
        availability: safeJSONParse(row.availability, {})
      };
    },
    findByProviderId: (providerId) => {
      return sqlite.prepare('SELECT * FROM services WHERE provider_id = ? ORDER BY created_at DESC').all(providerId).map(r => ({
        ...r,
        amenities: safeJSONParse(r.amenities, []),
        availability: safeJSONParse(r.availability, {})
      }));
    },
    listAll: ({ status } = {}) => {
      let query = `
        SELECT s.*, u.name as provider_name, u.email as provider_email,
          p.business_name, p.verification_status as provider_verification_status
        FROM services s
        JOIN users u ON s.provider_id = u.id
        LEFT JOIN provider_profiles p ON s.provider_id = p.user_id
      `;
      const params = [];
      if (status) {
        query += ' WHERE s.approval_status = ?';
        params.push(status);
      }
      query += ' ORDER BY s.created_at DESC';
      return sqlite.prepare(query).all(...params).map(r => ({
        ...r,
        amenities: safeJSONParse(r.amenities, []),
        availability: safeJSONParse(r.availability, {})
      }));
    },
    review: (id, status, reason, reviewerId) => {
      sqlite.prepare(`
        UPDATE services
        SET approval_status = ?, review_reason = ?, reviewed_at = CURRENT_TIMESTAMP,
            reviewed_by = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, reason || null, reviewerId, status === 'approved' ? 1 : 0, id);
      return db.services.findById(id);
    },
    create: (srv) => {
      sqlite.prepare(`
        INSERT INTO services (id, provider_id, title, description, category, price, district, duration_days, image, amenities, availability, is_active, approval_status, created_at, updated_at)
        VALUES (@id, @provider_id, @title, @description, @category, @price, @district, @duration_days, @image, @amenities, @availability, @is_active, @approval_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run({
        ...srv,
        amenities: typeof srv.amenities === 'object' ? JSON.stringify(srv.amenities) : (srv.amenities || '[]'),
        availability: typeof srv.availability === 'object' ? JSON.stringify(srv.availability) : (srv.availability || '{}')
      });
      return db.services.findById(srv.id);
    }
  },

  // Bookings
  bookings: {
    create: (booking) => {
      sqlite.prepare(`
        INSERT INTO bookings (id, user_id, provider_id, item_type, item_id, item_title, travelers, check_in_date, check_out_date, days, total_amount, escrow_amount, escrow_status, contract_address, contract_tx_hash, status, cancellation_reason, created_at, updated_at)
        VALUES (@id, @user_id, @provider_id, @item_type, @item_id, @item_title, @travelers, @check_in_date, @check_out_date, @days, @total_amount, @escrow_amount, @escrow_status, @contract_address, @contract_tx_hash, @status, @cancellation_reason, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(booking);
      return db.bookings.findById(booking.id);
    },
    findById: (id) => {
      return sqlite.prepare(`
        SELECT b.*, u.name as user_name, u.email as user_email, p.name as provider_name
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN users p ON b.provider_id = p.id
        WHERE b.id = ?
      `).get(id);
    },
    findByUserId: (userId) => {
      return sqlite.prepare(`
        SELECT b.*, p.name as provider_name
        FROM bookings b
        LEFT JOIN users p ON b.provider_id = p.id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC
      `).all(userId);
    },
    findByProviderId: (providerId) => {
      return sqlite.prepare(`
        SELECT b.*, u.name as user_name, u.email as user_email
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        WHERE b.provider_id = ?
        ORDER BY b.created_at DESC
      `).all(providerId);
    },
    listAll: (limit = 50) => {
      return sqlite.prepare(`
        SELECT b.*, u.name as user_name, p.name as provider_name
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN users p ON b.provider_id = p.id
        ORDER BY b.created_at DESC LIMIT ?
      `).all(limit);
    },
    updateStatus: (id, status, escrowStatus = null) => {
      if (escrowStatus) {
        sqlite.prepare('UPDATE bookings SET status = ?, escrow_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, escrowStatus, id);
      } else {
        sqlite.prepare('UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
      }
      return db.bookings.findById(id);
    },
    settleEscrow: (id) => {
      sqlite.prepare("UPDATE bookings SET status = 'completed', escrow_status = 'released', settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      return db.bookings.findById(id);
    },
    refundEscrow: (id, reason) => {
      sqlite.prepare("UPDATE bookings SET status = 'refunded', escrow_status = 'refunded', cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(reason, id);
      return db.bookings.findById(id);
    },
    stats: () => {
      const counts = sqlite.prepare(`
        SELECT
          COUNT(*) as totalBookings,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as activeBookings,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedBookings,
          SUM(CASE WHEN status = 'cancelled' OR status = 'refunded' THEN 1 ELSE 0 END) as cancelledBookings,
          COALESCE(SUM(total_amount), 0) as grossRevenue,
          COALESCE(SUM(CASE WHEN escrow_status = 'locked' THEN escrow_amount ELSE 0 END), 0) as escrowLocked
        FROM bookings
      `).get();
      return counts;
    }
  },

  // Payments
  payments: {
    create: (pay) => {
      sqlite.prepare(`
        INSERT INTO payments (id, booking_id, user_id, gateway, gateway_order_id, gateway_payment_id, gateway_signature, amount, currency, status, created_at)
        VALUES (@id, @booking_id, @user_id, @gateway, @gateway_order_id, @gateway_payment_id, @gateway_signature, @amount, @currency, @status, CURRENT_TIMESTAMP)
      `).run(pay);
    },
    updateStatus: (id, status, paymentId = null, signature = null) => {
      sqlite.prepare('UPDATE payments SET status = ?, gateway_payment_id = COALESCE(?, gateway_payment_id), gateway_signature = COALESCE(?, gateway_signature) WHERE id = ?').run(status, paymentId, signature, id);
    },
    findById: (id) => sqlite.prepare('SELECT * FROM payments WHERE id = ?').get(id),
    findByGatewayOrderId: (orderId) => sqlite.prepare('SELECT * FROM payments WHERE gateway_order_id = ?').get(orderId),
    findByBookingId: (bookingId) => sqlite.prepare('SELECT * FROM payments WHERE booking_id = ?').get(bookingId),
    listAll: (limit = 50) => sqlite.prepare('SELECT * FROM payments ORDER BY created_at DESC LIMIT ?').all(limit)
  },

  // Reviews
  reviews: {
    create: (rev) => {
      sqlite.prepare(`
        INSERT INTO reviews (id, booking_id, user_id, user_name, target_type, target_id, rating, review_text, sentiment, compound_score, emotion, aspects, is_flagged, created_at)
        VALUES (@id, @booking_id, @user_id, @user_name, @target_type, @target_id, @rating, @review_text, @sentiment, @compound_score, @emotion, @aspects, @is_flagged, CURRENT_TIMESTAMP)
      `).run({
        ...rev,
        aspects: typeof rev.aspects === 'object' ? JSON.stringify(rev.aspects) : rev.aspects
      });
      return db.reviews.findById(rev.id);
    },
    findById: (id) => {
      const row = sqlite.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
      if (!row) return null;
      return { ...row, aspects: safeJSONParse(row.aspects, {}) };
    },
    listByTarget: (targetType, targetId) => {
      return sqlite.prepare('SELECT * FROM reviews WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC').all(targetType, targetId).map(r => ({
        ...r,
        aspects: safeJSONParse(r.aspects, {})
      }));
    },
    listAll: (limit = 50) => {
      return sqlite.prepare('SELECT * FROM reviews ORDER BY created_at DESC LIMIT ?').all(limit).map(r => ({
        ...r,
        aspects: safeJSONParse(r.aspects, {})
      }));
    },
    stats: () => {
      const reviews = sqlite.prepare('SELECT * FROM reviews').all();
      const total = reviews.length;
      if (total === 0) return null;

      const counts = { Positive: 0, Neutral: 0, Negative: 0 };
      const aspectSums = { cleanliness: 0, hospitality: 0, transport: 0, food: 0, safety: 0 };

      reviews.forEach(r => {
        counts[r.sentiment] = (counts[r.sentiment] || 0) + 1;
        const asp = safeJSONParse(r.aspects, {});
        for (const k in aspectSums) {
          aspectSums[k] += asp[k] || 4.0;
        }
      });

      const aspectScores = {};
      for (const k in aspectSums) {
        aspectScores[k] = Math.round((aspectSums[k] / total) * 10) / 10;
      }

      return {
        totalReviews: total,
        sentimentDistribution: {
          positivePercent: Math.round((counts.Positive / total) * 100),
          neutralPercent: Math.round((counts.Neutral / total) * 100),
          negativePercent: Math.round((counts.Negative / total) * 100),
          rawCounts: counts
        },
        aspectScores
      };
    }
  },

  // Notifications
  notifications: {
    create: (notif) => {
      sqlite.prepare(`
        INSERT INTO notifications (id, user_id, role, title, message, type, is_read, created_at)
        VALUES (@id, @user_id, @role, @title, @message, @type, 0, CURRENT_TIMESTAMP)
      `).run(notif);
    },
    findByUserId: (userId) => sqlite.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(userId),
    markAsRead: (id, userId) => sqlite.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId)
  },

  // Transport
  transport: {
    listVehicles: () => sqlite.prepare("SELECT * FROM transport_vehicles WHERE status = 'active'").all(),
    findVehicleById: (id) => sqlite.prepare('SELECT * FROM transport_vehicles WHERE id = ?').get(id),
    updateTelemetry: (vehOrId, lat, lng, speedKmh) => {
      let vId, vLat, vLng, vSpeed, vName, vPlate, vRoute, vDriver, vContact, vStatus;
      if (typeof vehOrId === 'object') {
        vId = vehOrId.id || vehOrId.vehicleId;
        vLat = Number(vehOrId.lat);
        vLng = Number(vehOrId.lng);
        vSpeed = Number(vehOrId.speed_kmh ?? vehOrId.speedKmh ?? vehOrId.speedKmH ?? 0);
        vName = vehOrId.name || 'Transit Vehicle';
        vPlate = vehOrId.plate || vId;
        vRoute = vehOrId.route || 'State Route';
        vDriver = vehOrId.driver || 'Driver';
        vContact = vehOrId.contact || '+91 651 2400981';
        vStatus = ['active', 'idle', 'maintenance'].includes(vehOrId.status) ? vehOrId.status : 'active';
      } else {
        vId = vehOrId;
        vLat = Number(lat);
        vLng = Number(lng);
        vSpeed = Number(speedKmh || 0);
        vName = 'Transit Vehicle';
        vPlate = vId;
        vRoute = 'State Route';
        vDriver = 'Driver';
        vContact = '+91 651 2400981';
        vStatus = 'active';
      }

      const existing = sqlite.prepare('SELECT id FROM transport_vehicles WHERE id = ?').get(vId);
      if (existing) {
        sqlite.prepare(`
          UPDATE transport_vehicles
          SET lat = ?, lng = ?, speed_kmh = ?, status = ?, last_telemetry_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(vLat, vLng, vSpeed, vStatus, vId);
      } else {
        sqlite.prepare(`
          INSERT INTO transport_vehicles (id, name, plate, route, driver, contact, lat, lng, speed_kmh, status, last_telemetry_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(vId, vName, vPlate, vRoute, vDriver, vContact, vLat, vLng, vSpeed, vStatus);
      }

      sqlite.prepare(`
        INSERT INTO transport_locations (id, vehicle_id, lat, lng, speed_kmh, recorded_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(`loc-${Date.now()}`, vId, vLat, vLng, vSpeed);
    },
    listAlerts: () => sqlite.prepare('SELECT * FROM transport_alerts WHERE is_active = 1 ORDER BY created_at DESC LIMIT 10').all(),
    createAlert: (alert) => {
      sqlite.prepare(`
        INSERT INTO transport_alerts (id, type, severity, title, location, message, created_by, is_active, created_at)
        VALUES (@id, @type, @severity, @title, @location, @message, @created_by, 1, CURRENT_TIMESTAMP)
      `).run(alert);
    },
    deleteAlert: (id) => sqlite.prepare(
      'UPDATE transport_alerts SET is_active = 0 WHERE id = ? AND is_active = 1'
    ).run(id)
  },

  // Favourites
  favourites: {
    toggle: (userId, targetType, targetId) => {
      const existing = sqlite.prepare('SELECT * FROM favourites WHERE user_id = ? AND target_type = ? AND target_id = ?').get(userId, targetType, targetId);
      if (existing) {
        sqlite.prepare('DELETE FROM favourites WHERE id = ?').run(existing.id);
        return { saved: false };
      } else {
        sqlite.prepare('INSERT INTO favourites (id, user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)').run(`fav-${Date.now()}`, userId, targetType, targetId);
        return { saved: true };
      }
    },
    listByUser: (userId) => sqlite.prepare('SELECT * FROM favourites WHERE user_id = ?').all(userId)
  },

  // Audit Logs
  auditLogs: {
    log: (log) => {
      try {
        sqlite.prepare(`
          INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
          VALUES (@id, @user_id, @action, @entity_type, @entity_id, @details, @ip_address, CURRENT_TIMESTAMP)
        `).run({
          id: log.id || `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          user_id: log.user_id || null,
          action: log.action || 'SYSTEM_ACTION',
          entity_type: log.entity_type || null,
          entity_id: log.entity_id || null,
          ip_address: log.ip_address || '127.0.0.1',
          details: typeof log.details === 'object' ? JSON.stringify(log.details) : (log.details || null)
        });
      } catch (err) {
        console.error('[AuditLog Error]:', err.message);
      }
    }
  },

  // Public enquiries
  enquiries: {
    create: ({ id, name, email, message }) => {
      sqlite.prepare(`
        INSERT INTO enquiries (id, name, email, message)
        VALUES (@id, @name, @email, @message)
      `).run({ id, name, email, message });
      return sqlite.prepare('SELECT * FROM enquiries WHERE id = ?').get(id);
    },
    list: (limit = 100) => sqlite.prepare(
      'SELECT id, name, email, message, status, created_at FROM enquiries ORDER BY created_at DESC LIMIT ?'
    ).all(limit)
  }
};
