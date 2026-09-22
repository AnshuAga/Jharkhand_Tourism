import bcrypt from 'bcryptjs';
import { db, sqlite } from './db.js';
import { additionalDestinations } from './additionalDestinations.js';

console.log('🌱 Starting Jharkhand Tourism Database Seeding...');

// 1. Seed Categories
const categories = [
  { id: 'cat-dest-waterfalls', name: 'Waterfalls', type: 'destination', icon: 'Mountain', description: 'Spectacular cascading falls across the Chotanagpur Plateau' },
  { id: 'cat-dest-wildlife', name: 'Wildlife & Safari', type: 'destination', icon: 'TreePine', description: 'National parks, tiger reserves and sanctuary habitats' },
  { id: 'cat-dest-spiritual', name: 'Spiritual & Heritage', type: 'destination', icon: 'Sparkles', description: 'Ancient Shiva Jyotirlingas, Jain Tirthas, and sacred shrines' },
  { id: 'cat-dest-hills', name: 'Hill Stations', type: 'destination', icon: 'Compass', description: 'Misty plateau ridges and scenic viewpoints' },
  { id: 'cat-dest-eco', name: 'Eco-Tourism & Lakes', type: 'destination', icon: 'Leaf', description: 'Pristine dams, valleys and serene lake resorts' },

  { id: 'cat-mkt-paintings', name: 'Paintings', type: 'marketplace', icon: 'Brush', description: 'Traditional Sohrai and Khovar ritual wall art' },
  { id: 'cat-mkt-dhokra', name: 'Dhokra', type: 'marketplace', icon: 'Award', description: 'Ancient lost-wax bell metal casting' },
  { id: 'cat-mkt-bamboo', name: 'Bamboo', type: 'marketplace', icon: 'TreePine', description: 'Split-bamboo eco-crafts and baskets' },
  { id: 'cat-mkt-textiles', name: 'Textiles', type: 'marketplace', icon: 'Scissors', description: 'Pure Jharkhand Tasar silk handloom sarees' },
  { id: 'cat-mkt-jewellery', name: 'Jewellery', type: 'marketplace', icon: 'Sparkles', description: 'Ceremonial silver tribal ornaments' },
  { id: 'cat-mkt-homestay', name: 'Homestays', type: 'marketplace', icon: 'Home', description: 'Verified indigenous homestays and eco-lodges' },
  { id: 'cat-mkt-guide', name: 'Guides', type: 'marketplace', icon: 'UserCheck', description: 'Certified tribal historians and wilderness guides' }
];

const insertCategory = sqlite.prepare(`
  INSERT OR IGNORE INTO categories (id, name, type, icon, description)
  VALUES (@id, @name, @type, @icon, @description)
`);

for (const cat of categories) {
  insertCategory.run(cat);
}
console.log(`✅ Seeded ${categories.length} categories.`);

// 2. Seed Default Admin Users
const primaryAdminEmail = 'uhsna16@gmail.com';
const nonPrimaryUserIds = sqlite
  .prepare('SELECT id FROM users WHERE LOWER(email) <> LOWER(?)')
  .all(primaryAdminEmail)
  .map(({ id }) => id);

