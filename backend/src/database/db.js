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
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS booking_bundle_items (
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES services(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (booking_id, service_id)
  )
`);
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS booking_request_keys (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_key TEXT NOT NULL,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, request_key)
  )
`);
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS itinerary_drafts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled journey',
    preferences TEXT NOT NULL,
    itinerary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_itinerary_drafts_user ON itinerary_drafts(user_id, updated_at);
`);
try { sqlite.exec("ALTER TABLE bookings ADD COLUMN delivery_address TEXT"); } catch { /* column already exists */ }
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS recommendation_interactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommendation_id TEXT NOT NULL,
    recommendation_type TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_recommendation_interactions_user
    ON recommendation_interactions(user_id, created_at);
`);
try { sqlite.exec("ALTER TABLE reviews ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'published' CHECK(publication_status IN ('pending','published','hidden'))"); } catch { /* column already exists */ }
for (const column of [
  "review_status TEXT NOT NULL DEFAULT 'published' CHECK(review_status IN ('published','pending_review','rejected'))",
  "model_version TEXT NOT NULL DEFAULT 'lexicon-v1'",
  "detector_version TEXT NOT NULL DEFAULT 'rules-v1'",
  "suspicion_score REAL NOT NULL DEFAULT 0",
  "suspicion_reasons TEXT NOT NULL DEFAULT '[]'",
  "risk_category TEXT NOT NULL DEFAULT 'low'",
  "detection_analyzed_at DATETIME",
  "verified_sentiment TEXT",
  "verified_fake_label TEXT",
  "annotation_status TEXT NOT NULL DEFAULT 'unreviewed'",
  "annotated_by TEXT",
  "annotated_at DATETIME",
  "verified_sentiment_by TEXT",
  "verified_sentiment_at DATETIME",
  "verified_fake_by TEXT",
  "verified_fake_at DATETIME"
]) {
  try { sqlite.exec(`ALTER TABLE reviews ADD COLUMN ${column}`); } catch { /* column already exists */ }
}
sqlite.exec('CREATE INDEX IF NOT EXISTS idx_reviews_publication ON reviews(target_type, target_id, publication_status)');
sqlite.exec('CREATE INDEX IF NOT EXISTS idx_reviews_user_target ON reviews(user_id, target_type, target_id, created_at)');
sqlite.exec('CREATE INDEX IF NOT EXISTS idx_reviews_risk ON reviews(risk_category, review_status)');
sqlite.exec(`
  UPDATE reviews
  SET review_status = 'pending_review', publication_status = 'pending'
  WHERE verified_fake_label = 'genuine' AND review_status = 'rejected'
`);
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS review_annotation_history (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    admin_id TEXT NOT NULL REFERENCES users(id),
    verified_sentiment TEXT,
    verified_fake_label TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
// Older installations predate destination bookings. Rebuild the small bookings
// table when necessary so the CHECK constraint matches the current schema.
try {
  const bookingSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bookings'").get()?.sql || '';
  const legacyBookingExists = Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'bookings_legacy'").get());
  if (!bookingSql && legacyBookingExists) {
    sqlite.pragma('foreign_keys = OFF');
    sqlite.exec(`
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
  } else if (bookingSql && !bookingSql.includes("'destination'")) {
    sqlite.pragma('foreign_keys = OFF');
    sqlite.exec('DROP INDEX IF EXISTS idx_bookings_user; DROP INDEX IF EXISTS idx_bookings_provider; DROP INDEX IF EXISTS idx_bookings_status;');
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
// Earlier booking migrations renamed the parent table before dependent tables
// were rebuilt. Repair those foreign keys so payments can reference bookings.
try {
  const dependentTables = ['payments', 'refunds', 'reviews'];
  const hasLegacyReferences = dependentTables.some((table) => {
    const sql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)?.sql || '';
    return sql.includes('"bookings_legacy"');
  });
  if (hasLegacyReferences) {
    sqlite.pragma('foreign_keys = OFF');
    sqlite.exec(`
      ALTER TABLE payments RENAME TO payments_legacy;
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id), gateway TEXT NOT NULL,
        gateway_order_id TEXT, gateway_payment_id TEXT, gateway_signature TEXT,
        amount REAL NOT NULL, currency TEXT DEFAULT 'INR',
        status TEXT NOT NULL CHECK(status IN ('pending','successful','failed','refunded')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO payments SELECT id, booking_id, user_id, gateway, gateway_order_id, gateway_payment_id, gateway_signature, amount, currency, status, created_at FROM payments_legacy;
      DROP TABLE payments_legacy;
      ALTER TABLE refunds RENAME TO refunds_legacy;
      CREATE TABLE refunds (
        id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id),
        booking_id TEXT NOT NULL REFERENCES bookings(id), amount REAL NOT NULL,
        reason TEXT NOT NULL, gateway_refund_id TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending','processed','failed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO refunds SELECT id, payment_id, booking_id, amount, reason, gateway_refund_id, status, created_at FROM refunds_legacy;
      DROP TABLE refunds_legacy;
      ALTER TABLE reviews RENAME TO reviews_legacy;
      CREATE TABLE reviews (
        id TEXT PRIMARY KEY, booking_id TEXT REFERENCES bookings(id),
        user_id TEXT NOT NULL REFERENCES users(id), user_name TEXT NOT NULL,
        target_type TEXT NOT NULL CHECK(target_type IN ('destination','provider','product','service')),
        target_id TEXT NOT NULL, rating REAL NOT NULL CHECK(rating >= 1.0 AND rating <= 5.0),
        review_text TEXT NOT NULL, sentiment TEXT NOT NULL CHECK(sentiment IN ('Positive','Neutral','Negative','Mixed')),
        compound_score REAL NOT NULL, emotion TEXT DEFAULT 'Neutral', aspects TEXT NOT NULL,
        is_flagged INTEGER DEFAULT 0, publication_status TEXT NOT NULL DEFAULT 'published' CHECK(publication_status IN ('pending','published','hidden')),
        review_status TEXT NOT NULL DEFAULT 'published', model_version TEXT NOT NULL DEFAULT 'lexicon-v1',
        suspicion_score REAL NOT NULL DEFAULT 0, suspicion_reasons TEXT NOT NULL DEFAULT '[]',
        verified_sentiment TEXT, verified_fake_label TEXT, annotation_status TEXT NOT NULL DEFAULT 'unreviewed',
        annotated_by TEXT, annotated_at DATETIME, verified_sentiment_by TEXT,
        verified_sentiment_at DATETIME, verified_fake_by TEXT, verified_fake_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO reviews (id, booking_id, user_id, user_name, target_type, target_id, rating, review_text, sentiment, compound_score, emotion, aspects, is_flagged, publication_status, created_at)
        SELECT id, booking_id, user_id, user_name, target_type, target_id, rating, review_text, sentiment, compound_score, emotion, aspects, is_flagged, 'published', created_at FROM reviews_legacy;
      DROP TABLE reviews_legacy;
      CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment);
      DELETE FROM refunds WHERE booking_id NOT IN (SELECT id FROM bookings);
      DELETE FROM reviews WHERE booking_id IS NOT NULL AND booking_id NOT IN (SELECT id FROM bookings);
      DELETE FROM payments WHERE booking_id NOT IN (SELECT id FROM bookings);
    `);
    sqlite.pragma('foreign_keys = ON');
  }
} catch (dependentMigrationError) {
  sqlite.pragma('foreign_keys = ON');
  console.warn('[Database] Dependent booking migration skipped:', dependentMigrationError.message);
}
// Add Mixed to installations created before mixed sentiment was introduced.
try {
  const reviewSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reviews'").get()?.sql || '';
  if (reviewSql && !reviewSql.includes("'Mixed'")) {
    sqlite.pragma('foreign_keys = OFF');
    sqlite.exec(`
      ALTER TABLE reviews RENAME TO reviews_sentiment_legacy;
      CREATE TABLE reviews (
        id TEXT PRIMARY KEY, booking_id TEXT REFERENCES bookings(id),
        user_id TEXT NOT NULL REFERENCES users(id), user_name TEXT NOT NULL,
        target_type TEXT NOT NULL CHECK(target_type IN ('destination','provider','product','service')),
        target_id TEXT NOT NULL, rating REAL NOT NULL CHECK(rating >= 1.0 AND rating <= 5.0),
        review_text TEXT NOT NULL,
        sentiment TEXT NOT NULL CHECK(sentiment IN ('Positive','Neutral','Negative','Mixed')),
        compound_score REAL NOT NULL, emotion TEXT DEFAULT 'Neutral', aspects TEXT NOT NULL,
        is_flagged INTEGER DEFAULT 0, publication_status TEXT NOT NULL DEFAULT 'published' CHECK(publication_status IN ('pending','published','hidden')),
        review_status TEXT NOT NULL DEFAULT 'published', model_version TEXT NOT NULL DEFAULT 'lexicon-v1',
        suspicion_score REAL NOT NULL DEFAULT 0, suspicion_reasons TEXT NOT NULL DEFAULT '[]',
        verified_sentiment TEXT, verified_fake_label TEXT, annotation_status TEXT NOT NULL DEFAULT 'unreviewed',
        annotated_by TEXT, annotated_at DATETIME, verified_sentiment_by TEXT,
        verified_sentiment_at DATETIME, verified_fake_by TEXT, verified_fake_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO reviews SELECT id, booking_id, user_id, user_name, target_type, target_id, rating,
        review_text, sentiment, compound_score, emotion, aspects, is_flagged, publication_status, created_at
        FROM reviews_sentiment_legacy;
      DROP TABLE reviews_sentiment_legacy;
      CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment);
    `);
    sqlite.pragma('foreign_keys = ON');
  }
} catch (reviewMigrationError) {
  sqlite.pragma('foreign_keys = ON');
  console.warn('[Database] Review sentiment migration skipped:', reviewMigrationError.message);
}
try { sqlite.exec('ALTER TABLE users ADD COLUMN profile_image TEXT'); } catch { /* column already exists */ }
try { sqlite.exec("ALTER TABLE tourist_profiles ADD COLUMN nationality TEXT DEFAULT 'Indian'"); } catch { /* column already exists */ }
try { sqlite.exec('ALTER TABLE tourist_profiles ADD COLUMN state TEXT'); } catch { /* column already exists */ }
try { sqlite.exec('ALTER TABLE provider_profiles ADD COLUMN address TEXT'); } catch { /* column already exists */ }
try { sqlite.exec('ALTER TABLE provider_profiles ADD COLUMN state TEXT'); } catch { /* column already exists */ }
try { sqlite.exec('ALTER TABLE provider_profiles ADD COLUMN government_id TEXT'); } catch { /* column already exists */ }
try { sqlite.exec('ALTER TABLE provider_profiles ADD COLUMN government_id_type TEXT'); } catch { /* column already exists */ }
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

function dateIsWithinAvailability(date, availability) {
  if (!date) return true;
  const requested = String(date).slice(0, 10);
  if (availability.startDate && requested < String(availability.startDate).slice(0, 10)) return false;
  if (availability.endDate && requested > String(availability.endDate).slice(0, 10)) return false;
  if (Array.isArray(availability.blackoutDates) &&
    availability.blackoutDates.some((blockedDate) => String(blockedDate).slice(0, 10) === requested)) return false;
  if (Array.isArray(availability.availableDates) &&
    !availability.availableDates.some((availableDate) => String(availableDate).slice(0, 10) === requested)) return false;
  if (Array.isArray(availability.days) && availability.days.length) {
    const weekday = new Date(`${requested}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    if (!availability.days.some((day) => String(day).toLowerCase() === weekday.toLowerCase())) return false;
  }
  return true;
}

function serviceAvailability(service, { startDate, endDate, travelers = 1 } = {}) {
  const availability = service.availability || {};
  const requestedTravelers = Math.max(1, Number(travelers) || 1);
  const explicitCapacity = availability.availableRooms ?? availability.availableCapacity;
  const capacityKnown = explicitCapacity !== undefined && explicitCapacity !== null && Number.isFinite(Number(explicitCapacity));
  const datesSupported = Boolean(
    availability.startDate || availability.endDate || availability.blackoutDates ||
    availability.availableDates || availability.days
  );
  const dateMatches = dateIsWithinAvailability(startDate, availability) &&
    dateIsWithinAvailability(endDate, availability);
  const capacityMatches = !capacityKnown || Number(explicitCapacity) >= requestedTravelers;
  return {
    availabilityVerified: capacityKnown || datesSupported,
    availabilityStatus: capacityMatches && dateMatches
      ? (capacityKnown ? 'available' : datesSupported ? 'date-check-passed' : 'confirmation-required')
      : 'unavailable',
    capacityKnown,
    dateMatches,
    capacityMatches
  };
}

function withPublishedReviewSummary(destination) {
  const summary = sqlite.prepare(`
    SELECT COUNT(*) AS review_count, AVG(rating) AS average_rating
    FROM reviews
    WHERE target_type = 'destination' AND target_id = ?
      AND publication_status = 'published' AND review_status = 'published'
      AND COALESCE(verified_fake_label, '') != 'fake'
  `).get(destination.id);
  return {
    ...destination,
    rating: summary.review_count ? Math.round(Number(summary.average_rating) * 10) / 10 : 0,
    review_count: Number(summary.review_count || 0)
  };
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
      const existing = db.providerProfiles.findByUserId(profile.user_id);
      const normalizedProfile = {
        user_id: profile.user_id,
        provider_type: profile.provider_type || existing?.provider_type || 'vendor',
        business_name: profile.business_name || existing?.business_name || profile.name || 'Tourism Provider',
        license_number: profile.license_number ?? existing?.license_number ?? '',
        district: profile.district || existing?.district || 'Ranchi',
        address: profile.address ?? existing?.address ?? null,
        state: profile.state ?? existing?.state ?? 'Jharkhand',
        service_area: profile.service_area ?? existing?.service_area ?? 'Statewide',
        specialization: profile.specialization ?? existing?.specialization ?? 'Tourism Services',
        languages: profile.languages ?? existing?.languages ?? [],
        daily_rate: profile.daily_rate ?? existing?.daily_rate ?? 0,
        verification_status: profile.verification_status || existing?.verification_status || 'pending',
        rejection_reason: profile.rejection_reason ?? existing?.rejection_reason ?? null,
        payout_details: profile.payout_details ?? existing?.payout_details ?? {}
        ,government_id: profile.government_id ?? existing?.government_id ?? ''
        ,government_id_type: profile.government_id_type ?? existing?.government_id_type ?? ''
      };
      sqlite.prepare(`
        INSERT INTO provider_profiles (user_id, provider_type, business_name, license_number, district, address, state, service_area, specialization, languages, daily_rate, verification_status, rejection_reason, payout_details, government_id, government_id_type, updated_at)
        VALUES (@user_id, @provider_type, @business_name, @license_number, @district, @address, @state, @service_area, @specialization, @languages, @daily_rate, @verification_status, @rejection_reason, @payout_details, @government_id, @government_id_type, CURRENT_TIMESTAMP)
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
          government_id = excluded.government_id,
          government_id_type = excluded.government_id_type,
          updated_at = CURRENT_TIMESTAMP
      `).run({
        ...normalizedProfile,
        languages: typeof normalizedProfile.languages === 'object' ? JSON.stringify(normalizedProfile.languages) : normalizedProfile.languages,
        payout_details: typeof normalizedProfile.payout_details === 'object' ? JSON.stringify(normalizedProfile.payout_details) : normalizedProfile.payout_details
      });
      return db.providerProfiles.findByUserId(profile.user_id);
    },
    updateStatus: (userId, status, reason = null) => {
      sqlite.prepare('UPDATE provider_profiles SET verification_status = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(status, reason, userId);
      return db.providerProfiles.findByUserId(userId);
    },
    list: ({ status, district, limit = 50 } = {}) => {
      let query = `
        SELECT p.*, u.name, u.email, u.phone,
          c.certificate_id, c.blockchain_tx_hash, c.block_number
        FROM provider_profiles p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN certificates c ON c.id = (
          SELECT latest.id FROM certificates latest
          WHERE latest.provider_id = p.user_id
          ORDER BY latest.created_at DESC
          LIMIT 1
        )
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
    updateLatestDocuments: (providerId, documents) => {
      const latest = sqlite.prepare('SELECT id FROM verification_requests WHERE provider_id = ? ORDER BY submitted_at DESC LIMIT 1').get(providerId);
      if (!latest) return null;
      sqlite.prepare('UPDATE verification_requests SET documents = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(documents), latest.id);
      return db.verificationRequests.findById(latest.id);
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
    updateBlockchainRecord: (cert) => {
      sqlite.prepare(`
        UPDATE certificates
        SET name = @name, category = @category, district = @district, issue_date = @issue_date,
            valid_until = @valid_until, issuer = @issuer, sha256_hash = @sha256_hash,
            blockchain_tx_hash = @blockchain_tx_hash, block_number = @block_number,
            status = @status, qr_code_url = @qr_code_url
        WHERE id = @id
      `).run(cert);
      return db.certificates.findByCertificateId(cert.certificate_id);
    },
    markRevoked: (providerId) => {
      sqlite.prepare("UPDATE certificates SET status = 'revoked' WHERE provider_id = ? AND status = 'valid'").run(providerId);
      return db.certificates.findByProviderId(providerId);
    },
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
      query += ' ORDER BY name ASC';
      return sqlite.prepare(query).all(...params).map((row) => {
        const r = withPublishedReviewSummary(row);
        return {
        ...r,
        attractions: safeJSONParse(r.attractions, []),
        activities: safeJSONParse(r.activities, []),
        nearby_hotels: safeJSONParse(r.nearby_hotels, []),
        interests: safeJSONParse(r.interests, [])
        };
      });
    },
    findById: (id) => {
      const row = sqlite.prepare('SELECT * FROM destinations WHERE id = ? OR slug = ?').get(id, id);
      if (!row) return null;
      const destination = withPublishedReviewSummary(row);
      return {
        ...destination,
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
      const products = sqlite.prepare(query).all(...params);
      const summary = sqlite.prepare(`
        SELECT COUNT(*) AS review_count, AVG(rating) AS average_rating
        FROM reviews
        WHERE target_type = 'product' AND target_id = ?
          AND publication_status = 'published' AND review_status = 'published'
          AND COALESCE(verified_fake_label, '') != 'fake'
      `);
      return products.map((product) => {
        const review = summary.get(product.id);
        return {
          ...product,
          reviews_count: Number(review.review_count || 0),
          rating: review.review_count ? Math.round(Number(review.average_rating) * 10) / 10 : null
        };
      });
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
    list: ({ category, district, startDate, endDate, travelers = 1, onlyBookable = false } = {}) => {
      let query = `
        SELECT s.*, u.name as provider_name, p.verification_status as provider_verified, p.rating as provider_rating,
          c.certificate_id, c.blockchain_tx_hash, c.block_number, c.valid_until as certificate_valid_until,
          p.service_area, p.business_name, p.languages as provider_languages, p.specialization as provider_specialization,
          p.address as provider_address, p.state as provider_state
        FROM services s
        JOIN users u ON s.provider_id = u.id
        LEFT JOIN provider_profiles p ON s.provider_id = p.user_id
        LEFT JOIN certificates c ON c.provider_id = s.provider_id AND c.status = 'valid'
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
      })).map((service) => ({
        ...service,
        ...serviceAvailability(service, { startDate, endDate, travelers })
      })).filter((service) => !onlyBookable || (
        service.availabilityStatus !== 'unavailable' &&
        (service.category === 'package' || service.provider_verified === 'approved')
      ));
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
    getAvailability: (id, options = {}) => {
      const service = db.services.findById(id);
      return service ? serviceAvailability(service, options) : null;
    },
    reserveAvailability: (id, quantity = 1) => {
      const service = db.services.findById(id);
      const availableRooms = Number(service?.availability?.availableRooms);
      if (!service || !Number.isFinite(availableRooms) || availableRooms < Math.max(1, Number(quantity) || 1)) return false;
      const availability = {
        ...service.availability,
        availableRooms: availableRooms - Math.max(1, Number(quantity) || 1)
      };
      const result = sqlite.prepare('UPDATE services SET availability = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = 1 AND approval_status = ?')
        .run(JSON.stringify(availability), id, 'approved');
      return result.changes > 0;
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
        INSERT INTO bookings (id, user_id, provider_id, item_type, item_id, item_title, travelers, check_in_date, check_out_date, days, total_amount, escrow_amount, escrow_status, contract_address, contract_tx_hash, status, cancellation_reason, delivery_address, created_at, updated_at)
        VALUES (@id, @user_id, @provider_id, @item_type, @item_id, @item_title, @travelers, @check_in_date, @check_out_date, @days, @total_amount, @escrow_amount, @escrow_status, @contract_address, @contract_tx_hash, @status, @cancellation_reason, @delivery_address, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run({ ...booking, delivery_address: booking.delivery_address || null });
      return db.bookings.findById(booking.id);
    },
    bookingRequestKeys: {
      find: (userId, requestKey) => sqlite.prepare(
        'SELECT booking_id FROM booking_request_keys WHERE user_id = ? AND request_key = ?'
      ).get(userId, requestKey),
      create: (userId, requestKey, bookingId) => sqlite.prepare(
        'INSERT INTO booking_request_keys (user_id, request_key, booking_id) VALUES (?, ?, ?)'
      ).run(userId, requestKey, bookingId)
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
    completeIfEligible: (id, userId, today) => {
      const result = sqlite.prepare(`
        UPDATE bookings
        SET status = 'completed',
            settled_at = COALESCE(settled_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND status = 'confirmed'
          AND check_out_date IS NOT NULL
          AND date(check_out_date) <= date(?)
      `).run(id, userId, today);
      return result.changes ? db.bookings.findById(id) : null;
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

  itineraryDrafts: {
    create: (draft) => {
      sqlite.prepare(`
        INSERT INTO itinerary_drafts (id, user_id, title, preferences, itinerary)
        VALUES (@id, @user_id, @title, @preferences, @itinerary)
      `).run({
        ...draft,
        preferences: JSON.stringify(draft.preferences || {}),
        itinerary: draft.itinerary ? JSON.stringify(draft.itinerary) : null
      });
      return db.itineraryDrafts.findById(draft.id, draft.user_id);
    },
    findById: (id, userId) => {
      const row = sqlite.prepare('SELECT * FROM itinerary_drafts WHERE id = ? AND user_id = ?').get(id, userId);
      if (!row) return null;
      return { ...row, preferences: safeJSONParse(row.preferences, {}), itinerary: row.itinerary ? safeJSONParse(row.itinerary, null) : null };
    },
    listByUserId: (userId) => sqlite.prepare('SELECT * FROM itinerary_drafts WHERE user_id = ? ORDER BY updated_at DESC').all(userId).map((row) => ({
      ...row, preferences: safeJSONParse(row.preferences, {}), itinerary: row.itinerary ? safeJSONParse(row.itinerary, null) : null
    })),
    update: (id, userId, draft) => {
      const result = sqlite.prepare(`
        UPDATE itinerary_drafts
        SET title = @title, preferences = @preferences, itinerary = @itinerary, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id AND user_id = @user_id
      `).run({
        id, user_id: userId, title: draft.title || 'Untitled journey',
        preferences: JSON.stringify(draft.preferences || {}),
        itinerary: draft.itinerary ? JSON.stringify(draft.itinerary) : null
      });
      return result.changes ? db.itineraryDrafts.findById(id, userId) : null;
    },
    delete: (id, userId) => sqlite.prepare('DELETE FROM itinerary_drafts WHERE id = ? AND user_id = ?').run(id, userId).changes > 0
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
        INSERT INTO reviews (id, booking_id, user_id, user_name, target_type, target_id, rating, review_text, sentiment, compound_score, emotion, aspects, is_flagged, publication_status, review_status, model_version, detector_version, suspicion_score, suspicion_reasons, risk_category, detection_analyzed_at, created_at)
        VALUES (@id, @booking_id, @user_id, @user_name, @target_type, @target_id, @rating, @review_text, @sentiment, @compound_score, @emotion, @aspects, @is_flagged, @publication_status, @review_status, @model_version, @detector_version, @suspicion_score, @suspicion_reasons, @risk_category, @detection_analyzed_at, CURRENT_TIMESTAMP)
      `).run({
        ...rev,
        aspects: typeof rev.aspects === 'object' ? JSON.stringify(rev.aspects) : rev.aspects,
        publication_status: rev.publication_status || 'published'
        , review_status: rev.review_status || 'published'
        , model_version: rev.model_version || 'lexicon-v1'
        , detector_version: rev.detector_version || 'rules-v1'
        , suspicion_score: rev.suspicion_score || 0
        , suspicion_reasons: typeof rev.suspicion_reasons === 'object' ? JSON.stringify(rev.suspicion_reasons) : (rev.suspicion_reasons || '[]')
        , risk_category: rev.risk_category || 'low'
        , detection_analyzed_at: rev.detection_analyzed_at || null
      });
      return db.reviews.findById(rev.id);
    },
    findById: (id) => {
      const row = sqlite.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
      if (!row) return null;
      return { ...row,       aspects: safeJSONParse(row.aspects, {}),
      suspicion_reasons: safeJSONParse(row.suspicion_reasons, []) };
    },
    findByBookingId: (bookingId) => sqlite.prepare('SELECT * FROM reviews WHERE booking_id = ? LIMIT 1').get(bookingId),
    listByTarget: (targetType, targetId, { publishedOnly = false } = {}) => {
      const rows = publishedOnly
        ? sqlite.prepare("SELECT * FROM reviews WHERE target_type = ? AND target_id = ? AND publication_status = 'published' AND review_status = 'published' ORDER BY created_at DESC").all(targetType, targetId)
        : sqlite.prepare('SELECT * FROM reviews WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC').all(targetType, targetId);
      return rows.map(r => ({
        ...r,
        aspects: safeJSONParse(r.aspects, {})
      }));
    },
    listPublic: ({ targetType = 'destination', targetId, sort = 'newest', rating, page = 1, limit = 5 } = {}) => {
      const orderBy = { newest: 'created_at DESC', oldest: 'created_at ASC', highest: 'rating DESC, created_at DESC', lowest: 'rating ASC, created_at DESC' }[sort] || 'created_at DESC';
      const params = [targetType, targetId];
      let where = "target_type = ? AND target_id = ? AND publication_status = 'published' AND review_status = 'published' AND COALESCE(verified_fake_label, '') != 'fake'";
      if (rating !== undefined) {
        where += ' AND rating = ?';
        params.push(rating);
      }
      const total = sqlite.prepare(`SELECT COUNT(*) AS count FROM reviews WHERE ${where}`).get(...params).count;
      const offset = (page - 1) * limit;
      const rows = sqlite.prepare(`SELECT id, target_id, user_name, rating, review_text, created_at FROM reviews WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, offset);
      return { total, page, limit, totalPages: Math.ceil(total / limit), reviews: rows };
    },
    listAll: (limit = 50, { status, risk } = {}) => {
      const conditions = [];
      const params = [];
      if (status && ['published', 'pending_review', 'rejected'].includes(status)) {
        conditions.push('review_status = ?');
        params.push(status);
      }
      if (risk && ['low', 'medium', 'high'].includes(risk)) {
        conditions.push('risk_category = ?');
        params.push(risk);
      }
      params.push(limit);
      return sqlite.prepare(`SELECT * FROM reviews ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`).all(...params).map(r => ({
        ...r,
        aspects: safeJSONParse(r.aspects, {}),
        suspicion_reasons: safeJSONParse(r.suspicion_reasons, [])
      }));
    },
    listByUserTarget: (userId, targetType, targetId, limit = 20) => sqlite.prepare(
      'SELECT * FROM reviews WHERE user_id = ? AND target_type = ? AND target_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(userId, targetType, targetId, limit),
    listByUserSince: (userId, since) => sqlite.prepare(
      "SELECT * FROM reviews WHERE user_id = ? AND created_at >= datetime(?, 'unixepoch') ORDER BY created_at DESC"
    ).all(userId, Math.floor(since / 1000)),
    intelligenceStats: () => sqlite.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN publication_status = 'published' AND review_status = 'published' THEN 1 ELSE 0 END) AS published,
        SUM(CASE WHEN review_status = 'pending_review' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN review_status = 'rejected' OR verified_fake_label = 'fake' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN suspicion_score > 0 THEN 1 ELSE 0 END) AS suspicious,
        SUM(CASE WHEN verified_sentiment IS NOT NULL THEN 1 ELSE 0 END) AS verified_sentiment,
        SUM(CASE WHEN verified_fake_label IS NOT NULL THEN 1 ELSE 0 END) AS verified_fake,
        SUM(CASE WHEN annotation_status = 'unreviewed' THEN 1 ELSE 0 END) AS awaiting_annotation,
        SUM(CASE WHEN annotation_status = 'verified' AND verified_sentiment IS NOT NULL AND verified_fake_label IS NOT NULL AND review_status = 'published' THEN 1 ELSE 0 END) AS training_eligible
      FROM reviews
    `).get(),
    updateReviewDetection: (id, detection) => {
      sqlite.prepare(`
        UPDATE reviews
        SET is_flagged = @is_flagged,
            detector_version = @detector_version,
            suspicion_score = @suspicion_score,
            suspicion_reasons = @suspicion_reasons,
            risk_category = @risk_category,
            detection_analyzed_at = @detection_analyzed_at
        WHERE id = @id
      `).run({
        id,
        is_flagged: detection.isSuspicious ? 1 : 0,
        detector_version: detection.detectorVersion,
        suspicion_score: detection.suspicionScore,
        suspicion_reasons: JSON.stringify(detection.suspicionReasons),
        risk_category: detection.riskCategory,
        detection_analyzed_at: detection.analysisTimestamp
      });
      return db.reviews.findById(id);
    },
    updateAspectAnalysis: (id, aspects, sentiment, compoundScore, emotion) => {
      sqlite.prepare(`
        UPDATE reviews
        SET aspects = @aspects, sentiment = @sentiment,
            compound_score = @compoundScore, emotion = @emotion
        WHERE id = @id
      `).run({
        id,
        aspects: JSON.stringify(aspects),
        sentiment,
        compoundScore,
        emotion
      });
      return db.reviews.findById(id);
    },
    updateReviewIntelligence: (id, fields) => {
      sqlite.prepare(`
        UPDATE reviews SET review_status = @review_status, publication_status = @publication_status,
          verified_sentiment = @verified_sentiment, verified_fake_label = @verified_fake_label,
          annotation_status = @annotation_status, annotated_by = @annotated_by, annotated_at = CURRENT_TIMESTAMP,
          verified_sentiment_by = @verified_sentiment_by, verified_sentiment_at = @verified_sentiment_at,
          verified_fake_by = @verified_fake_by, verified_fake_at = @verified_fake_at
        WHERE id = @id
      `).run({
        id,
        ...fields,
        verified_sentiment_by: fields.verified_sentiment_by ?? null,
        verified_sentiment_at: fields.verified_sentiment_at ?? null,
        verified_fake_by: fields.verified_fake_by ?? null,
        verified_fake_at: fields.verified_fake_at ?? null
      });
      return db.reviews.findById(id);
    },
    addAnnotationHistory: (annotation) => sqlite.prepare(`
      INSERT INTO review_annotation_history (id, review_id, admin_id, verified_sentiment, verified_fake_label, note)
      VALUES (@id, @review_id, @admin_id, @verified_sentiment, @verified_fake_label, @note)
    `).run(annotation),
    listTrainingEligible: (limit = 1000) => sqlite.prepare(`
      SELECT id, review_text, sentiment, verified_sentiment, verified_fake_label, model_version
      FROM reviews
      WHERE annotation_status = 'verified' AND verified_sentiment IS NOT NULL
        AND verified_fake_label = 'genuine' AND review_status = 'published'
      ORDER BY created_at ASC LIMIT ?
    `).all(limit),
    update: (id, review) => {
      sqlite.prepare(`
        UPDATE reviews
        SET rating = @rating, review_text = @review_text, sentiment = @sentiment,
            compound_score = @compound_score, emotion = @emotion, aspects = @aspects,
            is_flagged = @is_flagged, review_status = @review_status, model_version = @model_version,
            detector_version = @detector_version, suspicion_score = @suspicion_score,
            suspicion_reasons = @suspicion_reasons, risk_category = @risk_category,
            detection_analyzed_at = @detection_analyzed_at
        WHERE id = @id
      `).run({
        ...review,
        id,
        aspects: typeof review.aspects === 'object' ? JSON.stringify(review.aspects) : review.aspects,
        review_status: review.review_status || 'published',
        model_version: review.model_version || 'lexicon-v1',
        detector_version: review.detector_version || 'rules-v1',
        suspicion_score: review.suspicion_score || 0,
        suspicion_reasons: typeof review.suspicion_reasons === 'object' ? JSON.stringify(review.suspicion_reasons) : (review.suspicion_reasons || '[]'),
        risk_category: review.risk_category || 'low',
        detection_analyzed_at: review.detection_analyzed_at || null
      });
      return db.reviews.findById(id);
    },
    updatePublicationStatus: (id, publicationStatus) => {
      sqlite.prepare('UPDATE reviews SET publication_status = ? WHERE id = ?').run(publicationStatus, id);
      return db.reviews.findById(id);
    },
    delete: (id) => sqlite.prepare('DELETE FROM reviews WHERE id = ?').run(id),
    stats: ({ targetId, publishedOnly = false } = {}) => {
      const reviews = targetId
        ? sqlite.prepare(`SELECT * FROM reviews WHERE target_type = 'destination' AND target_id = ?${publishedOnly ? " AND publication_status = 'published' AND review_status = 'published'" : ''}`).all(targetId)
        : sqlite.prepare(`SELECT * FROM reviews${publishedOnly ? " WHERE publication_status = 'published' AND review_status = 'published'" : ''}`).all();
      const total = reviews.length;
      if (total === 0) return null;

      const counts = { Positive: 0, Negative: 0, Neutral: 0, Mixed: 0 };
      const aspectSums = { cleanliness: 0, hospitality: 0, transport: 0, food: 0, safety: 0 };
      const aspectSentimentCounts = {};

      reviews.forEach(r => {
        counts[r.sentiment] = (counts[r.sentiment] || 0) + 1;
        const asp = safeJSONParse(r.aspects, {});
        for (const k in aspectSums) {
          if (typeof asp[k] === 'number' && Number.isFinite(asp[k])) {
            aspectSums[k] += asp[k];
          }
          const label = typeof asp[k] === 'string'
            ? asp[k]
            : typeof asp[k] === 'number'
              ? asp[k] >= 3.5 ? 'Positive' : asp[k] <= 2.5 ? 'Negative' : 'Neutral'
              : null;
          if (label) {
            aspectSentimentCounts[k] ||= { Positive: 0, Negative: 0, Neutral: 0 };
            aspectSentimentCounts[k][label] = (aspectSentimentCounts[k][label] || 0) + 1;
          }
        }
      });

      const aspectScores = {};
      for (const k in aspectSums) {
        aspectScores[k] = aspectSums[k] > 0 ? Math.round((aspectSums[k] / total) * 10) / 10 : null;
      }

      return {
        totalReviews: total,
        sentimentDistribution: {
          positivePercent: Math.round((counts.Positive / total) * 100),
          neutralPercent: Math.round((counts.Neutral / total) * 100),
          negativePercent: Math.round((counts.Negative / total) * 100),
          mixedPercent: Math.round((counts.Mixed / total) * 100),
          rawCounts: counts
        },
        aspectScores
        , aspectSentimentCounts
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
    listAlerts: () => sqlite.prepare("SELECT * FROM transport_alerts WHERE is_active = 1 AND type <> 'Quality Flag' ORDER BY created_at DESC LIMIT 10").all(),
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
