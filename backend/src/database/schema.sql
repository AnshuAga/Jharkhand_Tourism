-- ============================================================
-- AI & Blockchain-Based Smart Tourism Platform for Jharkhand
-- Complete Relational Database Schema (SQLite / PostgreSQL)
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('tourist', 'vendor', 'guide', 'admin')),
    is_email_verified INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. EMAIL OTPS TABLE (Single-use, expiring, rate-limited)
CREATE TABLE IF NOT EXISTS email_otps (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE,
    otp_hash TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('registration', 'password_reset', 'login_verify')),
    expires_at DATETIME NOT NULL,
    attempts INTEGER DEFAULT 0,
    resend_cooldown_until DATETIME NOT NULL,
    is_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otps_email_type ON email_otps(email, type);

-- 3. TOURIST PROFILES
CREATE TABLE IF NOT EXISTS tourist_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    budget REAL DEFAULT 25000,
    travel_duration INTEGER DEFAULT 3,
    interests TEXT DEFAULT '["nature"]', -- JSON Array
    starting_location TEXT DEFAULT 'Ranchi',
    group_size INTEGER DEFAULT 2,
    group_type TEXT DEFAULT 'couple' CHECK(group_type IN ('solo', 'couple', 'family', 'group')),
    nationality TEXT DEFAULT 'Indian',
    state TEXT,
    date_of_birth TEXT,
    bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. PROVIDER PROFILES (Guides, Homestay Hosts, Artisans/Vendors)
CREATE TABLE IF NOT EXISTS provider_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL CHECK(provider_type IN ('guide', 'vendor', 'homestay')),
    business_name TEXT NOT NULL,
    license_number TEXT,
    district TEXT NOT NULL,
    address TEXT,
    state TEXT,
    service_area TEXT,
    specialization TEXT,
    languages TEXT DEFAULT '["English", "Hindi"]', -- JSON Array
    daily_rate REAL DEFAULT 0,
    verification_status TEXT DEFAULT 'pending' CHECK(verification_status IN ('pending', 'under_review', 'approved', 'rejected', 'resubmission_required', 'revoked')),
    rejection_reason TEXT,
    rating REAL DEFAULT 0.0,
    review_count INTEGER DEFAULT 0,
    payout_details TEXT, -- JSON Object
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_providers_status ON provider_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_providers_district ON provider_profiles(district);

-- 5. VERIFICATION REQUESTS & KYC DOCUMENTS
CREATE TABLE IF NOT EXISTS verification_requests (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'resubmission_required', 'revoked')),
    documents TEXT NOT NULL, -- JSON Array of uploaded document records
    admin_notes TEXT,
    reviewed_by TEXT REFERENCES users(id),
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_verification_provider ON verification_requests(provider_id);

-- 6. CERTIFICATES (Anchored with SHA-256 and On-Chain Proofs)
CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    certificate_id TEXT UNIQUE NOT NULL,
    provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    district TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    valid_until TEXT NOT NULL,
    issuer TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    ipfs_hash TEXT,
    blockchain_tx_hash TEXT,
    block_number INTEGER,
    status TEXT NOT NULL CHECK(status IN ('valid', 'invalid', 'revoked', 'expired')),
    qr_code_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cert_provider ON certificates(provider_id);
CREATE INDEX IF NOT EXISTS idx_cert_sha256 ON certificates(sha256_hash);

-- 7. BLOCKCHAIN TRANSACTIONS
CREATE TABLE IF NOT EXISTS blockchain_transactions (
    id TEXT PRIMARY KEY,
    tx_hash TEXT UNIQUE NOT NULL,
    contract_address TEXT,
    action TEXT NOT NULL,
    from_address TEXT,
    to_address TEXT,
    payload TEXT, -- JSON Object
    status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'failed')),
    block_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('destination', 'marketplace')),
    icon TEXT,
    description TEXT
);

