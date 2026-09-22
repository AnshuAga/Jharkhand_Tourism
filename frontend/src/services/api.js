const BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:5000/api' : '/api');

function getAuthHeader() {
  const token = localStorage.getItem('jharkhand_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers
    });
  } catch (netErr) {
    // If direct port 5000 failed, attempt relative proxy fallback
    if (BASE_URL !== '/api') {
      try {
        response = await fetch(`/api${endpoint}`, {
          ...options,
          headers
        });
      } catch (fallbackErr) {
        throw new Error('Unable to connect to backend server at http://localhost:5000. Please check that the server is running.');
      }
    } else {
      throw new Error('Unable to connect to backend server at http://localhost:5000. Please check that the server is running.');
    }
  }

  const data = await response.json().catch(() => ({ success: false, message: 'Invalid JSON response from server' }));
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }
  return data;
}

export const api = {
  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    verifyEmailOTP: (data) => request('/auth/verify-email-otp', { method: 'POST', body: JSON.stringify(data) }),
    resendOTP: (data) => request('/auth/resend-otp', { method: 'POST', body: JSON.stringify(data) }),
    requestLoginOTP: (data) => request('/auth/request-login-otp', { method: 'POST', body: JSON.stringify(data) }),
    forgotPassword: (data) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) }),
    resetPassword: (data) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
    getMe: () => request('/auth/me'),
    updateProfile: (profile) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(profile) }),
    changePassword: (passwords) => request('/auth/change-password', { method: 'PUT', body: JSON.stringify(passwords) })
  },
  itinerary: {
    plan: (preferences) => request('/itinerary/plan', { method: 'POST', body: JSON.stringify(preferences) })
  },
  enquiries: {
    create: (enquiry) => request('/enquiries', { method: 'POST', body: JSON.stringify(enquiry) })
  },
  weather: {
    get: (city = 'Ranchi') => request(`/weather?city=${encodeURIComponent(city)}`)
  },
  destinations: {
    getAll: (params = '') => request(`/destinations${params}`),
    getById: (id) => request(`/destinations/${id}`),
    create: (destData) => request('/destinations', { method: 'POST', body: JSON.stringify(destData) }),
    update: (id, destData) => request(`/destinations/${id}`, { method: 'PUT', body: JSON.stringify(destData) }),
    delete: (id) => request(`/destinations/${id}`, { method: 'DELETE' })
  },
  chatbot: {
    sendMessage: (message, conversationHistory, options = {}) =>
      request('/chatbot/message', { method: 'POST', body: JSON.stringify({ message, conversationHistory }), ...options }),
    streamMessage: async (message, conversationHistory, { signal, onChunk, onComplete, itineraryContext } = {}) => {
      const requestId = globalThis.crypto?.randomUUID?.() || `birsa-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = await fetch(`${BASE_URL}/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-Birsa-Request-Id': requestId, ...getAuthHeader() },
        body: JSON.stringify({ message, conversationHistory, itineraryContext, stream: true }),
        signal
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Request failed with status ${response.status}`);
      }
      if (!response.body) throw new Error('Streaming is not supported by this browser.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const handleEvent = (event) => {
        const dataLine = event.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) return;
        const payload = JSON.parse(dataLine.slice(5).trim());
        if (payload.type === 'chunk') onChunk?.(payload.text);
        if (payload.type === 'complete') onComplete?.(payload);
        if (payload.type === 'error') throw new Error(payload.message || 'Streaming failed.');
      };
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n');
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          handleEvent(event);
        }
        if (done) {
          if (buffer.trim()) handleEvent(buffer);
          break;
        }
      }
    }
  },
  marketplace: {
    getData: (params = '') => request(`/marketplace${params}`),
    book: (bookingData) => request('/marketplace/booking', { method: 'POST', body: JSON.stringify(bookingData) }),
    getMyBookings: () => request('/marketplace/my-bookings'),
    createProduct: (productData) => request('/marketplace/products', { method: 'POST', body: JSON.stringify(productData) }),
    updateProduct: (id, productData) => request(`/marketplace/products/${id}`, { method: 'PUT', body: JSON.stringify(productData) }),
    deleteProduct: (id) => request(`/marketplace/products/${id}`, { method: 'DELETE' })
  },
  blockchain: {
    verify: (certId) => request('/blockchain/verify', { method: 'POST', body: JSON.stringify({ certId }) }),
    getCertificates: () => request('/blockchain/certificates'),
    getLedger: () => request('/blockchain/ledger'),
    releaseEscrow: (bookingId) => request('/blockchain/escrow/release', { method: 'POST', body: JSON.stringify({ bookingId }) }),
    refundEscrow: (bookingId, reason) => request('/blockchain/escrow/refund', { method: 'POST', body: JSON.stringify({ bookingId, reason }) }),
    issueCertificate: (certData) => request('/blockchain/issue', { method: 'POST', body: JSON.stringify(certData) })
  },
  sentiment: {
    analyze: (text, rating) => request('/sentiment/analyze', { method: 'POST', body: JSON.stringify({ text, rating }) }),
    submitReview: (reviewData) => request('/sentiment/review', { method: 'POST', body: JSON.stringify(reviewData) }),
    getReviews: (params = '') => request(`/sentiment/reviews${params}`),
    getAnalytics: () => request('/sentiment/analytics')
  },
  transport: {
    getMapConfig: () => request('/transport/map-config'),
    getLiveVehicles: () => request('/transport/live'),
    getNearby: (lat, lng, radius) => request(`/transport/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
    getRoute: (from, to) => request(`/transport/route?from=${from}&to=${to}`),
    getAlerts: () => request('/transport/alerts'),
    createAlert: (alertData) => request('/transport/alerts', { method: 'POST', body: JSON.stringify(alertData) }),
    deleteAlert: (id) => request(`/transport/alerts/${id}`, { method: 'DELETE' }),
    updateTelemetry: (data) => request('/transport/driver/telemetry', { method: 'POST', body: JSON.stringify(data) })
  },
  arvr: {
    getExperiences: () => request('/arvr/experiences')
  },
  admin: {
    getAnalytics: () => request('/admin/analytics'),
    getEnquiries: () => request('/admin/enquiries'),
    createService: (serviceData) => request('/admin/services', { method: 'POST', body: JSON.stringify(serviceData) }),
    getServices: (params = '') => request(`/admin/services${params}`),
    reviewService: (id, decision) => request(`/admin/services/${id}/review`, { method: 'PUT', body: JSON.stringify(decision) }),
    getUsers: (params = '') => request(`/admin/users${params}`),
    toggleUserStatus: (id, isActive) => request(`/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ isActive }) }),
    getVerifications: () => request('/admin/verifications'),
    approveKYC: (providerData) => request('/admin/kyc/approve', { method: 'POST', body: JSON.stringify(providerData) }),
    rejectKYC: (providerData) => request('/admin/kyc/reject', { method: 'POST', body: JSON.stringify(providerData) }),
    getBookings: () => request('/admin/bookings'),
    getPayments: () => request('/admin/payments')
  },
  vendor: {
    getDashboard: () => request('/vendor/dashboard'),
    submitKYC: (kycData) => request('/vendor/kyc', { method: 'POST', body: JSON.stringify(kycData) }),
    updateProfile: (profileData) => request('/vendor/profile', { method: 'PUT', body: JSON.stringify(profileData) }),
    addService: (serviceData) => request('/vendor/services', { method: 'POST', body: JSON.stringify(serviceData) }),
    confirmService: (bookingId) => request('/vendor/confirm-service', { method: 'POST', body: JSON.stringify({ bookingId }) })
  },
  tourist: {
    getDashboard: () => request('/tourist/dashboard'),
    updatePreferences: (prefData) => request('/tourist/preferences', { method: 'PUT', body: JSON.stringify(prefData) }),
    toggleFavourite: (targetType, targetId) => request('/tourist/favourites', { method: 'POST', body: JSON.stringify({ targetType, targetId }) }),
    getFavourites: () => request('/tourist/favourites')
  }
};