if (nonPrimaryUserIds.length > 0) {
  const userMarks = nonPrimaryUserIds.map(() => '?').join(', ');
  const bookingIds = sqlite
    .prepare(`SELECT id FROM bookings WHERE user_id IN (${userMarks}) OR provider_id IN (${userMarks})`)
    .all(...nonPrimaryUserIds, ...nonPrimaryUserIds)
    .map(({ id }) => id);
  const paymentIds = sqlite
    .prepare(`SELECT id FROM payments WHERE user_id IN (${userMarks}) OR booking_id IN (${bookingIds.length ? bookingIds.map(() => '?').join(', ') : "SELECT id FROM bookings WHERE 0"})`)
    .all(...nonPrimaryUserIds, ...(bookingIds.length ? bookingIds : []))
    .map(({ id }) => id);

  if (bookingIds.length || paymentIds.length) {
    const bookingMarks = bookingIds.length ? bookingIds.map(() => '?').join(', ') : "SELECT id FROM bookings WHERE 0";
    const paymentMarks = paymentIds.length ? paymentIds.map(() => '?').join(', ') : "SELECT id FROM payments WHERE 0";
    sqlite.prepare(`DELETE FROM refunds WHERE booking_id IN (${bookingMarks}) OR payment_id IN (${paymentMarks})`)
      .run(...bookingIds, ...paymentIds);
    sqlite.prepare(`DELETE FROM payments WHERE id IN (${paymentMarks}) OR user_id IN (${userMarks}) OR booking_id IN (${bookingMarks})`)
      .run(...paymentIds, ...nonPrimaryUserIds, ...bookingIds);
    sqlite.prepare(`DELETE FROM reviews WHERE user_id IN (${userMarks}) OR booking_id IN (${bookingMarks})`)
      .run(...nonPrimaryUserIds, ...bookingIds);
    sqlite.prepare(`DELETE FROM bookings WHERE id IN (${bookingMarks})`).run(...bookingIds);
  } else {
    sqlite.prepare(`DELETE FROM reviews WHERE user_id IN (${userMarks})`).run(...nonPrimaryUserIds);
  }

  sqlite.prepare(`DELETE FROM transport_locations WHERE vehicle_id IN (SELECT id FROM transport_vehicles WHERE provider_id IN (${userMarks}))`).run(...nonPrimaryUserIds);
  sqlite.prepare(`DELETE FROM transport_vehicles WHERE provider_id IN (${userMarks})`).run(...nonPrimaryUserIds);
  sqlite.prepare(`DELETE FROM verification_requests WHERE provider_id IN (${userMarks}) OR reviewed_by IN (${userMarks})`).run(...nonPrimaryUserIds, ...nonPrimaryUserIds);
  sqlite.prepare(`DELETE FROM transport_alerts WHERE created_by IN (${userMarks})`).run(...nonPrimaryUserIds);
  sqlite.prepare(`DELETE FROM audit_logs WHERE user_id IN (${userMarks})`).run(...nonPrimaryUserIds);
  sqlite.prepare(`DELETE FROM users WHERE id IN (${userMarks})`).run(...nonPrimaryUserIds);
}
const existingPrimaryAdmin = db.users.findByEmail(primaryAdminEmail);

if (!existingPrimaryAdmin) {
  const adminPasswordHash = bcrypt.hashSync('Admin@123', 10);
  db.users.create({
    id: 'usr-admin-uhsna',
    name: 'Master Admin (JTDC)',
    email: primaryAdminEmail,
    phone: '+91-651-2400981',
    password_hash: adminPasswordHash,
    role: 'admin',
    is_email_verified: 1,
    is_active: 1
  });
  console.log(`✅ Seeded Primary Master Admin: ${primaryAdminEmail} (password: Admin@123)`);
} else {
  sqlite.prepare("UPDATE users SET role = 'admin', is_email_verified = 1, is_active = 1 WHERE LOWER(email) = LOWER(?)").run(primaryAdminEmail);
  console.log(`ℹ️ Updated Master Admin account: ${primaryAdminEmail}`);
}