-- 9. DESTINATIONS TABLE
CREATE TABLE IF NOT EXISTS destinations (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    district TEXT NOT NULL,
    category TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    rating REAL DEFAULT 0.0,
    review_count INTEGER DEFAULT 0,
    avg_cost REAL DEFAULT 2000,
    best_season TEXT DEFAULT 'October to March',
    crowd_level TEXT DEFAULT 'Moderate',
    image TEXT NOT NULL,
    description TEXT NOT NULL,
    opening_hours TEXT,
    ticket_info TEXT,
    attractions TEXT DEFAULT '[]', -- JSON Array
    activities TEXT DEFAULT '[]', -- JSON Array
    nearby_hotels TEXT DEFAULT '[]', -- JSON Array
    interests TEXT DEFAULT '["nature"]', -- JSON Array
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_destinations_district ON destinations(district);
CREATE INDEX IF NOT EXISTS idx_destinations_category ON destinations(category);

-- 10. DESTINATION MEDIA
CREATE TABLE IF NOT EXISTS destination_media (
    id TEXT PRIMARY KEY,
    destination_id TEXT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT DEFAULT 'image' CHECK(media_type IN ('image', 'video', '360_panorama')),
    caption TEXT,
    is_primary INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. MARKETPLACE PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    vendor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    district TEXT NOT NULL,
    material TEXT,
    image TEXT NOT NULL,
    badge TEXT DEFAULT 'Handcrafted',
    is_active INTEGER DEFAULT 1,
    approval_status TEXT DEFAULT 'approved' CHECK(approval_status IN ('pending', 'approved', 'rejected', 'changes_requested')),
    review_reason TEXT,
    reviewed_at DATETIME,
    reviewed_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- 12. SERVICES & HOMESTAYS (Offered by verified guides & hosts)
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('guide', 'homestay', 'package', 'transport', 'restaurant')),
    price REAL NOT NULL,
    district TEXT NOT NULL,
    duration_days INTEGER DEFAULT 1,
    image TEXT,
    amenities TEXT DEFAULT '[]', -- JSON Array
    availability TEXT DEFAULT '{}', -- JSON Object
    is_active INTEGER DEFAULT 1,
    approval_status TEXT DEFAULT 'approved' CHECK(approval_status IN ('pending', 'approved', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_services_provider ON services(provider_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

-- 13. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    provider_id TEXT REFERENCES users(id),
    item_type TEXT NOT NULL CHECK(item_type IN ('product', 'service', 'package', 'homestay', 'guide', 'destination')),
    item_id TEXT NOT NULL,
    item_title TEXT NOT NULL,
    travelers INTEGER DEFAULT 1,
    check_in_date TEXT,
    check_out_date TEXT,
    days INTEGER DEFAULT 1,
    total_amount REAL NOT NULL,
    escrow_amount REAL NOT NULL,
    escrow_status TEXT NOT NULL CHECK(escrow_status IN ('locked', 'released', 'refunded')),
    contract_address TEXT,
    contract_tx_hash TEXT,
    status TEXT NOT NULL CHECK(status IN ('initiated', 'payment_pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded')),
    cancellation_reason TEXT,
    delivery_address TEXT,
    settled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- 14. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    gateway TEXT NOT NULL,
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    gateway_signature TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL CHECK(status IN ('pending', 'successful', 'failed', 'refunded')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

-- 15. REFUNDS TABLE
CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL REFERENCES payments(id),
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    gateway_refund_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('pending', 'processed', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. REVIEWS & ASPECT-BASED SENTIMENT
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    booking_id TEXT REFERENCES bookings(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    user_name TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK(target_type IN ('destination', 'provider', 'product', 'service')),
    target_id TEXT NOT NULL,
    rating REAL NOT NULL CHECK(rating >= 1.0 AND rating <= 5.0),
    review_text TEXT NOT NULL,
    sentiment TEXT NOT NULL CHECK(sentiment IN ('Positive','Neutral','Negative','Mixed')),
    compound_score REAL NOT NULL,
    emotion TEXT DEFAULT 'Neutral',
    aspects TEXT NOT NULL, -- JSON Object: { cleanliness: "Negative", food: "Positive" }; keyword-based model labels
    is_flagged INTEGER DEFAULT 0,
    publication_status TEXT NOT NULL DEFAULT 'published' CHECK(publication_status IN ('pending','published','hidden')),
    review_status TEXT NOT NULL DEFAULT 'published' CHECK(review_status IN ('published','pending_review','rejected')),
    model_version TEXT NOT NULL DEFAULT 'lexicon-v1',
    detector_version TEXT NOT NULL DEFAULT 'rules-v1',
    suspicion_score REAL NOT NULL DEFAULT 0,
    suspicion_reasons TEXT NOT NULL DEFAULT '[]',
    risk_category TEXT NOT NULL DEFAULT 'low' CHECK(risk_category IN ('low','medium','high')),
    detection_analyzed_at DATETIME,
    verified_sentiment TEXT CHECK(verified_sentiment IN ('Positive','Neutral','Negative','Mixed')),
    verified_fake_label TEXT CHECK(verified_fake_label IN ('genuine','fake')),
    annotation_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK(annotation_status IN ('unreviewed','in_progress','verified')),
    annotated_by TEXT REFERENCES users(id),
    annotated_at DATETIME,
    verified_sentiment_by TEXT REFERENCES users(id),
    verified_sentiment_at DATETIME,
    verified_fake_by TEXT REFERENCES users(id),
    verified_fake_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_target ON reviews(user_id, target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment);
CREATE TABLE IF NOT EXISTS review_annotation_history (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    admin_id TEXT NOT NULL REFERENCES users(id),
    verified_sentiment TEXT,
    verified_fake_label TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 17. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK(type IN ('info', 'success', 'warning', 'alert', 'booking', 'kyc')),
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- 18. CHAT CONVERSATIONS & MESSAGES
CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    title TEXT DEFAULT 'Trip Inquiry',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK(sender IN ('user', 'bot')),
    message TEXT NOT NULL,
    detected_language TEXT DEFAULT 'en',
    intent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_convo ON chat_messages(conversation_id);

-- 19. ITINERARIES
CREATE TABLE IF NOT EXISTS itineraries (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    preferences TEXT NOT NULL, -- JSON Object
    days_plan TEXT NOT NULL, -- JSON Array of days
    total_budget REAL NOT NULL,
    daily_budget REAL NOT NULL,
    route TEXT NOT NULL, -- JSON Array
    algorithm TEXT DEFAULT 'Hybrid SVD-Collaborative + Cosine Content-Based + Greedy Nearest-Neighbor TSP',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 20. FAVOURITES
CREATE TABLE IF NOT EXISTS favourites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK(target_type IN ('destination', 'product', 'service')),
    target_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, target_type, target_id)
);

-- 21. REAL-TIME TRANSPORT FLEET & LOCATIONS
CREATE TABLE IF NOT EXISTS transport_vehicles (
    id TEXT PRIMARY KEY,
    provider_id TEXT REFERENCES users(id),
    name TEXT NOT NULL,
    plate TEXT UNIQUE NOT NULL,
    route TEXT NOT NULL,
    driver TEXT NOT NULL,
    contact TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    speed_kmh REAL DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'idle', 'maintenance')),
    last_telemetry_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transport_locations (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES transport_vehicles(id) ON DELETE CASCADE,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    speed_kmh REAL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 22. TRAVEL ADVISORIES & ALERTS
CREATE TABLE IF NOT EXISTS transport_alerts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('Info', 'Warning', 'Alert')),
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    message TEXT NOT NULL,
    created_by TEXT REFERENCES users(id),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 23. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT, -- JSON Object
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 24. PUBLIC TOURISM ENQUIRIES
CREATE TABLE IF NOT EXISTS enquiries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'in_progress', 'resolved')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON enquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
