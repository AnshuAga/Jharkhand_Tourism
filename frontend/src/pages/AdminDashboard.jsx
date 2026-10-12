import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import SentimentAnalysis from './SentimentAnalysis';
import {
  ShieldCheck,
  TrendingUp,
  Users,
  Activity,
  Award,
  AlertTriangle,
  Send,
  Mail,
  CheckCircle2,
  Database,
  MapPin,
  Smile,
  Frown,
  Meh,
  Plus,
  Trash2,
  Edit2,
  X,
  ExternalLink,
  Copy,
  DollarSign,
  FileCheck,
  Lock,
  Unlock,
  RotateCcw
} from 'lucide-react';

const jharkhandDistricts = [
  'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum',
  'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara',
  'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu',
  'Ramgarh', 'Ranchi', 'Sahibganj', 'Seraikela-Kharsawan', 'Simdega',
  'West Singhbhum'
];

const serviceAmenityOptions = [
  'Breakfast',
  'Local transfers',
  'Certified guide',
  'Nature trail',
  'Safari coordination',
  'Wi-Fi',
  'Parking',
  'Air conditioning',
  'Wheelchair accessible',
  'Accessible bathroom',
  'Ground-floor room',
  'Family friendly'
];

const restaurantAmenityOptions = [
  'Local cuisine',
  'Vegetarian options',
  'Non-vegetarian options',
  'Jain food',
  'Tribal cuisine',
  'Breakfast',
  'Outdoor seating',
  'Family friendly',
  'Parking',
  'Wi-Fi',
  'Home delivery'
];