// 3. Seed Initial Jharkhand Destinations
const initialDestinations = [
  {
    id: 'netarhat',
    slug: 'netarhat',
    name: 'Netarhat',
    title: 'Netarhat Plateau - Queen of Chotanagpur',
    district: 'Latehar',
    category: 'Hill Station',
    lat: 23.4795,
    lng: 84.2697,
    rating: 4.9,
    review_count: 310,
    avg_cost: 4500,
    best_season: 'All Year Round',
    crowd_level: 'Moderate',
    image: 'C:\\Users\\uhsna\\Downloads\\Jharhand_Tourism\\frontend\\dist\\assets\\image.png',
    description: 'Known as the Queen of Chotanagpur, Netarhat is perched at 3,700 feet amidst dense pine woodlands, pear orchards, and spectacular sunrises at Magnolia Point.',
    opening_hours: 'Sunrise to Sunset (Magnolia Point open till 7:00 PM)',
    ticket_info: 'Free Entry. Eco-development fee ₹20 per vehicle.',
    attractions: JSON.stringify(['Magnolia Point Sunset', 'Netarhat Sunrise Hilltop', 'Upper Ghaghri Falls', 'Netarhat Residential School', 'Pine Forest Groves']),
    activities: JSON.stringify(['Magnolia Point Sunset Watching', 'Pine Forest Cycling & Nature Walk', 'Upper Ghaghri Forest Trek', 'Tribal Asur Craft Workshop']),
    nearby_hotels: JSON.stringify(['Prabhat Vihar Tourist Complex (JTDC)', 'Netarhat Pine Mist Heritage Homestay', 'Latehar Eco Lodge']),
    interests: JSON.stringify(['nature', 'hills', 'wildlife', 'culture']),
    is_active: 1
  },
  {
    id: 'betla-national-park',
    slug: 'betla-national-park',
    name: 'Betla National Park',
    title: 'Betla National Park & Palamu Tiger Reserve',
    district: 'Latehar',
    category: 'Wildlife & Safari',
    lat: 23.8864,
    lng: 84.1906,
    rating: 4.8,
    review_count: 290,
    avg_cost: 5000,
    best_season: 'November to April',
    crowd_level: 'Moderate',
    image: 'frontend/dist/assets/Betla-National-Park-ckJpPcxP.jpg',
    description: 'One of the first national parks in India to be declared a Project Tiger sanctuary. Dense sal forests host wild elephants, gaurs, leopards, sloth bears, and the ancient 16th-century Palamu Forts.',
    opening_hours: 'Morning Safari: 6:00 AM - 10:00 AM | Afternoon: 2:00 PM - 5:00 PM',
    ticket_info: 'Entry ₹100 per person. Jeep Safari: ₹1,500 per vehicle with certified guide.',
    attractions: JSON.stringify(['Palamu Twin Forts (Purana & Naya Qila)', 'Kamaldah Lake', 'Chhotka & Badka Chital Waterhole', 'Sal Forest Safari Tracks']),
    activities: JSON.stringify(['Jeep Wildlife Safari', 'Elephant Ride Safari', 'Historic Chero Fort Exploration', 'Bird Watching Trails']),
    nearby_hotels: JSON.stringify(['Van Vihar Betla (JTDC)', 'Palamu Treehouse Retreat', 'Betla Forest Rest House']),
    interests: JSON.stringify(['wildlife', 'adventure', 'culture', 'nature']),
    is_active: 1
  },
  {
    id: 'hundru-falls',
    slug: 'hundru-falls',
    name: 'Hundru Falls',
    title: 'Hundru Waterfalls - The 322ft Roar',
    district: 'Ranchi',
    category: 'Waterfalls',
    lat: 23.4475,
    lng: 85.6567,
    rating: 4.8,
    review_count: 240,
    avg_cost: 1500,
    best_season: 'July to February',
    crowd_level: 'High',
    image: 'frontend/dist/assets/Hundru-Waterfalls-CSt33okA.jpeg',
    description: 'Where the sacred Subarnarekha River plunges 322 feet over polished metamorphic rocks into an immense natural swimming pool.',
    opening_hours: '8:00 AM - 5:30 PM (Daily)',
    ticket_info: 'Entry ₹15 per person. Parking ₹40.',
    attractions: JSON.stringify(['Subarnarekha River Gorge', 'Polished Rock Formation Plateau', 'River Valley Suspension Viewpoint']),
    activities: JSON.stringify(['Waterfall Gorge Viewing', 'Nature Trekking', 'Photography', 'Rural Handicraft Shopping']),
    nearby_hotels: JSON.stringify(['Subarnarekha Tourist Lodge', 'Waterfall Valley Eco Camp', 'Ranchi Plateau Resort']),
    interests: JSON.stringify(['nature', 'adventure', 'waterfalls']),
    is_active: 1
  },
  {
    id: 'jonha-falls',
    slug: 'jonha-falls',
    name: 'Jonha Falls',
    title: 'Jonha Falls (Gautamdhara)',
    district: 'Ranchi',
    category: 'Waterfalls',
    lat: 23.3417,
    lng: 85.6083,
    rating: 4.7,
    review_count: 185,
    avg_cost: 1200,
    best_season: 'September to March',
    crowd_level: 'Moderate',
    image: 'C:\\Users\\uhsna\\Downloads\\Jharhand_Tourism\\frontend\\dist\\assets\\Jonha-Falls-DcWKAeFT.jpeg',
    description: 'A spectacular tiered cascade located where the Raru River plunges over rocky hanging valleys, crowned with an ancient Buddhist monastery and 722 steps of scenic descent.',
    opening_hours: '8:30 AM - 5:00 PM',
    ticket_info: 'Entry ₹10 per person.',
    attractions: JSON.stringify(['Lord Buddha Ashram', 'Raru River Descent (722 steps)', 'Gautamdhara Rest Pavilion']),
    activities: JSON.stringify(['722-Step Scenic Descent', 'Lord Buddha Temple Meditation', 'Forest Canopy Walk']),
    nearby_hotels: JSON.stringify(['Gautamdhara Eco Homestay', 'Angara Tourist Rest House']),
    interests: JSON.stringify(['nature', 'spiritual', 'culture', 'waterfalls']),
    is_active: 1
  },
  {
    id: 'dassam-falls',
    slug: 'dassam-falls',
    name: 'Dassam Falls',
    title: 'Dassam Falls (Da-song)',
    district: 'Ranchi',
    category: 'Waterfalls',
    lat: 23.1425,
    lng: 85.4678,
    rating: 4.7,
    review_count: 160,
    avg_cost: 1400,
    best_season: 'October to February',
    crowd_level: 'Moderate',
    image: 'C:\\Users\\uhsna\\Downloads\\Jharhand_Tourism\\frontend\\dist\\assets\\DassamFalls.png',
    description: 'Also called Da-song in the Mundari language (pouring of water), Dassam Falls cascades 144 feet across ten distinct natural chutes created by the Kanchi River.',
    opening_hours: '8:00 AM - 5:00 PM',
    ticket_info: 'Entry ₹15 per head.',
    attractions: JSON.stringify(['Ten-Chute Cascade Viewing Deck', 'Sal Forest Promenade', 'Kanchi River Bank']),
    activities: JSON.stringify(['Waterfall Photography', 'Sal Forest Nature Walk', 'Picnic by River Kanchi']),
    nearby_hotels: JSON.stringify(['Bundu Tourist Lodge', 'Dassam Valley Resort']),
    interests: JSON.stringify(['nature', 'adventure', 'waterfalls']),
    is_active: 1
  },
  {
    id: 'deoghar',
    slug: 'deoghar',
    name: 'Deoghar',
    title: 'Deoghar - Baba Baidyanath Dham',
    district: 'Deoghar',
    category: 'Spiritual & Heritage',
    lat: 24.4826,
    lng: 86.7003,
    rating: 4.9,
    review_count: 420,
    avg_cost: 2800,
    best_season: 'July to October',
    crowd_level: 'High',
    image: 'frontend/dist/assets/Deoghar-Shrines-BR6QrZvu.jpg',
    description: 'One of the most sacred pilgrimage centers in India, holding one of the twelve revered Shiva Jyotirlingas. Surrounding hills include Tapovan caves and the panoramic Trikut Ropeway.',
    opening_hours: 'Temple Darshan: 4:00 AM - 3:30 PM & 6:00 PM - 9:00 PM',
    ticket_info: 'General Darshan Free. VIP Smart-Card queue available.',
    attractions: JSON.stringify(['Baba Baidyanath Jyotirlinga Temple', 'Trikut Pahar (Ropeway & Trek)', 'Tapovan Caves & Shrines', 'Naulakha Temple']),
    activities: JSON.stringify(['Temple Darshan', 'Trikut Pahar Cable Car & Trek', 'Tapovan Cave Meditation', 'Famous Deoghar Peda Tasting']),
    nearby_hotels: JSON.stringify(['Hotel Baidyanath', 'Shiva International', 'Mayur Heritage Deoghar']),
    interests: JSON.stringify(['spiritual', 'culture', 'food']),
    is_active: 1
  },
  {
    id: 'parasnath',
    slug: 'parasnath',
    name: 'Parasnath',
    title: 'Parasnath Hills - Sammed Shikharji Peak',
    district: 'Giridih',
    category: 'Spiritual & Hills',
    lat: 23.9639,
    lng: 86.1311,
    rating: 4.8,
    review_count: 210,
    avg_cost: 3000,
    best_season: 'October to March',
    crowd_level: 'Moderate',
    image: 'C:\\Users\\uhsna\\Downloads\\Jharhand_Tourism\\frontend\\dist\\assets\\Parasnath-Hills-BmyMq52B.jpeg',
    description: 'The highest peak in Jharkhand at 1,365 meters, sacred worldwide as Sammed Shikharji where 20 of the 24 Jain Tirthankaras attained Moksha.',
    opening_hours: 'Pilgrim Trek Starts at 3:00 AM from Madhuban base',
    ticket_info: 'Free Pilgrimage Access. Doli service available for elderly.',
    attractions: JSON.stringify(['Sammed Shikharji Tonks', 'Madhuban Base Temples', 'Parasnath Wildlife Sanctuary', 'Giridih Ridge View']),
    activities: JSON.stringify(['Shikharji Pilgrimage Trek (27km circuit)', 'Sunrise from Highest Jharkhand Peak', 'Madhuban Museum Visit']),
    nearby_hotels: JSON.stringify(['Madhuban Pilgrimage Dharamshala', 'Parasnath Alpine Lodge', 'Giridih Tourist Guest House']),
    interests: JSON.stringify(['spiritual', 'adventure', 'nature', 'hills']),
    is_active: 1
  },
  {
    id: 'patratu-valley',
    slug: 'patratu-valley',
    name: 'Patratu Valley',
    title: 'Patratu Valley & Dam',
    district: 'Ramgarh',
    category: 'Eco-Tourism & Lakes',
    lat: 23.6708,
    lng: 85.3025,
    rating: 4.7,
    review_count: 175,
    avg_cost: 2000,
    best_season: 'October to March',
    crowd_level: 'High',
    image: 'C:\\Users\\uhsna\\Downloads\\Jharhand_Tourism\\frontend\\dist\\assets\\Patratu-Valley-Dam-ckJpPcxP.jpg',
    description: 'Renowned for its dramatic hairpin serpentine roads descending from emerald green hills towards the shimmering waters of the Patratu Dam.',
    opening_hours: 'Boating: 9:00 AM - 5:30 PM | Ghats open all day',
    ticket_info: 'Entry Free. Speedboat ₹400 per ride. Motorboat ₹100.',
    attractions: JSON.stringify(['S-Curve Mountain Highway', 'Patratu Lake Resort & Promenade', 'Island Watersports Center']),
    activities: JSON.stringify(['Serpentine Road Photography', 'Speedboat and Jet Ski Rides', 'Sunset by the Lake', 'Local Fried Fish Tasting']),
    nearby_hotels: JSON.stringify(['Patratu Lake Resort (JTDC)', 'Ramgarh Heritage Inn']),
    interests: JSON.stringify(['nature', 'adventure', 'eco']),
    is_active: 1
  },
  {
    id: 'hazaribagh',
    slug: 'hazaribagh',
    name: 'Hazaribagh',
    title: 'Hazaribagh National Park & Canary Hill',
    district: 'Hazaribagh',
    category: 'Wildlife & Safari',
    lat: 23.9933,
    lng: 85.3622,
    rating: 4.6,
    review_count: 140,
    avg_cost: 2200,
    best_season: 'October to April',
    crowd_level: 'Low',
    image: 'C:\\Users\\uhsna\\Downloads\\Jharhand_Tourism\\frontend\\dist\\assets\\Hazaribagh-National-Park-ckJpPcxP.jpg',
    description: 'Literally meaning "a thousand gardens", Hazaribagh is blessed with scenic hill viewpoints, tranquil lakes, and indigenous villages famous for UNESCO-recognized Sohrai wall murals.',
    opening_hours: 'Canary Hill: 6:00 AM - 6:00 PM | Lake: Open 24 Hours',
    ticket_info: 'Canary Hill Tower ₹10.',
    attractions: JSON.stringify(['Canary Hill Watchtower', 'Hazaribagh Lake', 'Sohrai Tribal Art Cooperative Villages', 'Hazaribagh Wildlife Sanctuary']),
    activities: JSON.stringify(['Sunset from Canary Hill Tower', 'Authentic Sohrai Painting Village Tour', 'Boating on Hazaribagh Lake']),
    nearby_hotels: JSON.stringify(['Hazaribagh Tourist Complex', 'Canary Inn Resort']),
    interests: JSON.stringify(['nature', 'culture', 'wildlife']),
    is_active: 1
  },
  {
    id: 'rajrappa',
    slug: 'rajrappa',
    name: 'Rajrappa',
    title: 'Chhinnamasta Temple Rajrappa',
    district: 'Ramgarh',
    category: 'Spiritual & Heritage',
    lat: 23.6322,
    lng: 85.7133,
    rating: 4.8,
    review_count: 220,
    avg_cost: 1800,
    best_season: 'October to March',
    crowd_level: 'High',
    image: 'C:\\Users\\uhsna\\Downloads\\Jharhand_Tourism\\frontend\\dist\\assets\\Chinmastika.png',
    description: 'A deeply revered Shakti Peeth situated at the sacred confluence of the Damodar and Bhairavi (Bhera) rivers, famous for the headless Goddess Chhinnamasta temple.',
    opening_hours: 'Temple: 5:00 AM - 8:00 PM',
    ticket_info: 'Darshan Free.',
    attractions: JSON.stringify(['Maa Chhinnamasta Temple', 'Bhairavi & Damodar River Confluence', 'Rajrappa Waterfall & Rapids']),
    activities: JSON.stringify(['River Sangam Bathing', 'Temple Puja and Aarti', 'Confluence Boat Ride']),
    nearby_hotels: JSON.stringify(['Rajrappa Tourist Rest House', 'Ramgarh Yatri Niwas']),
    interests: JSON.stringify(['spiritual', 'culture', 'nature']),
    is_active: 1
  }
];

