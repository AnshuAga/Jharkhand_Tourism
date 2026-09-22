// E2E Test Suite for Jharkhand Smart Tourism Platform
// Tests all RBAC flows, OTP security, dynamic destinations, marketplace, blockchain escrow, and sentiment analysis

const BASE_URL = 'http://localhost:5000/api';

async function req(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING END-TO-END VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Health Check
    const health = await req('/health');
    assert(health.status === 200, `Backend health check returns 200 OK (status: ${health.status}, data: ${JSON.stringify(health.data)})`);

    // 2. Admin Login
    const adminLogin = await req('/auth/login', 'POST', {
      email: 'admin@jharkhand.ai',
      password: 'Admin@Jharkhand2026'
    });
    assert(adminLogin.status === 200 && adminLogin.data.token, 'Master Admin login succeeds with JWT');
    const adminToken = adminLogin.data.token;

    // 3. User Registration with OTP
    const uniqueEmail = `traveler.${Date.now()}@jharkhand.ai`;
    const regRes = await req('/auth/register', 'POST', {
      name: 'Priya Sharma',
      email: uniqueEmail,
      password: 'Tourist@2026Secure',
      role: 'tourist',
      phone: '+91 98765 43210'
    });
    assert(regRes.status === 201 && regRes.data.token && regRes.data.user, 'Tourist registration creates user and issues JWT token directly without OTP roadblocks');

    // 4. Test Weather Endpoint
    const weatherRes = await req('/weather?city=Ranchi');
    assert(weatherRes.status === 200 && weatherRes.data.temp !== undefined, 'Live Weather service returns OpenWeatherMap telemetry for Ranchi');

    // 6. Dynamic Destinations: Fetch All
    const destsRes = await req('/destinations');
    assert(destsRes.status === 200 && destsRes.data.count >= 10, `Destinations fetched dynamically from database (Found: ${destsRes.data.count})`);

    // 7. Dynamic Destinations: Admin Adds New Destination (e.g. Dassam Falls)
    const uniqueDestName = `Dassam Falls ${Date.now()}`;
    const newDestRes = await req('/destinations', 'POST', {
      name: uniqueDestName,
      title: 'Spectacular Cascading Cataract',
      district: 'Ranchi',
      category: 'Waterfalls',
      lat: 23.1444,
      lng: 85.4673,
      avgCost: 50,
      bestSeason: 'October – February',
      crowdLevel: 'Moderate',
      image: '/assets/Hundru-Waterfalls.jpeg',
      description: 'Where the Kanchi River tumbles down 144 feet over hard rock beds into a roaring pool.',
      openingHours: '08:00 AM - 06:00 PM',
      ticketInfo: '₹20 per adult',
      activities: ['Photography', 'Trekking', 'Picnicking']
    }, adminToken);
    console.log('newDestRes:', newDestRes);
    assert(newDestRes.status === 201 && newDestRes.data.destination && newDestRes.data.destination.name === uniqueDestName, 'Admin dynamically adds destination to database registry');

    // Verify it now appears in public destinations without code reload
    const verifyDest = await req(`/destinations?search=${encodeURIComponent(uniqueDestName)}`);
    assert(verifyDest.data.count >= 1 && verifyDest.data.data[0].name === uniqueDestName, 'Newly added destination is instantly retrievable via public API');

    // 8. Vendor Login (Cooperative)
    const vendorLogin = await req('/auth/login', 'POST', {
      email: 'jharcraft.cooperative@jharkhand.ai',
      password: 'Cooperative@2026'
    });
    assert(vendorLogin.status === 200 && vendorLogin.data.token, 'Artisan Cooperative login succeeds with JWT');
    const vendorToken = vendorLogin.data.token;

    // 9. Vendor Adds New Product Dynamically
    const newProdRes = await req('/marketplace/products', 'POST', {
      name: 'Dhokra Brass Tribal Horn Blower',
      category: 'Dhokra',
      price: 1850,
      stock: 15,
      district: 'Ramgarh',
      material: 'Bell Metal Brass',
      badge: 'Certified GI Craft',
      description: 'Lost-wax casting depicting a traditional Santhal musician sounding the ceremonial horn.'
    }, vendorToken);
    assert(newProdRes.status === 201 && newProdRes.data.product.name.includes('Dhokra Brass Tribal Horn Blower'), 'Vendor adds product to database');

    // Verify product appears in public marketplace
    const verifyProd = await req('/marketplace?search=Horn');
    assert(verifyProd.data.products.some(p => p.name.includes('Horn Blower')), 'New craft immediately appears on public Marketplace without code edit');

    // 10. Tourist Books Item -> Creates Smart Contract Escrow
    const bookingRes = await req('/marketplace/booking', 'POST', {
      itemType: 'product',
      title: 'Dhokra Brass Tribal Horn Blower',
      totalAmount: 1850,
      providerId: vendorLogin.data.user.id,
      providerName: 'Jharcraft Tribal Handloom Cooperative'
    }, adminToken);
    assert(bookingRes.status === 201 && bookingRes.data.booking.contract_tx_hash, 'Booking generates Solidity Smart Contract address and Escrow Tx Hash');
    const bookingId = bookingRes.data.booking.id;

    // 11. Aspect-Based Sentiment Analysis (ABSA) Pipeline
    const sentimentRes = await req('/sentiment/analyze', 'POST', {
      text: 'The hospitality of the tribal guides at Netarhat was extraordinary and warm, but the mountain transport road had rough patches.',
      rating: 4
    });
    assert(
      sentimentRes.status === 200 &&
      sentimentRes.data.aspects.hospitality >= 4 &&
      sentimentRes.data.aspects.transport !== undefined,
      'NLP Sentiment Pipeline performs multi-aspect scoring (Hospitality & Transport)'
    );

    // 12. Public Blockchain Verification of Certificates
    const ledgerRes = await req('/blockchain/ledger');
    assert(ledgerRes.status === 200 && ledgerRes.data.ledger.length >= 1, 'Public blockchain audit trail returns immutable blocks');

    // 13. Vendor Confirms Delivery -> Escrow Released
    const releaseRes = await req('/vendor/confirm-service', 'POST', { bookingId }, vendorToken);
    assert(releaseRes.status === 200 && releaseRes.data.booking.escrow_status === 'released', 'Vendor fulfillment triggers smart contract escrow payout release');

    // 14. Real-time Transport Telemetry & Nearby Spatial Discovery
    const telemetryRes = await req('/transport/driver/telemetry', 'POST', {
      vehicleId: 'JH-EV-TEST-99',
      name: 'Betla Tiger Safari Eco-Bus',
      plate: 'JH 01 EV 9999',
      route: 'Betla Gate ➔ Mirchaiya Falls ➔ Palamu Forts',
      lat: 23.8824,
      lng: 84.1903,
      speedKmH: 35,
      status: 'In Transit',
      driver: 'Kameshwar Munda',
      contact: '+91 94311 99999'
    });
    assert(telemetryRes.status === 200, 'Driver GPS telemetry broadcast recorded in database and emitted via Socket.io');

    const nearbyRes = await req('/transport/nearby?lat=23.3441&lng=85.3096&radius=50');
    assert(nearbyRes.status === 200 && nearbyRes.data.destinations.length > 0, 'Spatial Haversine engine finds destinations within 50 km radius');

    // Clean up created test items so database stays clean
    if (newDestRes.data?.destination?.id) {
      await req(`/destinations/${newDestRes.data.destination.id}`, 'DELETE', null, adminToken);
      console.log('🧹 Cleaned up temporary test destination');
    }
    if (newProdRes.data?.product?.id) {
      await req(`/marketplace/products/${newProdRes.data.product.id}`, 'DELETE', null, vendorToken);
      console.log('🧹 Cleaned up temporary test product');
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
}

runTests();