const guideTraitOptions = ['Certified guide', 'Nature trail', 'Safari coordination', 'Local expert', 'Photography'];

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics'); // analytics | sentiment | reviews | destinations | services | users | verifications | bookings | enquiries
  const [reviewList, setReviewList] = useState([]);
  const [reviewIntelligence, setReviewIntelligence] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewFilter, setReviewFilter] = useState({ status: '', risk: '' });
  const [data, setData] = useState(null);
  const [recommendationAnalytics, setRecommendationAnalytics] = useState(null);
  const [copiedLedgerHash, setCopiedLedgerHash] = useState('');
  const [copiedProviderValue, setCopiedProviderValue] = useState('');
  const [selectedProviderDetails, setSelectedProviderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');

  const handleDeleteReview = async (review) => {
    if (!window.confirm('Delete this review permanently? This cannot be undone.')) return;
    try {
      await api.admin.deleteReview(review.id);
      setReviewList((items) => items.filter((item) => item.id !== review.id));
      setActionMessage('Review deleted successfully.');
    } catch (error) {
      setActionMessage(`Error: ${error.message}`);
    }
  };

  const handleReanalyzeReview = async (review) => {
    try {
      const response = await api.admin.reanalyzeReview(review.id);
      setReviewList((items) => items.map((item) => item.id === review.id ? response.review : item));
      setActionMessage('Review detection completed.');
    } catch (error) {
      setActionMessage(`Error: ${error.message}`);
    }
  };

  const handleSentimentVerification = async (review, verifiedSentiment) => {
    if (!verifiedSentiment) return;
    const previousReview = review;
    setReviewList((items) => items.map((item) => item.id === review.id
      ? { ...item, verified_sentiment: verifiedSentiment }
      : item));
    try {
      const response = await api.admin.annotateReview(review.id, { verifiedSentiment });
      setReviewList((items) => items.map((item) => item.id === review.id ? response.review : item));
      await fetchReviewIntelligence();
      setActionMessage('Sentiment verification saved.');
    } catch (error) {
      setReviewList((items) => items.map((item) => item.id === review.id ? previousReview : item));
      setActionMessage(`Error: ${error.message}`);
    }
  };

  // Destination Management State
  const [destList, setDestList] = useState([]);
  const [destinationFilters, setDestinationFilters] = useState({
    search: '',
    district: 'All',
    category: 'All',
    status: 'all'
  });
  const [isDestModalOpen, setIsDestModalOpen] = useState(false);
  const [editingDestinationId, setEditingDestinationId] = useState(null);
  const [destForm, setDestForm] = useState({
    name: '',
    title: '',
    district: 'Ranchi',
    category: 'Waterfalls',
    lat: 23.3441,
    lng: 85.3096,
    avg_cost: '',
    best_season: '',
    crowd_level: 'Moderate',
    description: '',
    image: '',
    opening_hours: '',
    ticket_info: '',
    activities: ''
  });
  const [destSubmitting, setDestSubmitting] = useState(false);

  const resetDestinationForm = () => {
    setDestForm({
      name: '', title: '', district: 'Ranchi', category: 'Waterfalls',
      lat: '', lng: '', avg_cost: '',
      best_season: '', crowd_level: 'Moderate',
      description: '', image: '', opening_hours: '',
      ticket_info: '',
      activities: ''
    });
    setEditingDestinationId(null);
  };

  const openDestinationEditor = (destination = null) => {
    if (destination) {
      setEditingDestinationId(destination.id);
      setDestForm({
        name: destination.name || '',
        title: destination.title || '',
        district: destination.district || 'Ranchi',
        category: destination.category || 'Waterfalls',
        lat: destination.lat ?? 23.3441,
        lng: destination.lng ?? 85.3096,
        avg_cost: destination.avg_cost ?? 0,
        best_season: destination.best_season || 'October – March',
        crowd_level: destination.crowd_level || 'Moderate',
        description: destination.description || '',
        image: destination.image || '',
        opening_hours: destination.opening_hours || '08:00 AM - 06:00 PM',
        ticket_info: destination.ticket_info || '',
        activities: Array.isArray(destination.activities) ? destination.activities.join(', ') : (destination.activities || '')
      });
    } else {
      resetDestinationForm();
    }
    setIsDestModalOpen(true);
  };

  const handleDestinationImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setActionMessage('Error: Please select a valid image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setActionMessage('Error: Image must be 5 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDestForm((current) => ({ ...current, image: reader.result }));
    reader.onerror = () => setActionMessage('Error: Unable to read the selected image.');
    reader.readAsDataURL(file);
  };

  // User Management State
  const [userList, setUserList] = useState([]);
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // KYC Management State
  const [verificationsData, setVerificationsData] = useState(null);
  const [kycRejectReason, setKycRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);

  // Bookings State
  const [bookingsList, setBookingsList] = useState([]);
  const [enquiriesList, setEnquiriesList] = useState([]);
  const [serviceForm, setServiceForm] = useState({
    title: '', description: '', category: 'homestay', price: '', district: 'Ranchi',
    duration: 'Full Day', durationDays: 1, startingLocation: '', destination: '', meetingPoint: '',
    amenities: [], guideTraits: [], availableFrom: '', availableTo: '', maxGroupSize: '', image: '',
    venueName: '', roomType: 'Standard', availableRooms: '',
    guideName: '', hotelName: '', restaurantName: '',
    selectedGuides: [], selectedHotels: [], selectedRestaurants: [],
    intermediateStops: [{ district: '', name: '' }],
    roomTypes: [{ type: 'AC Double Bed', pricePerPerson: '', availableRooms: '' }],
    hotelRoomTypes: {},
    manualServices: { hotels: [], guides: [], restaurants: [] },
    manualDefaults: { hotels: true, guides: true, restaurants: true }
  });
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [servicesList, setServicesList] = useState([]);

  const renderManualOptions = (type, item, index) => {
    const field = type === 'guides' ? 'traits' : 'amenities';
    const options = type === 'guides' ? guideTraitOptions : type === 'restaurants' ? restaurantAmenityOptions : serviceAmenityOptions;
    return <fieldset className="md:col-span-2 rounded-xl border border-slate-700 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{type === 'guides' ? 'Guide traits' : 'Amenities'}</legend>
      <div className="grid gap-2 md:grid-cols-3">
        {options.map((option) => <label key={option} className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-300">
          <input type="checkbox" checked={(item[field] || []).includes(option)} onChange={(event) => setServiceForm((current) => ({ ...current, manualServices: { ...current.manualServices, [type]: current.manualServices[type].map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: event.target.checked ? [...(entry[field] || []), option] : (entry[field] || []).filter((value) => value !== option) } : entry) } }))} />
          {option}
        </label>)}
      </div>
    </fieldset>;
  };

  const handleServiceImage = (event, manualType, manualIndex) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setActionMessage('Error: Please select a valid package image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setActionMessage('Error: Package image must be 5 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setServiceForm((current) => manualType
      ? ({ ...current, manualServices: { ...current.manualServices, [manualType]: current.manualServices[manualType].map((entry, index) => index === manualIndex ? { ...entry, image: reader.result } : entry) } })
      : ({ ...current, image: reader.result }));
    reader.onerror = () => setActionMessage('Error: Unable to read the package image.');
    reader.readAsDataURL(file);
  };

  // Broadcast Alert Form
  const [alertTitle, setAlertTitle] = useState('');
  const [alertLocation, setAlertLocation] = useState('Netarhat Plateau');
  const [alertType, setAlertType] = useState('Weather');
  const [alertSeverity, setAlertSeverity] = useState('Warning');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const [alertsList, setAlertsList] = useState([]);

  // Initial Fetch Analytics
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [res, reviewAnalytics, recommendationData] = await Promise.all([
        api.admin.getAnalytics(),
        api.sentiment.getAnalytics(),
        api.admin.getRecommendationAnalytics()
      ]);
      if (recommendationData?.success) setRecommendationAnalytics(recommendationData);
      if (res && res.success) {
        setData({ ...res, sentiment: reviewAnalytics?.success === false ? res.sentiment : reviewAnalytics });
      }
    } catch (err) {
      console.warn('Admin analytics fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyLedgerHash = async (hash) => {
    if (!hash || !navigator.clipboard) return;
    await navigator.clipboard.writeText(hash);
    setCopiedLedgerHash(hash);
    window.setTimeout(() => setCopiedLedgerHash(''), 1600);
  };

  const copyProviderValue = async (value) => {
    if (!value || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopiedProviderValue(value);
    window.setTimeout(() => setCopiedProviderValue(''), 1600);
  };

  const fetchDestinations = async () => {
    try {
      const params = new URLSearchParams({
        onlyActive: destinationFilters.status === 'all' ? 'false' : destinationFilters.status === 'active' ? 'true' : 'false'
      });
      if (destinationFilters.search.trim()) params.set('search', destinationFilters.search.trim());
      if (destinationFilters.district !== 'All') params.set('district', destinationFilters.district);
      if (destinationFilters.category !== 'All') params.set('category', destinationFilters.category);
      const res = await api.destinations.getAll(`?${params.toString()}`);
      if (res && res.success) {
        const destinations = res.data || res.destinations || [];
        setDestList(destinationFilters.status === 'inactive'
          ? destinations.filter((destination) => Number(destination.is_active) === 0)
          : destinations);
      }
    } catch (err) {
      console.error('Failed to load destinations:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      let q = '';
      if (userRoleFilter) q += `?role=${userRoleFilter}`;
      const res = await api.admin.getUsers(q);
      if (res && res.success) {
        setUserList(res.users || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const fetchVerifications = async () => {
    try {
      const res = await api.admin.getVerifications();
      if (res && res.success) {
        setVerificationsData(res);
      }
    } catch (err) {
      console.error('Failed to load verifications:', err);
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await api.admin.getBookings();
      if (res && res.success) {
        setBookingsList(res.bookings || []);
      }
    } catch (err) {
      console.error('Failed to load bookings:', err);
    }
  };

  const fetchEnquiries = async () => {
    try {
      const res = await api.admin.getEnquiries();
      if (res && res.success) {
        setEnquiriesList(res.enquiries || []);
      }
    } catch (err) {
      console.error('Failed to load enquiries:', err);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await api.admin.getServices();
      if (res?.success) setServicesList(res.services || []);
    } catch (err) {
      console.error('Failed to load tour packages:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await api.transport.getAlerts();
      if (res && res.success) setAlertsList(res.alerts || []);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  };

  const fetchReviewIntelligence = async () => {
    setReviewLoading(true);
    setReviewError('');
    try {
      const params = new URLSearchParams();
      if (reviewFilter.status) params.set('status', reviewFilter.status);
      if (reviewFilter.risk) params.set('risk', reviewFilter.risk);
      const response = await api.admin.getReviewIntelligence(params.toString());
      if (!response?.success || !response.stats || !Array.isArray(response.reviews)) {
        throw new Error('The review intelligence response is incomplete.');
      }
      setReviewIntelligence(response);
      setReviewList(response.reviews);
    } catch (error) {
      setReviewIntelligence(null);
      setReviewList([]);
      setReviewError(error.message);
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchDestinations();
  }, []);

  useEffect(() => {
    if (activeTab === 'destinations') fetchDestinations();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'verifications') fetchVerifications();
    if (activeTab === 'bookings') fetchBookings();
    if (activeTab === 'enquiries') fetchEnquiries();
    if (activeTab === 'services') fetchServices();
    if (activeTab === 'analytics') fetchAlerts();
    if (activeTab === 'reviews') fetchReviewIntelligence();
  }, [activeTab, userRoleFilter, destinationFilters, reviewFilter]);

  const handleReviewService = async (service, status) => {
    const reason = status !== 'approved' ? window.prompt(`Enter the reason for ${status === 'changes_requested' ? 'requested changes' : 'rejection'}:`) : '';
    if (status !== 'approved' && !reason?.trim()) return;
    try {
      await api.admin.reviewService(service.id, { status, reason });
      setActionMessage(`Package "${service.title}" marked ${status}.`);
      await fetchServices();
    } catch (error) {
      setActionMessage(`Error: ${error.message}`);
    }
  };

  // Handle Destination Create
  const handleSaveDestination = async (e) => {
    e.preventDefault();
    const requiredFields = [
      ['name', 'destination name'],
      ['title', 'tag/subtitle'],
      ['best_season', 'best season'],
      ['opening_hours', 'opening hours'],
      ['ticket_info', 'true entry fee or ticket information'],
      ['activities', 'activities'],
      ['description', 'description'],
      ['image', 'destination image']
    ];
    const missingField = requiredFields.find(([field]) => !String(destForm[field] || '').trim());
    if (missingField) {
      setActionMessage(`Error: ${missingField[1]} is required. Enter the verified value; do not leave it blank.`);
      return;
    }
    if (!Number.isFinite(Number(destForm.lat)) || !Number.isFinite(Number(destForm.lng)) ||
      Number(destForm.lat) < -90 || Number(destForm.lat) > 90 ||
      Number(destForm.lng) < -180 || Number(destForm.lng) > 180) {
      setActionMessage('Error: Please provide valid latitude and longitude values.');
      return;
    }
    if (!Number.isFinite(Number(destForm.avg_cost)) || Number(destForm.avg_cost) < 0) {
      setActionMessage('Error: Estimated local spend must be a valid non-negative number.');
      return;
    }
    setDestSubmitting(true);
    setActionMessage('');
    try {
      const payload = {
        name: destForm.name.trim(),
        title: destForm.title.trim(),
        district: destForm.district,
        category: destForm.category,
        lat: parseFloat(destForm.lat),
        lng: parseFloat(destForm.lng),
        avgCost: parseFloat(destForm.avg_cost),
        bestSeason: destForm.best_season.trim(),
        crowdLevel: destForm.crowd_level,
        image: destForm.image,
        description: destForm.description.trim(),
        openingHours: destForm.opening_hours.trim(),
        ticketInfo: destForm.ticket_info.trim(),
        activities: destForm.activities.split(',').map(s => s.trim()).filter(Boolean)
      };

      if (editingDestinationId) {
        await api.destinations.update(editingDestinationId, payload);
        setActionMessage(`Destination "${destForm.name}" updated and published successfully.`);
      } else {
        await api.destinations.create(payload);
        setActionMessage(`Destination "${destForm.name}" created successfully and published immediately!`);
      }
      setIsDestModalOpen(false);
      resetDestinationForm();
      await fetchDestinations();
      await fetchAnalytics();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setDestSubmitting(false);
    }
  };

  const handleCreateService = async (event) => {
    event.preventDefault();
    setServiceSubmitting(true);
    setActionMessage('');
    const roomInventory = serviceForm.category === 'homestay' && Object.values(serviceForm.hotelRoomTypes).flat().length > 0
      ? Object.values(serviceForm.hotelRoomTypes).flat()
      : serviceForm.category === 'homestay' ? serviceForm.roomTypes : [];
    try {
      await api.admin.createService({
        ...serviceForm,
        price: Number(serviceForm.price),
        durationDays: Number(serviceForm.durationDays),
        amenities: serviceForm.category === 'guide' ? serviceForm.guideTraits : serviceForm.amenities,
        availability: {
          startingLocation: serviceForm.startingLocation,
          destination: serviceForm.destination,
          meetingPoint: serviceForm.meetingPoint,
          duration: serviceForm.duration,
          availableFrom: serviceForm.availableFrom || undefined,
          availableTo: serviceForm.availableTo || undefined,
          maxGroupSize: serviceForm.maxGroupSize ? Number(serviceForm.maxGroupSize) : undefined,
          venueName: serviceForm.venueName.trim() || undefined,
          roomType: serviceForm.roomType || undefined,
          availableRooms: serviceForm.availableRooms === ''
            ? roomInventory.reduce((total, room) => total + (Number(room.availableRooms) || 0), 0) || undefined
            : Number(serviceForm.availableRooms),
          guideName: serviceForm.guideName.trim() || undefined,
          hotelName: serviceForm.hotelName.trim() || undefined,
          restaurantName: serviceForm.restaurantName.trim() || undefined
          ,roomTypes: roomInventory.filter((room) => room.type.trim()).map((room) => ({
            type: room.type.trim(),
            pricePerPerson: Number(room.pricePerPerson) || 0,
            availableRooms: Math.max(0, Number(room.availableRooms) || 0)
          }))
          ,selectedGuides: serviceForm.selectedGuides,
          selectedHotels: serviceForm.selectedHotels,
          selectedRestaurants: serviceForm.selectedRestaurants,
          manualServices: serviceForm.manualServices,
          manualDefaults: serviceForm.manualDefaults,
          intermediateStops: serviceForm.intermediateStops.filter((stop) => stop.district || stop.name)
        }
      });
      setActionMessage('Package/service added and published for planner selection.');
      setServiceForm({ title: '', description: '', category: 'homestay', price: '', district: 'Ranchi', duration: 'Full Day', durationDays: 1, startingLocation: '', destination: '', meetingPoint: '', amenities: [], guideTraits: [], availableFrom: '', availableTo: '', maxGroupSize: '', image: '', venueName: '', roomType: 'Standard', availableRooms: '', guideName: '', hotelName: '', restaurantName: '',             selectedGuides: [], selectedHotels: [], selectedRestaurants: [], intermediateStops: [{ district: '', name: '' }], roomTypes: [{ type: 'AC Double Bed', pricePerPerson: '', availableRooms: '' }], hotelRoomTypes: {}, manualServices: { hotels: [], guides: [], restaurants: [] }, manualDefaults: { hotels: true, guides: true, restaurants: true } });
    } catch (error) {
      setActionMessage(`Error: ${error.message}`);
    } finally {
      setServiceSubmitting(false);
    }
  };

  const handleDeleteDestination = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await api.destinations.delete(id);
      setActionMessage(`Destination "${name}" removed from platform.`);
      await fetchDestinations();
      await fetchAnalytics();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleToggleUser = async (uId, currentStatus) => {
    try {
      await api.admin.toggleUserStatus(uId, !currentStatus);
      setActionMessage(`User status updated to ${!currentStatus ? 'Active' : 'Suspended'}.`);
      await fetchUsers();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleResendUserOTP = async (email) => {
    try {
      const result = await api.auth.resendOTP({ email, type: 'registration' });
      setActionMessage(result.message || `Verification OTP resent to ${email}.`);
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleApproveKYC = async (provider) => {
    setActionMessage('');
    try {
      const res = await api.admin.approveKYC({
        providerId: provider.user_id,
        name: provider.business_name || provider.name,
        category: provider.provider_type || 'Tourist Guide',
        district: provider.district || 'Ranchi'
      });
      const certificateHash = res.certificate?.sha256_hash || res.certificate?.sha256Hash || res.certificate?.certificateHash;
      setActionMessage(`KYC Approved: Minted Digital Certificate with SHA-256 Hash: ${certificateHash || 'recorded on blockchain'}`);
      await fetchVerifications();
      await fetchAnalytics();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleRejectKYC = async (providerId) => {
    if (!kycRejectReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    try {
      await api.admin.rejectKYC({
        providerId,
        reason: kycRejectReason
      });
      setActionMessage(`KYC application rejected.`);
      setRejectingId(null);
      setKycRejectReason('');
      await fetchVerifications();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleRevokeKYC = async (providerId) => {
    if (!window.confirm('Revoke this provider certificate on Polygon Amoy?')) return;
    try {
      const result = await api.admin.revokeCertificate(providerId);
      setActionMessage(`Certificate revoked. Transaction: ${result.transactionHash}`);
      await fetchVerifications();
      await fetchAnalytics();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleReleaseEscrow = async (bookingId) => {
    if (!window.confirm(`Release escrow funds for booking ${bookingId} to provider?`)) return;
    try {
      const res = await api.blockchain.releaseEscrow(bookingId);
      setActionMessage(`Escrow Released! Transaction Hash: ${res.txHash}`);
      await fetchBookings();
      await fetchAnalytics();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleRefundEscrow = async (bookingId) => {
    const reason = window.prompt('Enter reason for tourist refund:');
    if (!reason) return;
    try {
      const res = await api.blockchain.refundEscrow(bookingId, reason);
      setActionMessage(`Escrow Refunded to Tourist! Tx Hash: ${res.txHash}`);
      await fetchBookings();
      await fetchAnalytics();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleBroadcastAlert = async (e) => {
    e.preventDefault();
    if (!alertTitle.trim() || !alertMessage.trim() || !alertLocation.trim()) {
      setActionMessage('Error: Alert title, location, and advisory description are required.');
      return;
    }
    setAlertSubmitting(true);
    setActionMessage('');
    try {
      await api.transport.createAlert({
        type: alertType,
        severity: alertSeverity,
        title: alertTitle.trim(),
        location: alertLocation.trim(),
        message: alertMessage.trim()
      });
      await fetchAlerts();
      setActionMessage(`Travel Advisory Published: "${alertTitle.trim()}" is now broadcast live.`);
      setAlertTitle('');
      setAlertMessage('');
      setAlertLocation('Netarhat Plateau');
      await fetchAnalytics();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setAlertSubmitting(false);
    }
  };

  const handleDeleteAlert = async (alert) => {
    if (!window.confirm(`Remove the alert "${alert.title}"? It will disappear for tourists immediately.`)) return;
    try {
      await api.transport.deleteAlert(alert.id);
      setAlertsList((current) => current.filter((item) => item.id !== alert.id));
      await fetchAlerts();
      setActionMessage(`Alert "${alert.title}" removed successfully.`);
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const kpis = data?.kpis || {
    totalTourists: 0,
    totalGuides: 0,
    totalVendors: 0,
    verifiedProviders: 0,
    totalDestinations: 0,
    totalProducts: 0,
    totalPlatformBookings: 0,
    grossMarketplaceVolume: 0,
    escrowFundsProtected: 0
  };

  const sentiment = data?.sentiment || {
    sentimentDistribution: { positivePercent: 0, neutralPercent: 0, negativePercent: 0, mixedPercent: 0 },
    aspectScores: {}
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pt-32 pb-24 px-6 md:px-16 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold uppercase tracking-widest mb-3">
              <ShieldCheck size={14} />
              Jharkhand Tourism Authority • Admin Command Center
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold">
              Statewide Tourism & Governance Analytics
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Supervising live destinations, registered users, blockchain credentials, and smart contract escrow funds.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs text-slate-400 font-mono">Real-Time Database Active</span>
          </div>
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
            actionMessage.startsWith('Error') 
              ? 'bg-red-950/40 border-red-800 text-red-300' 
              : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
          }`}>
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage('')} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
          {[
            { id: 'analytics', label: 'Overview & Analytics', icon: TrendingUp },
            { id: 'sentiment', label: 'AI Sentiment Analysis', icon: Activity },
            { id: 'reviews', label: 'Reviews & Moderation', icon: FileCheck },
            { id: 'destinations', label: `Destinations (${destList.length || kpis.totalDestinations})`, icon: MapPin },
            { id: 'services', label: 'Packages & Services', icon: Plus },
            { id: 'users', label: 'User Directory', icon: Users },
            { id: 'verifications', label: 'Provider KYC & Minting', icon: Award },
            { id: 'bookings', label: 'Bookings & Escrow Oversight', icon: DollarSign },
            { id: 'enquiries', label: `Enquiries (${enquiriesList.length})`, icon: Mail }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                  active
                    ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                    : 'bg-[#0b1326] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'sentiment' && <SentimentAnalysis embedded />}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            <div><h2 className="text-2xl font-serif font-bold text-white">Reviews & Moderation</h2><p className="text-sm text-slate-400">Automatic rule-based detection runs at submission. Review suspicious signals and verify labels before export; predictions are never treated as ground truth.</p></div>
            <div className="flex flex-wrap gap-3">
              <select value={reviewFilter.status} onChange={(event) => setReviewFilter((current) => ({ ...current, status: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                <option value="">All moderation statuses</option>
                <option value="pending_review">Pending investigation</option>
                <option value="published">Published</option>
                <option value="rejected">Rejected</option>
              </select>
              <select value={reviewFilter.risk} onChange={(event) => setReviewFilter((current) => ({ ...current, risk: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                <option value="">All risk categories</option>
                <option value="high">High risk</option>
                <option value="medium">Medium risk</option>
                <option value="low">Low risk</option>
              </select>
            </div>
            {reviewError && <div className="rounded-xl border border-rose-800/70 bg-rose-950/30 p-4 text-sm text-rose-200"><p>{reviewError}</p><button type="button" onClick={fetchReviewIntelligence} className="mt-3 rounded-lg border border-rose-700 px-3 py-2 text-xs font-semibold hover:bg-rose-900/40">Retry</button></div>}
            {reviewLoading && <p className="rounded-xl border border-slate-800 p-6 text-sm text-slate-400">Loading review intelligence...</p>}
            {!reviewLoading && !reviewError && reviewIntelligence && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['Submitted', reviewIntelligence?.stats?.totalSubmitted || 0],
                ['Published', reviewIntelligence?.stats?.published || 0],
                ['Pending review', reviewIntelligence?.stats?.pendingReview || 0],
                ['Confirmed fake', reviewIntelligence?.stats?.confirmedFake || 0],
                ['Verified sentiment', reviewIntelligence?.stats?.verifiedSentimentLabels || 0],
                ['Verified fake labels', reviewIntelligence?.stats?.verifiedFakeLabels || 0],
                ['Awaiting annotation', reviewIntelligence?.stats?.awaitingAnnotation || 0],
                ['Training eligible', reviewIntelligence?.stats?.trainingEligible || 0]
              ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span><strong className="mt-1 block text-xl text-white">{value}</strong></div>)}
            </div>}
            {!reviewLoading && !reviewError && reviewIntelligence && <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-slate-300"><strong className="text-amber-300">Publication policy:</strong> {reviewIntelligence.publicationPolicy?.automaticPublicationEnabled ? 'Low-risk reviews are published automatically.' : 'Automatic publication is disabled; new reviews await administrator approval.'} Medium- and high-risk reviews require investigation. <span className="ml-2 text-slate-500">AI predictions and risk scores are advisory; training remains manual and batch-based.</span></div>}
            {!reviewLoading && !reviewError && reviewIntelligence && (reviewList.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-slate-500">No reviews match the selected filters.</p> : <div className="space-y-3">{reviewList.map((review) => <article key={review.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-white">{review.user_name} · {review.rating}/5</p><p className="text-xs text-slate-500">{review.target_id} · {new Date(review.created_at).toLocaleString()}</p></div><div className="flex flex-wrap items-center gap-2">            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${!review.detection_analyzed_at ? 'bg-slate-500/15 text-slate-300' : review.risk_category === 'high' ? 'bg-rose-500/15 text-rose-300' : review.risk_category === 'medium' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{review.detection_analyzed_at ? `${review.risk_category || 'low'} risk` : 'unanalyzed'}</span>            <select value={review.review_status || 'published'} onChange={async (event) => { try { const response = await api.admin.moderateReview(review.id, event.target.value); setReviewList((items) => items.map((item) => item.id === review.id ? response.review : item)); await fetchReviewIntelligence(); setActionMessage('Moderation status saved.'); } catch (error) { setActionMessage(`Error: ${error.message}`); } }} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-300"><option value="pending_review">Investigate</option><option value="published">Approve / publish</option><option value="rejected">Reject</option></select>            <select value={review.verified_sentiment || ''} onChange={(event) => handleSentimentVerification(review, event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-300"><option value="">Verify sentiment</option><option value="Positive">Positive</option><option value="Neutral">Neutral</option><option value="Negative">Negative</option><option value="Mixed">Mixed</option></select>            <select value={review.verified_fake_label || ''} onChange={async (event) => { if (!event.target.value) return; try { const response = await api.admin.annotateReview(review.id, { verifiedFakeLabel: event.target.value }); setReviewList((items) => items.map((item) => item.id === review.id ? response.review : item)); await fetchReviewIntelligence(); setActionMessage('Authenticity verification saved.'); } catch (error) { setActionMessage(`Error: ${error.message}`); } }} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-300"><option value="">Verify authenticity</option><option value="genuine">Genuine</option><option value="fake">Fake</option></select><button type="button" onClick={() => handleDeleteReview(review)} className="inline-flex items-center gap-1 rounded-lg border border-rose-800/70 px-2 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/40" aria-label={`Delete review by ${review.user_name || 'tourist'}`}><Trash2 size={14} /> Delete</button></div></div><p className="mt-3 text-sm text-slate-300">{review.review_text}</p><p className="mt-2 text-xs text-slate-500">AI sentiment: {review.sentiment} · {review.emotion} · model {review.model_version || 'lexicon-v1'}</p>            {review.detection_analyzed_at ? <><p className="mt-2 text-xs text-slate-500">Detection score: {Number(review.suspicion_score || 0).toFixed(2)} · engine {review.detector_version || 'rules-v1'} · {new Date(review.detection_analyzed_at).toLocaleString()}</p><p className="mt-2 text-xs text-amber-300">{(review.suspicion_reasons || []).join('; ') || 'No suspicious signals detected'}</p></> : <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>Detection has not been run for this record.</span><button type="button" onClick={() => handleReanalyzeReview(review)} className="rounded-md border border-amber-400/30 px-2 py-1 text-amber-300 hover:bg-amber-400/10">Analyze now</button></div>}</article>)}</div>)}
          </div>
        )}

        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-6 rounded-2xl bg-[#0b1326] border border-slate-800">
                <div className="text-amber-400 text-xs uppercase tracking-widest mb-2 font-semibold">Registered Tourists</div>
                <div className="text-2xl md:text-3xl font-serif font-bold text-white">{kpis.totalTourists}</div>
                <span className="text-[10px] text-slate-500 mt-1 block">Live platform accounts</span>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1326] border border-slate-800">
                <div className="text-amber-400 text-xs uppercase tracking-widest mb-2 font-semibold">Gross Escrow Volume</div>
                <div className="text-2xl md:text-3xl font-serif font-bold text-emerald-400">
                  ₹{kpis.grossMarketplaceVolume.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Protected via Solidity contracts</span>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1326] border border-slate-800">
                <div className="text-amber-400 text-xs uppercase tracking-widest mb-2 font-semibold">Certified Providers</div>
                <div className="text-2xl md:text-3xl font-serif font-bold text-white flex items-center gap-2">
                  <Award className="text-amber-400" size={24} />
                  {kpis.verifiedProviders}
                </div>
                <span className="text-[10px] text-emerald-400 mt-1 block">Cryptographically Hashed</span>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1326] border border-slate-800">
                <div className="text-amber-400 text-xs uppercase tracking-widest mb-2 font-semibold">Destinations & Crafts</div>
                <div className="text-2xl md:text-3xl font-serif font-bold text-white">
                  {kpis.totalDestinations} / {kpis.totalProducts}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Active across 24 districts</span>
              </div>
            </div>

            {/* Sentiment & Heatmap Grid */}
            {recommendationAnalytics && (
              <section className="rounded-2xl border border-amber-400/20 bg-[#0b1326] p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-serif text-white">Recommendation Analytics</h2>
                  <p className="mt-1 text-xs text-slate-400">Database-derived ranking evidence for administrators; no tourist profile is used.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ['Catalogue destinations', recommendationAnalytics.catalogue.destinationCount],
                    ['With eligible ratings', recommendationAnalytics.catalogue.destinationsWithEligibleRatings],
                    ['Without review history', recommendationAnalytics.catalogue.destinationsWithoutReviewHistory],
                    ['With analyzed sentiment', recommendationAnalytics.catalogue.destinationsWithAnalyzedSentiment]
                  ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span><strong className="mt-1 block text-xl text-white">{value}</strong></div>)}
                </div>
                <div className="grid md:grid-cols-2 gap-5 text-xs">
                  <div>
                    <h3 className="font-semibold text-amber-300">Ranking factors</h3>
                    <p className="mt-2 text-slate-400">Weights: {Object.entries(recommendationAnalytics.ranking.weights).map(([key, value]) => `${key} ${Math.round(value * 100)}%`).join(' · ')}</p>
                    <p className="mt-2 text-slate-500">{recommendationAnalytics.ranking.factors.join(' · ')}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-rose-300">Concerning feedback</h3>
                    {recommendationAnalytics.concerningDestinations.length
                      ? recommendationAnalytics.concerningDestinations.map((destination) => <p key={destination.id} className="mt-2 text-slate-400">{destination.name}: {destination.rating.toFixed(1)}/5 from {destination.reviewCount} eligible ratings</p>)
                      : <p className="mt-2 text-slate-500">No destination meets the minimum evidence threshold for concerning feedback.</p>}
                  </div>
                </div>
                {recommendationAnalytics.insufficientEvidence.length > 0 && <p className="text-xs text-slate-500">Insufficient evidence: {recommendationAnalytics.insufficientEvidence.map((destination) => `${destination.name} (${destination.reviewCount} review)`).join(' · ')}</p>}
              </section>
            )}

            {/* Sentiment & Heatmap Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Sentiment ABSA Card */}
              <div className="lg:col-span-6 bg-[#0b1326] border border-slate-800 rounded-3xl p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">NLP Sentiment Engine</span>
                    <h2 className="text-xl font-serif font-bold mt-1">Aspect-Based Satisfaction (ABSA)</h2>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800">
                    Real Feedback Analyzed
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <Smile className="mx-auto text-emerald-400 mb-1" size={20} />
                    <span className="text-xs text-slate-400">Positive</span>
                    <div className="text-lg font-bold text-white mt-1">{sentiment.sentimentDistribution?.positivePercent ?? 100}%</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <Meh className="mx-auto text-amber-400 mb-1" size={20} />
                    <span className="text-xs text-slate-400">Neutral</span>
                    <div className="text-lg font-bold text-white mt-1">{sentiment.sentimentDistribution?.neutralPercent ?? 0}%</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <Frown className="mx-auto text-red-400 mb-1" size={20} />
                    <span className="text-xs text-slate-400">Negative</span>
                    <div className="text-lg font-bold text-white mt-1">{sentiment.sentimentDistribution?.negativePercent ?? 0}%</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <Meh className="mx-auto text-amber-300 mb-1" size={20} />
                    <span className="text-xs text-slate-400">Mixed</span>
                    <div className="text-lg font-bold text-white mt-1">{sentiment.sentimentDistribution?.mixedPercent ?? 0}%</div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold block">Aspect sentiment counts</span>
                  {Object.entries(sentiment.aspectSentimentCounts || {}).map(([aspect, counts]) => (
                    <div key={aspect} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span className="capitalize">{aspect}</span>
                        <span className="font-bold text-amber-400">Positive {counts.Positive || 0} · Neutral {counts.Neutral || 0} · Negative {counts.Negative || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Destination Heatmap */}
              <div className="lg:col-span-6 bg-[#0b1326] border border-slate-800 rounded-3xl p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">Geographical Distribution</span>
                    <h2 className="text-xl font-serif font-bold mt-1">Iconic Destination Registry</h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Real-Time Database</span>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                  {(data?.heatmap || []).length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">No destinations registered yet.</div>
                  ) : (
                    data.heatmap.map((dest, i) => (
                      <div key={dest.id || i} className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                            {i + 1}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">{dest.name}</h4>
                            <span className="text-[10px] text-slate-400">{dest.district} District</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-amber-400 block">{dest.avgRating} ★</span>
                          <span className="text-[10px] text-emerald-400">{dest.sentiment}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Advisory Broadcaster & Ledger */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Advisory Broadcaster */}
              <div className="lg:col-span-6 bg-[#0b1326] border border-slate-800 rounded-3xl p-8 space-y-6">
                <div>
                  <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">Real-Time Travel Broadcaster</span>
                  <h2 className="text-xl font-serif font-bold mt-1">Publish Tourist Advisory / Alert</h2>
                  <p className="text-xs text-slate-400 mt-1">Broadcasts push notifications across web and mobile clients in real-time.</p>
                </div>

                <form onSubmit={handleBroadcastAlert} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1">Alert Type</label>
                      <select
                        value={alertType}
                        onChange={(e) => setAlertType(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                      >
                        <option>Weather</option>
                        <option>Festival</option>
                        <option>Safety</option>
                        <option>Transport</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1">Affected Location</label>
                      <input
                        type="text"
                        required
                        value={alertLocation}
                        onChange={(e) => setAlertLocation(e.target.value)}
                        placeholder="e.g. Hundru Falls"
                        className="w-full px-4 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1">Severity</label>
                      <select
                        value={alertSeverity}
                        onChange={(e) => setAlertSeverity(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                      >
                        <option>Info</option>
                        <option>Warning</option>
                        <option>Alert</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1">Alert Title</label>
                    <input
                      type="text"
                      required
                      value={alertTitle}
                      onChange={(e) => setAlertTitle(e.target.value)}
                      placeholder="e.g. Heavy Rainfall Advisory near Falls"
                      className="w-full px-4 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1">Advisory Description</label>
                    <textarea
                      required
                      rows={2}
                      value={alertMessage}
                      onChange={(e) => setAlertMessage(e.target.value)}
                      placeholder="Details for tourists and local drivers..."
                      className="w-full px-4 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={alertSubmitting}
                    className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition"
                  >
                    {alertSubmitting ? 'Broadcasting...' : 'Broadcast Statewide Advisory'}
                  </button>
                </form>

                <div className="border-t border-slate-800 pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Published Advisories</h3>
                    <button type="button" onClick={fetchAlerts} className="text-[10px] uppercase tracking-wider text-amber-400 hover:text-amber-300">
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-2">
                    {alertsList.length === 0 ? (
                      <p className="text-xs text-slate-500">No active advisories.</p>
                    ) : alertsList.map((alert) => (
                      <div key={alert.id} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-white">{alert.title}</p>
                          <p className="mt-1 text-[10px] text-slate-400">{alert.location} · {alert.severity}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAlert(alert)}
                          className="shrink-0 rounded-lg bg-red-950/40 p-2 text-red-400 hover:bg-red-900/60"
                          title="Remove alert"
                          aria-label={`Remove ${alert.title}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Immutable Blockchain Ledger */}
              <div className="lg:col-span-6 bg-[#0b1326] border border-slate-800 rounded-3xl p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">Public Blockchain Network</span>
                    <h2 className="text-xl font-serif font-bold mt-1">Live Cryptographic Audit Trail</h2>
                  </div>
                  <Database size={20} className="text-amber-400" />
                </div>

                <div className="space-y-3 font-mono text-xs max-h-[340px] overflow-y-auto pr-2">
                  {(data?.recentLedgerTransactions || []).length === 0 ? (
                    <div className="py-12 text-center text-slate-500">
                      No blockchain transactions recorded yet. They will appear here when certificates or escrow transactions are minted.
                    </div>
                  ) : (
                    data.recentLedgerTransactions.map((tx, idx) => (
                      <div key={tx.id || idx} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                        <div className="flex justify-between text-[10px] text-amber-400 font-bold">
                          <span>TX #{tx.tx_hash ? tx.tx_hash.slice(0, 14) + '...' : `0x00${idx + 1}`}</span>
                          <span>{new Date(tx.created_at || Date.now()).toLocaleDateString()}</span>
                        </div>
                        <p className="truncate text-slate-300 text-[11px]"><strong className="text-slate-500">Type:</strong> {tx.tx_type}</p>
                        {tx.tx_hash && <div className="flex flex-wrap items-center gap-2 text-[11px]"><span className="break-all text-emerald-400">{tx.tx_hash}</span><button type="button" onClick={() => copyLedgerHash(tx.tx_hash)} title="Copy transaction hash" aria-label="Copy transaction hash" className="inline-flex items-center gap-1 rounded border border-slate-700 px-1.5 py-1 text-slate-300 hover:border-amber-400 hover:text-amber-300"><Copy size={11} /> {copiedLedgerHash === tx.tx_hash ? 'Copied' : 'Copy'}</button><a href={`https://amoy.polygonscan.com/tx/${encodeURIComponent(tx.tx_hash)}`} target="_blank" rel="noreferrer" title="Open transaction on Polygon Amoy" className="text-amber-300 hover:text-amber-200"><ExternalLink size={13} /></a></div>}
                        {tx.block_number && <a href={`https://amoy.polygonscan.com/block/${encodeURIComponent(tx.block_number)}`} target="_blank" rel="noreferrer" className="text-[11px] text-slate-400 hover:text-amber-300">Block {tx.block_number}</a>}
                        <p className="text-[11px] text-emerald-400 truncate">
                          <strong className="text-slate-500">Contract:</strong> {tx.contract_address || '0xJharkhandStateContract'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DESTINATIONS MANAGEMENT */}
        {activeTab === 'destinations' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-serif font-bold">Jharkhand Destinations Registry</h2>
                <p className="text-xs text-slate-400">
                  Add, update, or remove tourist sites. Every destination created here is instantly visible on the public Explore page.
                </p>
              </div>
              <button
                onClick={() => openDestinationEditor()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition shadow-lg shadow-amber-400/20"
              >
                <Plus size={16} />
                <span>Add Destination</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-2xl border border-slate-800 bg-[#0b1326] p-4">
              <input
                type="search"
                value={destinationFilters.search}
                onChange={(event) => setDestinationFilters({ ...destinationFilters, search: event.target.value })}
                placeholder="Search name or description"
                className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
              />
              <select
                value={destinationFilters.district}
                onChange={(event) => setDestinationFilters({ ...destinationFilters, district: event.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
              >
                <option value="All">All districts</option>
                {jharkhandDistricts.map((district) => <option key={district}>{district}</option>)}
              </select>
              <select
                value={destinationFilters.category}
                onChange={(event) => setDestinationFilters({ ...destinationFilters, category: event.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
              >
                <option value="All">All categories</option>
                {[
                  'Waterfalls', 'Waterfalls & Nature', 'Waterfalls & Adventure',
                  'Hill Station', 'Wildlife & Safari', 'Wildlife & Eco',
                  'Spiritual & Heritage', 'Spiritual & Nature', 'Heritage & History',
                  'Archaeology & Heritage', 'Eco-Tourism & Lakes', 'Lakes & Eco-Tourism',
                  'Lakes & Nature', 'Dam & Eco-Tourism', 'Bird Sanctuary & Eco-Tourism',
                  'Forest & Eco-Tourism', 'Eco-Tourism & Tribal Culture',
                  'Nature & Hills', 'Nature & Rural Tourism', 'Water Sports'
                ].map((category) => <option key={category}>{category}</option>)}
              </select>
              <select
                value={destinationFilters.status}
                onChange={(event) => setDestinationFilters({ ...destinationFilters, status: event.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
              >
                <option value="all">All statuses</option>
                <option value="active">Published only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0b1326] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#070b14] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">Destination</th>
                      <th className="p-4">District</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Entry Fee</th>
                      <th className="p-4">Coordinates</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {destList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          No destinations found in registry. Click "Add Destination" above.
                        </td>
                      </tr>
                    ) : (
                      destList.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-white text-sm">{d.name}</div>
                            <div className="text-[10px] text-amber-400">{d.tag || d.category}</div>
                          </td>
                          <td className="p-4 text-slate-300">{d.district || '—'}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                              {d.category}
                            </span>
                          </td>
                          <td className="p-4 text-emerald-400 font-semibold">
                            {d.ticket_info || 'Not provided'}
                          </td>
                          <td className="p-4 font-mono text-slate-400 text-[11px]">
                            {Number.isFinite(Number(d.lat)) ? Number(d.lat).toFixed(2) : '—'}°, {Number.isFinite(Number(d.lng)) ? Number(d.lng).toFixed(2) : '—'}°
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openDestinationEditor(d)}
                                className="px-3 py-2 rounded-lg bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition text-[10px] font-bold uppercase"
                                title="Edit Destination"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteDestination(d.id, d.name)}
                                className="p-2 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900/60 transition"
                                title="Delete Destination"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-[#0b1326] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-serif font-bold">Tour Package Review Queue</h2>
                  <p className="mt-1 text-xs text-slate-400">Review packages submitted by vendors and guides before tourists can discover them.</p>
                </div>
                <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">{servicesList.filter((service) => service.approval_status === 'pending').length} pending</span>
              </div>
              <div className="mt-5 space-y-3">
                {servicesList.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">No tour packages have been submitted.</p>
                ) : servicesList.map((service) => (
                  <div key={service.id} className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      {service.image && <img src={service.image} alt="" className="h-16 w-24 rounded-xl object-cover" />}
                      <div>
                        <h3 className="font-semibold text-white">{service.title}</h3>
                        <p className="text-xs text-slate-400">{service.provider_name || 'Provider'} · {service.district} · ₹{Number(service.price || 0).toLocaleString('en-IN')}</p>
                        {Array.isArray(service.availability?.roomTypes) && service.availability.roomTypes.length > 0 && (
                          <p className="mt-1 text-[10px] text-slate-400">Rooms: {service.availability.roomTypes.map((room) => `${room.type} (${room.availableRooms})`).join(', ')}</p>
                        )}
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-amber-400">{service.approval_status} {service.review_reason ? `· ${service.review_reason}` : ''}</p>
                      </div>
                    </div>
                    {service.approval_status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleReviewService(service, 'approved')} className="rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-950">Approve</button>
                        <button onClick={() => handleReviewService(service, 'changes_requested')} className="rounded-lg border border-violet-500/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-violet-300">Request changes</button>
                        <button onClick={() => handleReviewService(service, 'rejected')} className="rounded-lg border border-red-500/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-300">Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-serif font-bold text-white">Packages & tourism services</h2>
              <p className="mt-1 text-sm text-slate-400">Create official packages, guide services, and accommodation options used by the AI planner.</p>
            </div>
            <form onSubmit={handleCreateService} className="grid gap-4 rounded-2xl border border-slate-800 bg-[#0b1326] p-6 md:grid-cols-2">
              <input required placeholder="Package title" value={serviceForm.title} onChange={(event) => setServiceForm({ ...serviceForm, title: event.target.value })} className="input" />
              <select value={serviceForm.category} onChange={(event) => setServiceForm({ ...serviceForm, category: event.target.value })} className="input">
                <option value="guide">Guide service</option>
                <option value="homestay">Hotel / homestay</option>
                <option value="restaurant">Restaurant</option>
              </select>
              {(serviceForm.category === 'homestay' || serviceForm.category === 'restaurant') && (
                <input required placeholder={serviceForm.category === 'homestay' ? 'Hotel / homestay name' : 'Restaurant name'} value={serviceForm.venueName} onChange={(event) => setServiceForm({ ...serviceForm, venueName: event.target.value })} className="input" />
              )}
              {serviceForm.category === 'package' && (
                <div className="grid gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 md:col-span-2 md:grid-cols-3">
                  <select multiple size={3} value={serviceForm.manualDefaults.guides ? [''] : serviceForm.selectedGuides} onChange={(event) => { const values = Array.from(event.target.selectedOptions, (option) => option.value); const isDefault = values.includes(''); setServiceForm({ ...serviceForm, selectedGuides: isDefault ? [] : values, manualDefaults: { ...serviceForm.manualDefaults, guides: isDefault } }); }} className="input h-20 text-xs"><option value="">Default - no guide selected</option>{servicesList.filter((service) => service.category === 'guide' && [serviceForm.startingLocation, serviceForm.destination, ...serviceForm.intermediateStops.map((stop) => stop.district)].filter(Boolean).includes(service.district)).map((service) => <option key={service.id} value={service.title}>{service.title} ({service.district})</option>)}</select>
                  <select multiple size={3} value={serviceForm.manualDefaults.hotels ? [''] : serviceForm.selectedHotels} onChange={(event) => { const values = Array.from(event.target.selectedOptions, (option) => option.value); const isDefault = values.includes(''); const selectedValues = isDefault ? [] : values; setServiceForm({ ...serviceForm, selectedHotels: selectedValues, manualDefaults: { ...serviceForm.manualDefaults, hotels: isDefault }, hotelRoomTypes: Object.fromEntries(selectedValues.map((hotelId) => [hotelId, serviceForm.hotelRoomTypes[hotelId] || [{ type: 'AC Double Bed', pricePerPerson: '', availableRooms: '' }]])) }); }} className="input h-20 text-xs"><option value="">Default - no homestay selected</option>{servicesList.filter((service) => service.category === 'homestay' && [serviceForm.startingLocation, serviceForm.destination, ...serviceForm.intermediateStops.map((stop) => stop.district)].filter(Boolean).includes(service.district)).map((service) => <option key={service.id} value={service.title}>{service.title} ({service.district})</option>)}</select>
                  <select multiple size={3} value={serviceForm.manualDefaults.restaurants ? [''] : serviceForm.selectedRestaurants} onChange={(event) => { const values = Array.from(event.target.selectedOptions, (option) => option.value); const isDefault = values.includes(''); setServiceForm({ ...serviceForm, selectedRestaurants: isDefault ? [] : values, manualDefaults: { ...serviceForm.manualDefaults, restaurants: isDefault } }); }} className="input h-20 text-xs"><option value="">Default - no restaurant selected</option>{servicesList.filter((service) => service.category === 'restaurant' && [serviceForm.startingLocation, serviceForm.destination, ...serviceForm.intermediateStops.map((stop) => stop.district)].filter(Boolean).includes(service.district)).map((service) => <option key={service.id} value={service.title}>{service.title} ({service.district})</option>)}</select>
                  <div className="space-y-2 border-t border-slate-800 pt-3 md:col-span-3"><p className="text-[10px] text-slate-400">Choose existing listings OR use the default/manual option for each category. They cannot be used together.</p>{['hotels', 'guides', 'restaurants'].filter((type) => serviceForm.manualDefaults[type]).map((type) =>                   <div key={type} className="rounded-lg border border-slate-800 p-2"><div className="mb-2 flex items-center justify-between"><span className="text-xs capitalize text-slate-300">Manual {type === 'hotels' ? 'hotel / homestay' : type.slice(0, -1)}</span><button type="button" onClick={() => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: [...serviceForm.manualServices[type], { name: '', district: serviceForm.district, address: '', contact: '', details: '', price: '', duration: 'Full Day', maxGroupSize: '', availableFrom: '', availableTo: '', image: '', amenities: [], traits: [], roomTypes: type === 'hotels' ? [{ type: '', pricePerPerson: '', availableRooms: '' }] : [] }] } })} className="rounded border border-amber-400/40 px-2 py-1 text-[10px] text-amber-300">Add manual</button></div>{serviceForm.manualServices[type].map((item, index) => <div key={`${type}-${index}`} className="grid gap-2 md:grid-cols-2">                  <input required value={item.name} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry) } })} placeholder={type === 'hotels' ? 'Hotel / homestay name *' : type === 'guides' ? 'Guide name *' : 'Restaurant name *'} className="input" /><select required value={item.district} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, district: event.target.value } : entry) } })} className="input"><option value="">Select district *</option>{jharkhandDistricts.map((district) => <option key={district}>{district}</option>)}</select><input required value={item.address || ''} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, address: event.target.value } : entry) } })} placeholder="Address *" className="input" /><input required value={item.contact || ''} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, contact: event.target.value } : entry) } })} placeholder="Contact *" className="input" /><input required type="number" min="0" value={item.price} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, price: event.target.value } : entry) } })} placeholder="Price / rate *" className="input" />{type === 'guides' && <><input required value={item.languages || ''} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, guides: serviceForm.manualServices.guides.map((entry, i) => i === index ? { ...entry, languages: event.target.value } : entry) } })} placeholder="Languages *" className="input" /><input value={item.experience || ''} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, guides: serviceForm.manualServices.guides.map((entry, i) => i === index ? { ...entry, experience: event.target.value } : entry) } })} placeholder="Experience / expertise" className="input" /></>}{type === 'restaurants' && <><input required value={item.cuisine || ''} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, restaurants: serviceForm.manualServices.restaurants.map((entry, i) => i === index ? { ...entry, cuisine: event.target.value } : entry) } })} placeholder="Cuisine *" className="input" /><input type="time" value={item.openingTime || ''} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, restaurants: serviceForm.manualServices.restaurants.map((entry, i) => i === index ? { ...entry, openingTime: event.target.value } : entry) } })} className="input" /><input type="time" value={item.closingTime || ''} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, restaurants: serviceForm.manualServices.restaurants.map((entry, i) => i === index ? { ...entry, closingTime: event.target.value } : entry) } })} className="input" /></>}                                                                        <textarea required value={item.details} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, details: event.target.value } : entry) } })} placeholder="Description and facilities *" className="input md:col-span-2" />                  {renderManualOptions(type, item, index)}<select value={item.duration || 'Full Day'} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, duration: event.target.value } : entry) } })} className="input"><option>Full Day</option><option>Half Day</option><option>Multi-day</option></select><input type="number" min="1" value={item.maxGroupSize || ''} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, maxGroupSize: event.target.value } : entry) } })} placeholder="Maximum group size" className="input" /><label className="text-xs text-slate-400">Available from<input type="date" value={item.availableFrom || ''} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, availableFrom: event.target.value } : entry) } })} className="input mt-1" /></label><label className="text-xs text-slate-400">Available to<input type="date" min={item.availableFrom || undefined} value={item.availableTo || ''} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, availableTo: event.target.value } : entry) } })} className="input mt-1" /></label><label className="md:col-span-2 text-xs text-slate-400">Photo<input type="file" accept="image/*" onChange={(event) => handleServiceImage(event, type, index)} className="mt-1 w-full text-xs" /></label>{type === 'hotels' && <div className="md:col-span-2 rounded border border-amber-400/20 p-2"><div className="mb-2 flex justify-between text-xs text-amber-300"><span>Room types</span><button type="button" onClick={() => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, hotels: serviceForm.manualServices.hotels.map((entry, i) => i === index ? { ...entry, roomTypes: [...(entry.roomTypes || []), { type: '', pricePerPerson: '', availableRooms: '' }] } : entry) } })}>Add room type</button></div>{(item.roomTypes || []).map((room, roomIndex) => <div key={roomIndex} className="grid grid-cols-3 gap-2"><input required value={room.type} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, hotels: serviceForm.manualServices.hotels.map((entry, i) => i === index ? { ...entry, roomTypes: entry.roomTypes.map((r, ri) => ri === roomIndex ? { ...r, type: event.target.value } : r) } : entry) } })} placeholder="Room type" className="input" /><input required type="number" value={room.pricePerPerson} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, hotels: serviceForm.manualServices.hotels.map((entry, i) => i === index ? { ...entry, roomTypes: entry.roomTypes.map((r, ri) => ri === roomIndex ? { ...r, pricePerPerson: event.target.value } : r) } : entry) } })} placeholder="Price / person" className="input" /><input required type="number" value={room.availableRooms} onChange={(event) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, hotels: serviceForm.manualServices.hotels.map((entry, i) => i === index ? { ...entry, roomTypes: entry.roomTypes.map((r, ri) => ri === roomIndex ? { ...r, availableRooms: event.target.value } : r) } : entry) } })} placeholder="Rooms available" className="input" /></div>)}</div>}</div>)}</div>)}</div>
                  <div className="md:col-span-3">
                    <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Intermediate stops</span><button type="button" onClick={() => setServiceForm({ ...serviceForm, intermediateStops: [...serviceForm.intermediateStops, { district: '', name: '' }] })} className="rounded-lg border border-amber-400/40 px-3 py-1 text-[10px] font-bold uppercase text-amber-300">Add stop</button></div>
                    {serviceForm.intermediateStops.map((stop, index) => <div key={`admin-stop-${index}`} className="mb-2 grid grid-cols-[1fr_auto] gap-2"><select value={stop.district} onChange={(event) => setServiceForm({ ...serviceForm, intermediateStops: serviceForm.intermediateStops.map((item, i) => i === index ? { ...item, district: event.target.value, name: event.target.value } : item) })} className="input"><option value="">Select stop district</option>{jharkhandDistricts.map((district) => <option key={district}>{district}</option>)}</select>{serviceForm.intermediateStops.length > 1 && <button type="button" onClick={() => setServiceForm({ ...serviceForm, intermediateStops: serviceForm.intermediateStops.filter((_, i) => i !== index) })} className="px-2 text-red-300">×</button>}</div>)}
                  </div>
                </div>
              )}
              {serviceForm.category === 'homestay' && (
                <div className="grid gap-4 rounded-xl border border-slate-700 p-4 md:col-span-2">
                  <div><span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Room inventory by hotel / homestay</span>{serviceForm.category === 'package' && <p className="mt-1 text-[10px] text-slate-400">Enter separate room types, prices, and available counts for each selected hotel.</p>}</div>
                  {(serviceForm.category === 'homestay' ? ['self'] : serviceForm.selectedHotels).map((hotelId) => {
                    const rooms = serviceForm.hotelRoomTypes[hotelId] || serviceForm.roomTypes;
                    return <div key={hotelId} className="space-y-2 rounded-lg border border-slate-800 p-3"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-amber-300">{hotelId === 'self' ? serviceForm.venueName || 'This homestay' : hotelId}</span><button type="button" onClick={() => setServiceForm({ ...serviceForm, hotelRoomTypes: { ...serviceForm.hotelRoomTypes, [hotelId]: [...rooms, { type: '', pricePerPerson: '', availableRooms: '' }] } })} className="rounded-lg border border-amber-400/40 px-3 py-1 text-[10px] font-bold uppercase text-amber-300">Add room type</button></div>{rooms.map((room, index) => <div key={`${hotelId}-room-${index}`} className="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-2"><input required value={room.type} onChange={(event) => setServiceForm({ ...serviceForm, hotelRoomTypes: { ...serviceForm.hotelRoomTypes, [hotelId]: rooms.map((item, i) => i === index ? { ...item, type: event.target.value } : item) } })} placeholder="AC / Non-AC / Double Bed" className="input" /><input required type="number" min="0" value={room.pricePerPerson} onChange={(event) => setServiceForm({ ...serviceForm, hotelRoomTypes: { ...serviceForm.hotelRoomTypes, [hotelId]: rooms.map((item, i) => i === index ? { ...item, pricePerPerson: event.target.value } : item) } })} placeholder="₹ / person" className="input" /><input required type="number" min="0" value={room.availableRooms} onChange={(event) => setServiceForm({ ...serviceForm, hotelRoomTypes: { ...serviceForm.hotelRoomTypes, [hotelId]: rooms.map((item, i) => i === index ? { ...item, availableRooms: event.target.value } : item) } })} placeholder="Rooms available" className="input" />{rooms.length > 1 && <button type="button" onClick={() => setServiceForm({ ...serviceForm, hotelRoomTypes: { ...serviceForm.hotelRoomTypes, [hotelId]: rooms.filter((_, i) => i !== index) } })} className="px-2 text-red-300">×</button>}</div>)}</div>;
                  })}
                </div>
              )}
              <select required value={serviceForm.startingLocation} onChange={(event) => setServiceForm({ ...serviceForm, startingLocation: event.target.value })} className="input">
                <option value="">Select starting district</option>
                {jharkhandDistricts.map((district) => <option key={`start-${district}`}>{district}</option>)}
              </select>
              <select required value={serviceForm.destination} onChange={(event) => setServiceForm({ ...serviceForm, destination: event.target.value })} className="input">
                <option value="">Select destination district</option>
                {jharkhandDistricts.map((district) => <option key={`final-${district}`}>{district}</option>)}
              </select>
              <textarea required placeholder="Full itinerary / description, inclusions, exclusions and important instructions" value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} className="input md:col-span-2" rows={4} />
              <input required type="number" min="0" placeholder="Price / daily rate (INR)" value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} className="input" />
              <select required value={serviceForm.district} onChange={(event) => setServiceForm({ ...serviceForm, district: event.target.value })} className="input">
                <option value="All districts">All districts</option>
                {jharkhandDistricts.map((district) => <option key={district}>{district}</option>)}
              </select>
              <select required value={serviceForm.duration} onChange={(event) => setServiceForm({ ...serviceForm, duration: event.target.value, durationDays: event.target.value === 'Full Day' || event.target.value === 'Half Day' ? 1 : Number.parseInt(event.target.value, 10) || 1 })} className="input">
                <option>Full Day</option>
                <option>Half Day</option>
                <option value="2 Days / 1 Night">2 Days / 1 Night</option>
                <option value="3 Days / 2 Nights">3 Days / 2 Nights</option>
              </select>
              <input required type="number" min="1" placeholder="Maximum group size" value={serviceForm.maxGroupSize} onChange={(event) => setServiceForm({ ...serviceForm, maxGroupSize: event.target.value })} className="input" />
              <label className="text-xs text-slate-400">{serviceForm.category === 'guide' ? 'Guide image' : 'Package cover image'}<input type="file" accept="image/*" onChange={handleServiceImage} className="input mt-1 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:font-semibold file:text-slate-950" /></label>
              {serviceForm.image && <img src={serviceForm.image} alt={serviceForm.category === 'guide' ? 'Guide preview' : 'Package preview'} className="h-24 w-full rounded-xl object-cover" />}
              {serviceForm.category !== 'package' && <fieldset className="rounded-xl border border-slate-700 p-4 md:col-span-2">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{serviceForm.category === 'guide' ? 'Guide traits' : 'Amenities'}</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                  {(serviceForm.category === 'guide' ? ['Friendly', 'Local expert', 'Storyteller', 'Nature specialist', 'Wildlife expert', 'Family friendly', 'Punctual', 'Multilingual'] : serviceForm.category === 'restaurant' ? restaurantAmenityOptions : serviceAmenityOptions).map((item) => {
                    const selected = (serviceForm.category === 'guide' ? serviceForm.guideTraits : serviceForm.amenities).includes(item);
                    return (
                      <label key={item} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${selected ? 'border-amber-400 bg-amber-400/10 text-amber-300' : 'border-slate-800 text-slate-400 hover:border-slate-600'}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => setServiceForm((current) => {
                            const field = current.category === 'guide' ? 'guideTraits' : 'amenities';
                            return { ...current, [field]: selected ? current[field].filter((value) => value !== item) : [...current[field], item] };
                          })}
                          className="accent-amber-400"
                        />
                        {item}
                      </label>
                    );
                  })}
                </div>
              </fieldset>}
              <label className="text-xs text-slate-400">Available from<input type="date" value={serviceForm.availableFrom} onChange={(event) => setServiceForm({ ...serviceForm, availableFrom: event.target.value })} className="input mt-1" /></label>
              <label className="text-xs text-slate-400">Available to<input type="date" value={serviceForm.availableTo} onChange={(event) => setServiceForm({ ...serviceForm, availableTo: event.target.value })} className="input mt-1" /></label>
              <input type="number" min="1" placeholder="Maximum group size" value={serviceForm.maxGroupSize} onChange={(event) => setServiceForm({ ...serviceForm, maxGroupSize: event.target.value })} className="input md:col-span-2" />
              <button disabled={serviceSubmitting} type="submit" className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50 md:col-span-2">
                {serviceSubmitting ? 'Adding...' : 'Add package/service to planner'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: USER MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-serif font-bold">Registered Users Directory</h2>
                <p className="text-xs text-slate-400">
                  Monitor accounts, view verification states, and toggle active status.
                </p>
              </div>

              <div className="flex gap-2">
                {['', 'tourist', 'guide', 'vendor', 'admin'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setUserRoleFilter(role)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                      userRoleFilter === role
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {role || 'All Roles'}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0b1326] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#070b14] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">User</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Email Status</th>
                      <th className="p-4">Account State</th>
                      <th className="p-4">Joined Date</th>
                      <th className="p-4 text-right">Toggle Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {userList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          No users found matching this role.
                        </td>
                      </tr>
                    ) : (
                      userList.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-white text-sm">{u.name}</div>
                            <div className="text-[11px] text-slate-400">{u.email}</div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              u.role === 'admin'
                                ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                                : u.role === 'guide'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : u.role === 'vendor'
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-4">
                            {u.is_email_verified ? (
                              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                                <CheckCircle2 size={13} /> Verified
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-amber-400 font-semibold">Pending OTP</span>
                                <button
                                  onClick={() => handleResendUserOTP(u.email)}
                                  className="rounded-md border border-amber-400/30 px-2 py-1 text-[10px] font-semibold text-amber-300 hover:bg-amber-400/10"
                                >
                                  Resend OTP
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.is_active ? 'text-emerald-400 bg-emerald-950/40' : 'text-red-400 bg-red-950/40'
                            }`}>
                              {u.is_active ? 'ACTIVE' : 'SUSPENDED'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 text-[11px]">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleToggleUser(u.id, u.is_active)}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                                u.is_active
                                  ? 'bg-red-950/40 text-red-400 hover:bg-red-900/60'
                                  : 'bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60'
                              }`}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROVIDER KYC & BLOCKCHAIN MINTING */}
        {activeTab === 'verifications' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-serif font-bold">Provider Verification & Digital Identity Minting</h2>
              <p className="text-xs text-slate-400 mt-1">
                Review official business credentials, government badges, and mint tamper-proof SHA-256 certificates on the blockchain.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pending / Registered Providers */}
              <div className="bg-[#0b1326] border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileCheck className="text-amber-400" size={18} />
                    Registered Service Providers
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {verificationsData?.providers?.length || 0} Total
                  </span>
                </div>

                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
                  {(verificationsData?.providers || []).length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      No service providers registered in database yet.
                    </div>
                  ) : (
                    verificationsData.providers.map((p) => (
                      <div key={p.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-white text-sm">{p.business_name || p.name || 'Artisan / Guide'}</h4>
                            <p className="text-xs text-slate-400">{p.provider_type} • {p.district} District</p>
                            <p className="text-[10px] text-amber-400 font-mono mt-0.5">License: {p.license_number || 'N/A'}</p>
                            <div className="mt-2 space-y-1 border-t border-slate-800 pt-2 font-mono text-[10px]">
                              <p className="text-slate-400">Provider ID: <span className="text-cyan-300">{p.user_id}</span> <button type="button" onClick={() => copyProviderValue(p.user_id)} title="Copy provider ID" className="ml-1 text-slate-500 hover:text-white">{copiedProviderValue === p.user_id ? 'Copied' : 'Copy'}</button></p>
                              <p className="text-slate-400">Certificate ID: <span className="text-amber-300">{p.certificate_id || '--'}</span> {p.certificate_id && <button type="button" onClick={() => copyProviderValue(p.certificate_id)} title="Copy certificate ID" className="ml-1 text-slate-500 hover:text-white">{copiedProviderValue === p.certificate_id ? 'Copied' : 'Copy'}</button>}</p>
                              <p className="text-slate-400">Transaction: <span className="break-all text-emerald-300">{p.blockchain_tx_hash || '--'}</span> {p.blockchain_tx_hash && <button type="button" onClick={() => copyProviderValue(p.blockchain_tx_hash)} title="Copy transaction hash" className="ml-1 text-slate-500 hover:text-white">{copiedProviderValue === p.blockchain_tx_hash ? 'Copied' : 'Copy'}</button>}</p>
                            </div>
                            <button type="button" onClick={() => setSelectedProviderDetails(p)} className="mt-3 w-full rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-400/20">Review submitted details &amp; documents</button>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            p.verification_status === 'verified'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                              : p.verification_status === 'rejected'
                              ? 'bg-red-950/60 text-red-400 border border-red-800'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-800'
                          }`}>
                            {p.verification_status || 'Pending'}
                          </span>
                        </div>

                        {p.verification_status !== 'approved' && p.verification_status !== 'revoked' && (
                          <div className="pt-2 border-t border-slate-800 flex gap-2">
                            <button
                              onClick={() => handleApproveKYC(p)}
                              className="flex-1 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition"
                            >
                              Approve & Mint
                            </button>
                            <button
                              onClick={() => setRejectingId(p.user_id)}
                              className="px-3 py-1.5 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900/60 font-bold text-xs uppercase tracking-wider transition"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {p.verification_status === 'approved' && (
                          <button onClick={() => handleRevokeKYC(p.user_id)} className="w-full rounded-lg border border-red-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-950/40">
                            Revoke Certificate
                          </button>
                        )}

                        {rejectingId === p.user_id && (
                          <div className="pt-2 space-y-2">
                            <input
                              type="text"
                              placeholder="Enter rejection reason..."
                              value={kycRejectReason}
                              onChange={(e) => setKycRejectReason(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg bg-[#070b14] border border-slate-700 text-xs text-slate-100"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRejectKYC(p.user_id)}
                                className="px-3 py-1 rounded bg-red-600 text-white text-xs font-bold"
                              >
                                Confirm Rejection
                              </button>
                              <button
                                onClick={() => setRejectingId(null)}
                                className="px-3 py-1 rounded bg-slate-800 text-slate-300 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Minted Blockchain Certificates */}
              <div className="bg-[#0b1326] border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="text-amber-400" size={18} />
                    Active Blockchain Certificates
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {verificationsData?.certificates?.length || 0} Minted
                  </span>
                </div>

                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
                  {(verificationsData?.certificates || []).length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      No certificates minted yet. Approve a provider to anchor a new blockchain block.
                    </div>
                  ) : (
                    verificationsData.certificates.map((cert) => (
                      <div key={cert.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-400 font-bold">{cert.title || 'Official Tourism Certificate'}</span>
                          <span className="text-[10px] text-emerald-400">STATUS: VALID</span>
                        </div>
                        <div className="text-slate-300 text-xs font-sans">
                          Issued to: <strong className="text-white">{cert.provider_id}</strong>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          SHA-256: <span className="text-emerald-400">{cert.sha256_hash}</span>
                        </p>
                        <p className="text-[10px] text-slate-400">Certificate ID: <span className="text-amber-300">{cert.certificate_id || '--'}</span></p>
                        <p className="text-[10px] text-cyan-300">Provider ID: {cert.provider_id || '--'}</p>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="break-all text-emerald-300">Transaction: {cert.blockchain_tx_hash || '--'}</span>
                          {cert.blockchain_tx_hash && <button type="button" onClick={() => copyProviderValue(cert.blockchain_tx_hash)} title="Copy transaction hash" className="shrink-0 text-slate-400 hover:text-white">{copiedProviderValue === cert.blockchain_tx_hash ? 'Copied' : 'Copy'}</button>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: BOOKINGS & ESCROW */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-serif font-bold">Bookings & Smart Contract Escrow Oversight</h2>
              <p className="text-xs text-slate-400 mt-1">
                Every booking deposits payments into an escrow smart contract. Funds are released upon verified fulfillment.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0b1326] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#070b14] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">Booking ID</th>
                      <th className="p-4">Item / Experience</th>
                      <th className="p-4">Tourist ID</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Escrow Status</th>
                      <th className="p-4">Contract Hash</th>
                      <th className="p-4 text-right">Escrow Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {bookingsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-500">
                          No bookings made on the platform yet. When tourists purchase crafts or book guides, they appear here.
                        </td>
                      </tr>
                    ) : (
                      bookingsList.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-4 font-mono font-bold text-amber-400">{b.id}</td>
                          <td className="p-4 font-semibold text-white max-w-[200px] truncate">{b.title}</td>
                          <td className="p-4 text-slate-400 font-mono text-[11px]">{b.tourist_id}</td>
                          <td className="p-4 font-bold text-emerald-400">₹{b.total_amount?.toLocaleString('en-IN')}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              b.escrow_status === 'released'
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                                : b.escrow_status === 'refunded'
                                ? 'bg-red-950/60 text-red-400 border border-red-800'
                                : 'bg-amber-950/60 text-amber-400 border border-amber-800 flex items-center gap-1 w-fit'
                            }`}>
                              {b.escrow_status === 'locked' && <Lock size={10} />}
                              {b.escrow_status || 'locked'}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-[10px] text-slate-500 max-w-[150px] truncate">
                            {b.contract_tx_hash || '0xSimulatedContract'}
                          </td>
                          <td className="p-4 text-right">
                            {b.escrow_status === 'locked' ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleReleaseEscrow(b.id)}
                                  className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] uppercase"
                                  title="Release funds to vendor"
                                >
                                  Release
                                </button>
                                <button
                                  onClick={() => handleRefundEscrow(b.id)}
                                  className="px-2.5 py-1 rounded bg-red-950/40 text-red-400 hover:bg-red-900/60 font-bold text-[10px] uppercase"
                                  title="Refund tourist"
                                >
                                  Refund
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 uppercase font-mono">Settled</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'enquiries' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-serif font-bold">Tourism Enquiries</h2>
              <p className="text-xs text-slate-400 mt-1">Messages submitted through the public contact forms.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#0b1326] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#070b14] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">Received</th>
                      <th className="p-4">Visitor</th>
                      <th className="p-4">Message</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {enquiriesList.length === 0 ? (
                      <tr><td colSpan={4} className="p-12 text-center text-slate-500">No enquiries received yet.</td></tr>
                    ) : enquiriesList.map((enquiry) => (
                      <tr key={enquiry.id} className="hover:bg-slate-900/40 transition-colors align-top">
                        <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(enquiry.created_at).toLocaleString()}</td>
                        <td className="p-4">
                          <div className="font-semibold text-white">{enquiry.name}</div>
                          <a href={`mailto:${enquiry.email}`} className="text-amber-400 hover:text-amber-300">{enquiry.email}</a>
                        </td>
                        <td className="p-4 text-slate-300 whitespace-pre-wrap min-w-[280px]">{enquiry.message}</td>
                        <td className="p-4"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-950/60 text-amber-400 border border-amber-800">{enquiry.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD DESTINATION */}
        {isDestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0b1326] border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6 text-slate-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-serif font-bold text-white">{editingDestinationId ? 'Edit Destination' : 'Add Destination'} {editingDestinationId ? 'in Registry' : 'to Registry'}</h3>
                  <p className="text-xs text-slate-400">{editingDestinationId ? 'Update the published destination details.' : 'Creates a permanent destination record in the database.'}</p>
                </div>
                <button onClick={() => setIsDestModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveDestination} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Destination Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dassam Falls"
                      value={destForm.name}
                      onChange={(e) => setDestForm({ ...destForm, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Tag / Subtitle *</label>
                    <input
                      type="text"
                      placeholder="e.g. Cascading Wonder of Ranchi"
                      required
                      value={destForm.title}
                      onChange={(e) => setDestForm({ ...destForm, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Destination Image *</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleDestinationImage}
                    className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-400 file:px-3 file:py-1 file:font-semibold file:text-slate-950"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">Upload JPG, PNG, WEBP, or another image up to 5 MB. The same image is published publicly.</p>
                  {destForm.image && (
                    <img src={destForm.image} alt="Destination preview" className="mt-3 h-32 w-full rounded-xl object-cover border border-slate-700" />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">District</label>
                    <select
                      value={destForm.district}
                      onChange={(e) => setDestForm({ ...destForm, district: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      {jharkhandDistricts.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Category</label>
                    <select
                      value={destForm.category}
                      onChange={(e) => setDestForm({ ...destForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      {['Waterfalls', 'Hill Station', 'Wildlife & Eco', 'Spiritual Heritage', 'Archaeology & Heritage', 'Water Sports'].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Best Season *</label>
                    <input type="text" required value={destForm.best_season} onChange={(e) => setDestForm({ ...destForm, best_season: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400" />
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Opening Hours *</label>
                    <input type="text" required value={destForm.opening_hours} onChange={(e) => setDestForm({ ...destForm, opening_hours: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400" />
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Crowd Level</label>
                    <select value={destForm.crowd_level} onChange={(e) => setDestForm({ ...destForm, crowd_level: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400">
                      {['Low', 'Moderate', 'High'].map((level) => <option key={level}>{level}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Verified Entry Fee / Ticket Information *</label>
                  <input type="text" required value={destForm.ticket_info} onChange={(e) => setDestForm({ ...destForm, ticket_info: e.target.value })} placeholder="Example: ₹30 per adult; children ₹15; boating extra" className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={destForm.lat}
                      onChange={(e) => setDestForm({ ...destForm, lat: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={destForm.lng}
                      onChange={(e) => setDestForm({ ...destForm, lng: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Estimated Local Spend (₹) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={destForm.avg_cost}
                      onChange={(e) => setDestForm({ ...destForm, avg_cost: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Activities (comma-separated) *</label>
                  <input
                    type="text"
                    value={destForm.activities}
                    onChange={(e) => setDestForm({ ...destForm, activities: e.target.value })}
                    required
                    placeholder="Photography, Trekking, Camping"
                    className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Description *</label>
                  <textarea
                    required
                    rows={3}
                    value={destForm.description}
                    onChange={(e) => setDestForm({ ...destForm, description: e.target.value })}
                    placeholder="Detailed history, landscape highlights, and tourist guidance..."
                    className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={destSubmitting}
                    className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl uppercase tracking-wider transition"
                  >
                    {destSubmitting ? 'Saving...' : editingDestinationId ? 'Update & Publish Destination' : 'Save & Publish Destination'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDestModalOpen(false)}
                    className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl uppercase font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedProviderDetails && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedProviderDetails(null)}>
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-700 bg-[#0b1326] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-widest text-amber-400">KYC review</p><h2 className="mt-2 text-2xl font-serif font-bold text-white">{selectedProviderDetails.name || selectedProviderDetails.business_name}</h2></div>
                <button type="button" onClick={() => setSelectedProviderDetails(null)} className="rounded-lg border border-slate-700 px-3 py-1 text-slate-300 hover:text-white">Close</button>
              </div>
              <div className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                {[
                  ['Provider ID', selectedProviderDetails.user_id], ['Email', selectedProviderDetails.email], ['Mobile', selectedProviderDetails.phone],
                  ['Business', selectedProviderDetails.business_name], ['Provider type', selectedProviderDetails.provider_type], ['District', selectedProviderDetails.district],
                  ['Address', selectedProviderDetails.address], ['State', selectedProviderDetails.state], ['Service area', selectedProviderDetails.service_area],
                  ['Specialization', selectedProviderDetails.specialization], ['Languages', Array.isArray(selectedProviderDetails.languages) ? selectedProviderDetails.languages.join(', ') : selectedProviderDetails.languages],
                  ['License number', selectedProviderDetails.license_number]
                ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span><span className="mt-1 block break-words text-white">{value || '--'}</span></div>)}
              </div>
              <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Government ID submitted</p>
                {(selectedProviderDetails.verification_request?.documents || []).filter((document) => /government|aadhar|aadhaar|identity|id/i.test(document.type || '')).map((document, index) => <div key={`${document.fileName}-${index}`} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-950/60 p-3 text-sm"><span className="text-white">{document.fileName || 'Government ID'} <span className="text-xs text-slate-500">({document.type || 'Government ID'})</span></span>{document.dataUrl ? <a href={document.dataUrl} download={document.fileName || 'government-id'} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300">Download document</a> : <span className="text-xs text-red-300">Re-upload required: file data is not stored</span>}</div>)}
                {!(selectedProviderDetails.verification_request?.documents || []).some((document) => /government|aadhar|aadhaar|identity|id/i.test(document.type || '')) && <p className="mt-2 text-sm text-red-300">No Government ID document was submitted.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