for (const dest of initialDestinations) {
  const existing = db.destinations.findById(dest.id);
  if (!existing) {
    db.destinations.create(dest);
  } else if (existing.image !== dest.image) {
    sqlite.prepare('UPDATE destinations SET image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(dest.image, dest.id);
  }
}

for (const dest of additionalDestinations) {
  const existing = db.destinations.findById(dest.id);
  if (!existing) {
    db.destinations.create(dest);
  } else {
    db.destinations.update(dest.id, dest);
  }
}
console.log(`✅ Seeded ${initialDestinations.length + additionalDestinations.length} Jharkhand destinations.`);

// 4. Seed bookable guide and hotel packages owned by the tourism authority.
const initialServices = [
  {
    id: 'service-netarhat-guide',
    provider_id: 'usr-admin-uhsna',
    title: 'Netarhat Sunrise Guide Package',
    description: 'Certified local guide for Magnolia Point, sunrise trails, and forest walks.',
    category: 'guide',
    price: 1800,
    district: 'Latehar',
    duration_days: 1,
    image: 'C:\\Users\\uhsna\\Downloads\\Jharhand_Tourism\\frontend\\dist\\assets\\Netarhat.png',
    amenities: ['Certified guide', 'Sunrise transfer', 'Nature trail'],
    availability: { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    is_active: 1,
    approval_status: 'approved'
  },
  {
    id: 'service-betla-homestay',
    provider_id: 'usr-admin-uhsna',
    title: 'Betla Forest Lodge Stay',
    description: 'One-night forest lodge package with local breakfast and safari coordination.',
    category: 'homestay',
    price: 5200,
    district: 'Palamu',
    duration_days: 1,
    image: 'C:\\Users\\uhsna\\Downloads\\Jharhand_Tourism\\frontend\\dist\\assets\\Betla-National-Park-ckJpPcxP.jpg',
    amenities: ['Forest lodge', 'Breakfast', 'Safari coordination'],
    availability: { checkIn: '14:00', checkOut: '11:00' },
    is_active: 1,
    approval_status: 'approved'
  },
  {
    id: 'service-jharkhand-circuit-package',
    provider_id: 'usr-admin-uhsna',
    title: 'Jharkhand Highlights Travel Package',
    description: 'Three-day package covering a waterfall, forest safari, accommodation, and local transfers.',
    category: 'package',
    price: 14500,
    district: 'Statewide',
    duration_days: 3,
    image: 'C:\\Users\\uhsna\\Downloads\\Jharhand_Tourism\\frontend\\dist\\assets\\JharkhandCircuit.png',
    amenities: ['Guide', 'Hotel stay', 'Local transfers', 'Breakfast'],
    availability: { bookingNotice: 'Advance booking required' },
    is_active: 1,
    approval_status: 'approved'
  }
];

for (const service of initialServices) {
  if (!db.services.findById(service.id)) db.services.create(service);
}
console.log(`✅ Seeded ${initialServices.length} bookable guide and hotel packages.`);

// 5. Seed Initial Marketplace Products under the sole admin account.
const coopUser = db.users.findByEmail(primaryAdminEmail);

const initialProducts = [
  {
    id: 'prod-sohrai-peacock',
    vendor_id: coopUser.id,
    name: 'Sohrai Peacock Painting',
    description: 'Traditional ritual Sohrai artwork handcrafted on handmade paper with all-natural mineral and botanical earth pigments by master tribal women artists of Hazaribagh.',
    category: 'Paintings',
    price: 2695,
    stock: 24,
    district: 'Hazaribagh',
    material: 'Natural Mineral Pigments & Handmade Rice Paper',
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Sohrai_painting,_Jharkhand.jpg',
    badge: 'Heritage',
    is_active: 1,
    approval_status: 'approved'
  },
  {
    id: 'prod-dhokra-nandi',
    vendor_id: coopUser.id,
    name: 'Dhokra Nandi Pair',
    description: 'Hand-cast brass Dhokra Nandi bull figurines created using 4,000-year-old lost-wax bell metal casting metallurgy preserved by Malhar artisans.',
    category: 'Dhokra',
    price: 2995,
    stock: 15,
    district: 'Ramgarh',
    material: 'Bell Metal Brass',
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Dokra_from_tribes_of_Bastar_DSCN1172_01.jpg',
    badge: 'Handmade',
    is_active: 1,
    approval_status: 'approved'
  },
  {
    id: 'prod-tasar-silk-saree',
    vendor_id: coopUser.id,
    name: 'Handwoven Tasar Silk Saree',
    description: 'Certified Jharkhand Tasar Gheecha Silk handloom saree, spun from wild cocoon silk harvested from Arjun and Asan trees with natural botanical dyes.',
    category: 'Textiles',
    price: 3200,
    stock: 18,
    district: 'Ranchi',
    material: 'Pure Tasar Gheecha Silk',
    image: 'https://www.jiomart.com/images/product/original/rvybw3lmm1/jharcraft-a-jharkhand-govt-enterprise-reeled-tasar-gheecha-silk-printed-saree-product-images-orvybw3lmm1-p609022685-2-202405190828.jpg?im=Resize%3D%281000%2C1000%29',
    badge: 'Tasar Silk',
    is_active: 1,
    approval_status: 'approved'
  },
  {
    id: 'prod-bamboo-basket',
    vendor_id: coopUser.id,
    name: 'Jharkhand Split-Bamboo Fruit Basket',
    description: 'Handwoven split-bamboo utility basket fashioned using indigenous geometry and finished with natural beeswax for lasting durability.',
    category: 'Bamboo',
    price: 1250,
    stock: 35,
    district: 'Dumka',
    material: 'Organic Split Bamboo',
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Bamboo_Basket_of_Jharkhand.jpg',
    badge: 'Eco Craft',
    is_active: 1,
    approval_status: 'approved'
  },
  {
    id: 'prod-silver-anklets',
    vendor_id: coopUser.id,
    name: 'Traditional Tribal Silver Payal Anklets',
    description: 'Traditional solid silver ceremonial payal anklets engraved with Santhal tribal star and river waveforms by Chotanagpur silversmiths.',
    category: 'Jewellery',
    price: 1850,
    stock: 10,
    district: 'Ranchi',
    material: '92.5 Sterling Silver',
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Anklets,Payal,_Jharkhand.jpg',
    badge: 'Traditional',
    is_active: 1,
    approval_status: 'approved'
  },
  {
    id: 'prod-dhokra-fisherwoman',
    vendor_id: coopUser.id,
    name: 'Dhokra Fisherwoman Figurine',
    description: 'Detailed lost-wax bronze figurine representing an indigenous fisherwoman carrying woven traps, showcasing authentic tribal folk art.',
    category: 'Dhokra',
    price: 1495,
    stock: 20,
    district: 'Ramgarh',
    material: 'Lost-wax Cast Brass',
    image: 'https://static.wixstatic.com/media/9dd462_5db601b5d3a6482a9650f5e40474d9c6~mv2.jpg/v1/fill/w_1340,h_960,al_c,q_85,enc_avif,quality_auto/9dd462_5db601b5d3a6482a9650f5e40474d9c6~mv2.jpg',
    badge: 'Handmade',
    is_active: 1,
    approval_status: 'approved'
  }
];

for (const prod of initialProducts) {
  const existing = db.products.findById(prod.id);
  if (!existing) {
    db.products.create(prod);
  }
}
console.log(`✅ Seeded ${initialProducts.length} initial marketplace products.`);

console.log('✨ Jharkhand Tourism Database Seeding Completed Successfully! ✨');
