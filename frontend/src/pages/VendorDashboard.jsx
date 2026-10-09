import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  ShieldCheck,
  Award,
  CheckCircle2,
  AlertCircle,
  Plus,
  Star,
  Wallet,
  ShoppingBag,
  Compass,
  FileCheck,
  Copy,
  ExternalLink,
  Trash2,
  Lock,
  X
} from 'lucide-react';

const jharkhandDistricts = ['Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahibganj', 'Seraikela-Kharsawan', 'Simdega', 'West Singhbhum'];
const manualRestaurantAmenities = ['Local cuisine', 'Vegetarian options', 'Non-vegetarian options', 'Jain food', 'Tribal cuisine', 'Breakfast', 'Outdoor seating', 'Family friendly', 'Parking', 'Wi-Fi', 'Home delivery'];
const manualGuideTraits = ['Certified guide', 'Nature trail', 'Safari coordination', 'Local expert', 'Photography'];
const manualAccommodationAmenities = ['Breakfast', 'Local transfers', 'Nature trail', 'Parking', 'Wi-Fi', 'Family friendly'];

export default function VendorDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // overview | products | services | bookings | kyc
  const [dashboard, setDashboard] = useState(null);
  const [registeredProviders, setRegisteredProviders] = useState({ guides: [], homestays: [], restaurants: [] });
  const [registeredDestinations, setRegisteredDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');

  // Product modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Dhokra',
    price: 1500,
    stock: 10,
    district: 'Ranchi',
    material: 'Brass',
    badge: 'Handcrafted',
    description: '',
    image: ''
  });
  const [productSubmitting, setProductSubmitting] = useState(false);

  // Service modal state
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    title: '',
    category: user?.role === 'guide' ? 'guide' : 'homestay',
    price: 1200,
    district: 'Latehar',
    duration: 'Full Day',
    description: '',
    startingLocation: '',
    destination: '',
    meetingPoint: '',
    image: '',
    amenities: [],
    availableFrom: '',
    availableTo: '',
    maxGroupSize: ''
    ,roomType: 'Standard',
    availableRooms: ''
    ,guideId: '',
    homestayId: '',
    restaurantId: '',
    venueName: '',
    roomTypes: [{ type: 'AC Double Bed', pricePerPerson: '', availableRooms: '' }],
    intermediateStops: [{ district: '', name: '' }],
    selectedGuides: [],
    selectedHotels: [],
    selectedRestaurants: [],
    hotelRoomTypes: {},
    guideLanguages: '',
    guideExperience: '',
    guideTraits: [],
    manualServices: { hotels: [], guides: [], restaurants: [] },
    manualDefaults: { hotels: true, guides: true, restaurants: true }
  });
  const [serviceSubmitting, setServiceSubmitting] = useState(false);

  // KYC form state
  const [kycForm, setKycForm] = useState({
    businessName: '',
    category: 'guide',
    district: 'Ranchi',
    licenseNumber: '',
    documents: []
  });
  const [kycLoading, setKycLoading] = useState(false);
  const [kycDocumentType, setKycDocumentType] = useState('Government ID');
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    profileImage: user?.profile_image || '',
    businessName: '',
    providerType: '',
    district: 'Ranchi',
    address: '',
    state: 'Jharkhand',
    serviceArea: 'Statewide',
    specialization: '',
    languages: '',
    licenseNumber: '',
    governmentIdType: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [certificateQr, setCertificateQr] = useState('');
  const [copiedTransaction, setCopiedTransaction] = useState(false);

  const loadData = async () => {
    try {
      const res = await api.vendor.getDashboard();
      if (res && res.success) {
        setDashboard(res);
        if (res.vendor) {
          setProfileForm((current) => ({
            ...current,
            name: res.vendor.name || current.name,
            phone: res.vendor.phone || user?.phone || current.phone || '',
            profileImage: res.vendor.profileImage || current.profileImage
            ,businessName: res.vendor.businessName || current.businessName
            ,providerType: res.vendor.providerType || current.providerType
            ,district: res.vendor.district || current.district
            ,address: res.vendor.address || current.address
            ,state: res.vendor.state || current.state
            ,serviceArea: res.vendor.serviceArea || current.serviceArea
            ,specialization: res.vendor.specialization || current.specialization
            ,languages: Array.isArray(res.vendor.languages) ? res.vendor.languages.join(', ') : (res.vendor.languages || current.languages)
            ,licenseNumber: res.vendor.licenseNumber || current.licenseNumber
            ,governmentIdType: res.vendor.governmentIdType || current.governmentIdType
          }));
          setKycForm({
            businessName: res.vendor.businessName || '',
            category: res.vendor.providerType === 'guide' ? 'guide' : 'package',
            district: res.vendor.district || 'Ranchi',
            licenseNumber: res.vendor.licenseNumber || '',
            documents: []
          });
        }
        const marketplace = await api.marketplace.getData();
        if (marketplace?.success) {
          setRegisteredProviders({
            guides: marketplace.guides || [],
            homestays: marketplace.homestays || [],
            restaurants: (marketplace.services || []).filter((service) => service.category === 'restaurant')
          });
        }
        const destinations = await api.destinations.getAll('?limit=200');
        if (destinations?.success) setRegisteredDestinations(destinations.destinations || destinations.data || []);
      }
    } catch (err) {
      console.warn('Vendor dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const providerId = dashboard?.vendor?.id;
    if (!dashboard?.certificate || !providerId) {
      setCertificateQr('');
      return undefined;
    }
    const verificationUrl = `${window.location.origin}/verify/guide/${encodeURIComponent(providerId)}`;
    QRCode.toDataURL(verificationUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#070b14', light: '#ffffff' }
    }).then((dataUrl) => {
      if (!cancelled) setCertificateQr(dataUrl);
    }).catch(() => {
      if (!cancelled) setCertificateQr('');
    });
    return () => { cancelled = true; };
  }, [dashboard?.certificate, dashboard?.vendor?.id]);

  useEffect(() => {
    if (user?.role === 'guide' || dashboard?.vendor?.providerType === 'guide') {
      setServiceForm((current) => ({ ...current, category: 'guide' }));
    }
  }, [user?.role, dashboard?.vendor?.providerType]);

  const readImage = (file, onChange) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };

  const renderManualOptions = (type, item, index) => {
    const field = type === 'guides' ? 'traits' : 'amenities';
    const options = type === 'guides' ? manualGuideTraits : type === 'restaurants' ? manualRestaurantAmenities : manualAccommodationAmenities;
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

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    try {
      const response = await api.auth.updateProfile({
        name: profileForm.name,
        phone: profileForm.phone,
        profileImage: profileForm.profileImage
      });
      await api.vendor.updateProfile({
        business_name: profileForm.businessName,
        provider_type: profileForm.providerType,
        district: profileForm.district,
        address: profileForm.address,
        state: profileForm.state,
        service_area: profileForm.serviceArea,
        specialization: profileForm.specialization,
        languages: profileForm.languages.split(',').map((value) => value.trim()).filter(Boolean),
        license_number: profileForm.licenseNumber,
        government_id_type: profileForm.governmentIdType
      });
      localStorage.setItem('jharkhand_user', JSON.stringify(response.user));
      setActionMessage(`${user?.role === 'guide' ? 'Guide' : 'Vendor'} profile updated successfully.`);
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setActionMessage('Error: New passwords do not match.');
      return;
    }
    setProfileSaving(true);
    try {
      await api.auth.changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setActionMessage('Password changed successfully.');
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleConfirmService = async (bookingId) => {
    setActionMessage('');
    try {
      const res = await api.vendor.confirmService(bookingId);
      setActionMessage(`Success: ${res.message || 'Service confirmed and escrow released.'}`);
      await loadData();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price) {
      setActionMessage('Error: Product name and price are required.');
      return;
    }
    setProductSubmitting(true);
    setActionMessage('');
    try {
      await api.marketplace.createProduct(productForm);
      setActionMessage(`Product "${productForm.name}" created and immediately published!`);
      setIsProductModalOpen(false);
      setProductForm({
        name: '',
        category: 'Dhokra',
        price: 1500,
        stock: 10,
        district: 'Ranchi',
        material: 'Brass',
        badge: 'Handcrafted',
        description: '',
        image: ''
      });
      await loadData();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setProductSubmitting(false);
    }
  };

  const handleDeleteProduct = async (prodId, prodName) => {
    if (!window.confirm(`Are you sure you want to delete "${prodName}"?`)) return;
    try {
      await api.marketplace.deleteProduct(prodId);
      setActionMessage(`Product "${prodName}" removed.`);
      await loadData();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    if (!serviceForm.title || !serviceForm.price) {
      setActionMessage('Error: Service title and price are required.');
      return;
    }
    setServiceSubmitting(true);
    setActionMessage('');
    const roomInventory = serviceForm.category === 'homestay' && Object.values(serviceForm.hotelRoomTypes).flat().length > 0
      ? Object.values(serviceForm.hotelRoomTypes).flat()
      : serviceForm.category === 'homestay' ? serviceForm.roomTypes : [];
    try {
      await api.vendor.addService({
        ...serviceForm,
        durationDays: serviceForm.duration === 'Full Day' ? 1 : Number.parseInt(serviceForm.duration, 10) || 1,
        description: `${serviceForm.description.trim()}${serviceForm.meetingPoint ? `\nMeeting point: ${serviceForm.meetingPoint.trim()}` : ''}${serviceForm.destination ? `\nDestination: ${serviceForm.destination.trim()}` : ''}`,
        amenities: serviceForm.category === 'guide' ? serviceForm.guideTraits : serviceForm.amenities,
        availability: {
          startingLocation: serviceForm.startingLocation,
          destination: serviceForm.destination,
          meetingPoint: serviceForm.meetingPoint,
          availableFrom: serviceForm.availableFrom || undefined,
          availableTo: serviceForm.availableTo || undefined,
          maxGroupSize: serviceForm.maxGroupSize ? Number(serviceForm.maxGroupSize) : undefined,
          roomType: serviceForm.roomType || undefined,
          availableRooms: serviceForm.availableRooms === ''
            ? roomInventory.reduce((total, room) => total + (Number(room.availableRooms) || 0), 0) || undefined
            : Number(serviceForm.availableRooms),
          guideId: serviceForm.guideId || undefined,
          homestayId: serviceForm.homestayId || undefined,
            restaurantId: serviceForm.restaurantId || undefined,
            venueName: serviceForm.venueName.trim() || undefined,
            intermediateStops: serviceForm.intermediateStops.filter((stop) => stop.district || stop.name),
            selectedGuides: serviceForm.selectedGuides,
            selectedHotels: serviceForm.selectedHotels,
            selectedRestaurants: serviceForm.selectedRestaurants,
            guideLanguages: serviceForm.guideLanguages,
            guideExperience: serviceForm.guideExperience,
            guideTraits: serviceForm.guideTraits,
            manualServices: serviceForm.manualServices,
            manualDefaults: serviceForm.manualDefaults,
            roomTypes: roomInventory.filter((room) => room.type.trim()).map((room) => ({
              type: room.type.trim(),
              pricePerPerson: Number(room.pricePerPerson) || 0,
              availableRooms: Math.max(0, Number(room.availableRooms) || 0)
            })),
            hotelRoomTypes: Object.fromEntries(Object.entries(serviceForm.hotelRoomTypes).map(([hotelId, rooms]) => [hotelId, rooms.filter((room) => room.type.trim()).map((room) => ({
              type: room.type.trim(),
              pricePerPerson: Number(room.pricePerPerson) || 0,
              availableRooms: Math.max(0, Number(room.availableRooms) || 0)
            }))]))
        }
      });
      setActionMessage(`Service "${serviceForm.title}" added successfully!`);
      setIsServiceModalOpen(false);
      setServiceForm({
        title: '',
        category: isGuide ? 'guide' : 'homestay',
        price: 1200,
        district: 'Latehar',
        duration: 'Full Day',
        description: '',
        startingLocation: '',
        destination: '',
        meetingPoint: '',
        image: '',
        amenities: [],
        availableFrom: '',
        availableTo: '',
        maxGroupSize: '',
        roomType: 'Standard',
        availableRooms: '',
        guideId: '',
        homestayId: '',
        restaurantId: '',
        venueName: '',
        roomTypes: [{ type: 'AC Double Bed', pricePerPerson: '', availableRooms: '' }],
        intermediateStops: [{ district: '', name: '' }],
        selectedGuides: [],
        selectedHotels: [],
        selectedRestaurants: [],
        hotelRoomTypes: {},
        guideLanguages: '',
        guideExperience: '',
        guideTraits: [],
        manualServices: { hotels: [], guides: [], restaurants: [] },
        manualDefaults: { hotels: true, guides: true, restaurants: true }
      });
      await loadData();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setServiceSubmitting(false);
    }
  };

  const handleKycSubmit = async (e) => {
    e.preventDefault();
    setKycLoading(true);
    setActionMessage('');
    try {
      const res = await api.vendor.submitKYC({ ...kycForm, licenseType: kycDocumentType });
      setActionMessage(res.message || 'KYC application submitted for review.');
      await loadData();
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setKycLoading(false);
    }
  };

  const cert = dashboard?.certificate;
  const certificateTransaction = cert?.blockchain_tx_hash;
  const copyCertificateTransaction = async () => {
    if (!certificateTransaction || !navigator.clipboard) return;
    await navigator.clipboard.writeText(certificateTransaction);
    setCopiedTransaction(true);
    window.setTimeout(() => setCopiedTransaction(false), 1600);
  };
  const stats = dashboard?.stats || {
    totalBookings: 0,
    activeEscrowBookings: 0,
    pendingEscrowFunds: 0,
    totalEarned: 0,
    averageRating: 0,
    productsCount: 0,
    servicesCount: 0
  };

  const isGuide = dashboard?.vendor?.providerType === 'guide' || user?.role === 'guide';
  const isVendor = !isGuide;
  const providersAtLocation = {
    guides: registeredProviders.guides.filter((service) => service.district === serviceForm.district),
    homestays: registeredProviders.homestays.filter((service) => service.district === serviceForm.district),
    restaurants: registeredProviders.restaurants.filter((service) => service.district === serviceForm.district)
  };
  const routeDistricts = [serviceForm.startingLocation, ...serviceForm.intermediateStops.map((stop) => stop.district), serviceForm.destination, serviceForm.district].filter(Boolean);
  const routeIncludesAllDistricts = routeDistricts.includes('All districts');
  const providersOnRoute = {
    guides: registeredProviders.guides.filter((service) => routeIncludesAllDistricts || routeDistricts.includes(service.district)),
    homestays: registeredProviders.homestays.filter((service) => routeIncludesAllDistricts || routeDistricts.includes(service.district)),
    restaurants: registeredProviders.restaurants.filter((service) => routeIncludesAllDistricts || routeDistricts.includes(service.district))
  };
  const routeDestinations = registeredDestinations.filter((destination) => routeIncludesAllDistricts || routeDistricts.includes(destination.district));
  const destinationsOnRoute = routeDestinations.length > 0 ? routeDestinations : registeredDestinations;
  const locationOptions = [
    ...destinationsOnRoute.map((destination) => destination.name || destination.title),
    ...providersOnRoute.homestays.map((service) => service.title),
    ...providersOnRoute.restaurants.map((service) => service.title)
  ].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index);
  const myProducts = dashboard?.products || [];
  const myServices = dashboard?.services || [];
  const myBookings = dashboard?.bookings || [];
  const reviews = dashboard?.reviews || [];
  const notifications = dashboard?.notifications || [];
  const verificationRequests = dashboard?.verificationRequests || [];
  const verificationStatus = dashboard?.vendor?.verified
    ? 'approved'
    : dashboard?.vendor?.kycStatus === 'rejected'
      ? 'rejected'
      : 'pending';
  const statusLabel = verificationStatus === 'approved'
    ? 'VERIFIED'
    : verificationStatus === 'rejected'
      ? 'VERIFICATION REQUIRED'
      : 'KYC PENDING';
  const providerId = dashboard?.vendor?.id || user?.id || '--';
  const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN') : '--';

  return (
    <div aria-busy={loading} className="min-h-screen bg-[#070b14] text-slate-100 pt-32 pb-24 px-6 md:px-16 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold uppercase tracking-widest mb-3">
              <Award size={14} />
              {isGuide ? 'Guide Portal' : 'Vendor Portal'}
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold">
              {dashboard?.vendor?.name || user?.name || 'Local Service Provider'}
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Manage your tourism services, bookings, credentials and earnings from one place.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
              <span className="text-slate-300">{dashboard?.vendor?.businessName || 'Registered tourism provider'}</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-400">Provider ID: {providerId}</span>
              <span className={`rounded-full border px-3 py-1 font-bold tracking-wider ${
                verificationStatus === 'approved'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : verificationStatus === 'rejected'
                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              }`}>{statusLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setActiveTab('profile')} className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300 hover:border-amber-400">Profile & Security</button>
            {verificationStatus === 'approved' ? (
              <span className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={16} />
                Blockchain Verified Provider
              </span>
            ) : (
              <span className="px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                <AlertCircle size={16} />
                KYC Review Pending
              </span>
            )}
          </div>
        </div>

        {/* Action Alert Banner */}
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
            { id: 'overview', label: 'Overview & Credentials', icon: ShieldCheck },
            ...(isVendor ? [{ id: 'products', label: `My Crafts & Products (${myProducts.length})`, icon: ShoppingBag }] : []),
            { id: 'services', label: `${isGuide ? 'My Guide Services' : 'My Tourism Services'} (${myServices.length})`, icon: Compass },
            { id: 'bookings', label: `Incoming Bookings (${myBookings.length})`, icon: Wallet },
            { id: 'kyc', label: 'Licensing & KYC', icon: FileCheck },
            { id: 'profile', label: 'Profile & Security', icon: Lock }
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

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-6 rounded-2xl bg-[#0b1326] border border-slate-800">
                <div className="text-amber-400 text-xs uppercase tracking-widest mb-2 font-semibold">Total Bookings</div>
                <div className="text-3xl font-serif font-bold text-white">
                  {stats.totalBookings}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Platform fulfillment</div>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1326] border border-slate-800">
                <div className="text-amber-400 text-xs uppercase tracking-widest mb-2 font-semibold">Escrow Funds Pending</div>
                <div className="text-3xl font-serif font-bold text-amber-400">
                  ₹{(stats.pendingEscrowFunds || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Awaiting delivery / service</div>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1326] border border-slate-800">
                <div className="text-amber-400 text-xs uppercase tracking-widest mb-2 font-semibold">Settled Earnings</div>
                <div className="text-3xl font-serif font-bold text-emerald-400">
                  ₹{(stats.totalEarned || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Transferred to account</div>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1326] border border-slate-800">
                <div className="text-amber-400 text-xs uppercase tracking-widest mb-2 font-semibold">Quality Rating</div>
                <div className="text-3xl font-serif font-bold text-white flex items-center gap-1">
                  <Star size={20} className="fill-amber-400 text-amber-400" />
                  {stats.averageRating > 0 ? stats.averageRating : '--'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">{stats.reviewCount ? `Based on ${stats.reviewCount} review${stats.reviewCount === 1 ? '' : 's'}` : 'No reviews yet'}</div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-3xl border border-slate-800 bg-[#0b1326] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-amber-400">Business verification</p>
                    <h2 className="mt-1 text-xl font-serif font-bold">Provider status</h2>
                  </div>
                  <button onClick={() => setActiveTab('kyc')} className="text-xs font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300">View KYC status</button>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-wider">
                  {['Account created', 'Documents submitted', 'Government review'].map((label, index) => {
                    const complete = index === 0 || verificationRequests.length > 0 || verificationStatus === 'approved';
                    return <div key={label} className={`rounded-xl border p-3 ${complete ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-950/40 text-slate-500'}`}>{complete ? '✓' : '○'}<div className="mt-2">{label}</div></div>;
                  })}
                </div>
              </section>
              <section className="rounded-3xl border border-slate-800 bg-[#0b1326] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-amber-400">Quick actions</p>
                    <h2 className="mt-1 text-xl font-serif font-bold">Command center</h2>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[...(isVendor ? [['Add Tourism Service', 'services'], ['Add product', 'products']] : [['Create Guide Service', 'services']]), ['View bookings', 'bookings'], ['KYC', 'kyc']].map(([label, tab]) => <button key={label} onClick={() => setActiveTab(tab)} className="rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-3 text-left text-xs font-semibold text-slate-300 hover:border-amber-400 hover:text-amber-300">{label}</button>)}
                </div>
              </section>
            </div>

            {/* Blockchain Digital Certificate Card */}
            <div className="bg-[#0b1326] border border-slate-800 rounded-3xl p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                  <ShieldCheck size={14} />
                  Immutable Digital Credential (NFT Standard)
                </div>
                <h2 className="text-2xl font-serif font-bold">Government Verified Certificate</h2>
                
                {cert ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-slate-300 pt-2">
                    <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-500 uppercase text-[10px] block">Provider ID</span>
                      <span className="text-cyan-300 font-bold">{cert.provider_id || dashboard?.vendor?.id || '--'}</span>
                    </div>
                    <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-500 uppercase text-[10px] block">Certificate ID</span>
                      <span className="text-amber-400 font-bold">{cert.certificate_id || cert.certificateId || '--'}</span>
                    </div>
                    <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-500 uppercase text-[10px] block">Status / Issued</span>
                      <span className="text-emerald-400">{cert.status || 'verified'} / {formatDate(cert.issue_date)}</span>
                    </div>
                    <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1 md:col-span-2">
                      <span className="text-slate-500 uppercase text-[10px] block">Blockchain transaction</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-emerald-400 break-all">{certificateTransaction || '--'}</span>
                        {certificateTransaction && <button type="button" onClick={copyCertificateTransaction} title="Copy transaction hash" aria-label="Copy transaction hash" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-amber-400 hover:text-amber-300"><Copy size={12} /> {copiedTransaction ? 'Copied' : 'Copy'}</button>}
                        {certificateTransaction && <a href={`https://amoy.polygonscan.com/tx/${encodeURIComponent(certificateTransaction)}`} target="_blank" rel="noreferrer" title="Open transaction on Polygon Amoy" className="text-amber-300 hover:text-amber-200"><ExternalLink size={14} /></a>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300 space-y-2">
                    <p className="font-bold">KYC Verification in Progress</p>
                    <p className="text-slate-400">
                      Your business documents are currently pending administrative review. Once approved, an immutable SHA-256 certificate and QR code will appear here.
                    </p>
                  </div>
                )}

                <p className="text-xs text-slate-400 leading-relaxed pt-2">
                  This certificate is permanently anchored in the Jharkhand Tourism smart contract registry. Any modification to provider credentials triggers an instant hash invalidation during tourist scans.
                </p>
              </div>

              <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
                <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">Tourist Verification</span>
                {certificateQr ? (
                  <>
                    <div className="p-2.5 bg-white rounded-xl shadow-lg">
                      <img src={certificateQr} alt="Provider credential verification QR" className="w-40 h-40 object-contain" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Scan to verify provider credentials</span>
                  </>
                ) : (
                  <p className="py-10 text-xs text-slate-500">QR verification will be available after credential issuance.</p>
                )}
                {cert && <Link to="/verify" className="text-xs font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300">Verify credential</Link>}
              </div>
            </div>

            <section className="rounded-3xl border border-slate-800 bg-[#0b1326] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-amber-400">Quality & reviews</p>
                  <h2 className="mt-1 text-xl font-serif font-bold">Recent feedback</h2>
                </div>
                <span className="text-sm text-slate-400">{stats.reviewCount || 0} review{stats.reviewCount === 1 ? '' : 's'}</span>
              </div>
              {reviews.length === 0 ? (
                <p className="mt-5 rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">No reviews yet.</p>
              ) : (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {reviews.slice(0, 4).map((review) => (
                    <div key={review.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-400">{'★'.repeat(Math.max(0, Math.min(5, review.rating || 0)))}</span>
                        <span className="text-slate-500">{formatDate(review.created_at)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{review.comment || review.text || 'Review submitted.'}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: MY PRODUCTS & CRAFTS */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-serif font-bold">Artisan Crafts & Marketplace Catalog</h2>
                <p className="text-xs text-slate-400">
                  Products added here appear live on the public Jharkhand Artisan Marketplace immediately.
                </p>
              </div>
              {isVendor && <button
                onClick={() => setIsProductModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition shadow-lg shadow-amber-400/20"
              >
                <Plus size={16} />
                <span>Add New Product</span>
              </button>}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0b1326] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#070b14] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">Product Name</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">District</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {myProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-500">
                          No products listed yet. Click "Add New Product" above to publish your first craft!
                        </td>
                      </tr>
                    ) : (
                      myProducts.map((prod) => (
                        <tr key={prod.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {prod.image && <img src={prod.image} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                              <div>
                                <div className="font-bold text-white text-sm">{prod.name}</div>
                                <div className="text-[10px] text-amber-400">{prod.badge || 'Handmade'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-slate-300">{prod.category}</td>
                          <td className="p-4 text-slate-400">{prod.district}</td>
                          <td className="p-4 font-bold text-emerald-400">₹{prod.price?.toLocaleString('en-IN')}</td>
                          <td className="p-4 text-slate-300">{prod.stock} units</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                              {prod.approval_status || 'Approved'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleDeleteProduct(prod.id, prod.name)}
                              className="p-2 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900/60 transition"
                              title="Delete Product"
                            >
                              <Trash2 size={15} />
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

        {/* TAB 3: MY TOUR SERVICES */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-serif font-bold">Guiding & Tourism Services</h2>
                <p className="text-xs text-slate-400">
                  List customized heritage trails, nature walks, and homestay packages for travelers.
                </p>
              </div>
              <button
                onClick={() => {
                  setServiceForm((current) => ({ ...current, category: isGuide ? 'guide' : current.category }));
                  setIsServiceModalOpen(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition shadow-lg shadow-amber-400/20"
              >
                <Plus size={16} />
                <span>{isGuide ? 'Add Guide Service' : 'Add Tourism Service'}</span>
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0b1326] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#070b14] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">Tour / Service Title</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">District</th>
                      <th className="p-4">Rate</th>
                      <th className="p-4">Duration</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {myServices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-500">
                          No tour services listed yet. Click "Add Tour Package" above.
                        </td>
                      </tr>
                    ) : (
                      myServices.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {s.image && <img src={s.image} alt="" className="h-10 w-14 rounded-lg object-cover" />}
                              <span className="font-bold text-white text-sm">{s.title}</span>
                            </div>
                          </td>
                          <td className="p-4 capitalize text-amber-400">{s.category}</td>
                          <td className="p-4 text-slate-300">{s.district}</td>
                          <td className="p-4 font-bold text-emerald-400">₹{s.price?.toLocaleString('en-IN')}</td>
                          <td className="p-4 text-slate-400">{s.duration || 'Full Day'}</td>
                          <td className="p-4">
                            {Array.isArray(s.availability?.roomTypes) && s.availability.roomTypes.length > 0 && (
                              <div className="mb-2 text-[10px] text-slate-400">
                                Rooms: {s.availability.roomTypes.map((room) => `${room.type} (${room.availableRooms})`).join(', ')}
                              </div>
                            )}
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                              {s.approval_status === 'approved' ? 'Approved' : s.approval_status === 'rejected' ? 'Rejected' : s.approval_status === 'changes_requested' ? 'Changes requested' : 'Pending review'}
                            </span>
                            {s.review_reason && <div className="mt-1 max-w-48 text-[10px] text-red-300">{s.review_reason}</div>}
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

        {/* TAB 4: INCOMING BOOKINGS */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-serif font-bold">Incoming Tourist Bookings & Escrow Releases</h2>
              <p className="text-xs text-slate-400 mt-1">
                Confirm tour fulfillment or artisan delivery to automatically trigger payment release from smart contract escrow into your bank account.
              </p>
            </div>

            <div className="space-y-4">
              {myBookings.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm bg-[#0b1326] border border-slate-800 rounded-3xl">
                  No bookings received yet. When tourists place orders or book your tours, they will appear here with smart contract escrow security.
                </div>
              ) : (
                myBookings.map((b) => (
                  <div key={b.id} className="p-6 rounded-3xl bg-[#0b1326] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-amber-400 font-bold">{b.id}</span>
                        <span className="text-xs text-slate-400">• Tourist ID: <strong className="text-white">{b.tourist_id}</strong></span>
                        <span className="text-xs text-slate-400">• Date: {new Date(b.created_at).toLocaleDateString()}</span>
                      </div>
                      <h3 className="text-lg font-bold text-white">{b.title}</h3>
                      <div className="text-xs font-mono text-slate-400 space-x-4">
                        <span>Amount: <strong className="text-emerald-400">₹{(b.total_amount || 0).toLocaleString('en-IN')}</strong></span>
                        <span>Escrow: <strong className="text-amber-400 capitalize">{b.escrow_status || 'locked'}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {b.escrow_status === 'locked' ? (
                        <button
                          onClick={() => handleConfirmService(b.id)}
                          className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-90 transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                        >
                          <CheckCircle2 size={16} />
                          Confirm Delivery & Release Payout
                        </button>
                      ) : (
                        <span className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                          <CheckCircle2 size={16} />
                          Escrow Settled & Transferred
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: KYC & LICENSING */}
        {activeTab === 'kyc' && (
          <div className="bg-[#0b1326] border border-slate-800 rounded-3xl p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-serif font-bold">Provider KYC & Licensing Information</h2>
              <p className="text-xs text-slate-400 mt-1">
                Submit renewed government guide certificates, homestay safety licenses, or tribal craft association memberships for administrative verification.
              </p>
            </div>

            <form onSubmit={handleKycSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block uppercase tracking-widest text-slate-400 mb-1.5">Business / Unit Name *</label>
                <input
                  type="text"
                  value={kycForm.businessName}
                  onChange={(e) => setKycForm({ ...kycForm, businessName: e.target.value })}
                  placeholder="e.g. Hazaribagh Sohrai Art Guild"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block uppercase tracking-widest text-slate-400 mb-1.5">Service Category</label>
                <select
                  value={kycForm.category}
                  onChange={(e) => setKycForm({ ...kycForm, category: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                >
                  {isGuide ? <option value="guide">Guide</option> : (
                    <>
                      <option value="homestay">Hotel / homestay</option>
                      <option value="restaurant">Restaurant</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block uppercase tracking-widest text-slate-400 mb-1.5">Operational District</label>
                <select
                  value={kycForm.district}
                  onChange={(e) => setKycForm({ ...kycForm, district: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                >
                  {jharkhandDistricts.map(d => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block uppercase tracking-widest text-slate-400 mb-1.5">Identity / License Number *</label>
                <input
                  type="text"
                  value={kycForm.licenseNumber}
                  onChange={(e) => setKycForm({ ...kycForm, licenseNumber: e.target.value })}
                  placeholder="e.g. JTDC-LIC-2026-90"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block uppercase tracking-widest text-slate-400 mb-1.5">Document type *</label>
                <select
                  value={kycDocumentType}
                  onChange={(e) => setKycDocumentType(e.target.value)}
                  className="mb-3 w-full rounded-xl bg-[#070b14] border border-slate-700 px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                >
                  <option>Aadhar Card</option>
                  <option>PAN Card</option>
                  <option>Driving Licence</option>
                </select>
                <label className="block uppercase tracking-widest text-slate-400 mb-1.5">Upload documents *</label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    const documents = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve({ type: kycDocumentType, fileName: file.name, fileType: file.type, fileSize: file.size, uploadedAt: new Date().toISOString(), dataUrl: reader.result });
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    })));
                    setKycForm((current) => ({ ...current, documents: [...current.documents, ...documents] }));
                  }}
                  className="w-full rounded-xl bg-[#070b14] border border-slate-700 px-4 py-2.5 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:font-semibold file:text-slate-950"
                />
                <p className="mt-1 text-[10px] text-slate-500">Selected files are saved as {kycDocumentType}. Choose another type and upload again to add another category. Selected files: {kycForm.documents.length}</p>
                {kycForm.documents.length > 0 && <div className="mt-3 space-y-1">{kycForm.documents.map((document, index) => <div key={`${document.fileName}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2 text-[10px]"><span className="text-slate-300">{document.fileName}</span><span className="text-amber-400">{document.type}</span></div>)}</div>}
              </div>

              <div className="md:col-span-4 flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={kycLoading}
                  className="px-6 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold uppercase tracking-wider hover:bg-amber-300 transition"
                >
                  {kycLoading ? 'Submitting...' : 'Submit Documents for Verification'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <section className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-[#18233d] via-[#0b1326] to-[#070b14] p-6 md:p-8">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />
              <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-slate-950 text-4xl font-serif font-bold text-amber-300 shadow-xl shadow-amber-950/30">
                  {profileForm.profileImage ? <img src={profileForm.profileImage} alt="Profile" className="h-full w-full object-cover" /> : (profileForm.name || 'P').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Public provider profile</p>
                  <h2 className="mt-2 truncate text-3xl font-serif font-bold text-white">{profileForm.name || 'Your profile'}</h2>
                  <p className="mt-1 text-sm text-slate-400">{dashboard?.vendor?.businessName || 'Add your business or unit details in Licensing & KYC'}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                    <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-cyan-300">{user?.role === 'guide' ? 'Guide' : 'Vendor'}</span>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-emerald-300">{dashboard?.vendor?.kycStatus || 'pending'}</span>
                    <span className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-slate-300">{dashboard?.vendor?.district || 'District not set'}</span>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <form onSubmit={handleProfileSave} className="space-y-5 rounded-3xl border border-slate-800 bg-[#0b1326] p-6 md:p-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Account details</p>
                  <h2 className="mt-2 text-2xl font-serif font-bold">Personal information</h2>
                  <p className="mt-1 text-xs text-slate-500">Update your account and provider details here. KYC documents remain the submitted records.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-xs text-slate-400">Full name
                    <input required value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white" />
                  </label>
                  <label className="text-xs text-slate-400">Registered mobile number
                    <input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="Enter mobile number" className="mt-2 w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white" />
                  </label>
                  <label className="text-xs text-slate-400 md:col-span-2">Registered email
                    <input value={dashboard?.vendor?.email || user?.email || ''} readOnly className="mt-2 w-full cursor-not-allowed rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400" />
                  </label>
                  <label className="text-xs text-slate-400">Business / unit name
                    <input value={profileForm.businessName} onChange={(e) => setProfileForm({ ...profileForm, businessName: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white" />
                  </label>
                  <label className="text-xs text-slate-400">District
                    <select value={profileForm.district} onChange={(e) => setProfileForm({ ...profileForm, district: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white">{jharkhandDistricts.map((district) => <option key={district}>{district}</option>)}</select>
                  </label>
                  <label className="text-xs text-slate-400 md:col-span-2">Address
                    <input value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white" />
                  </label>
                  <label className="text-xs text-slate-400">State
                    <input value={profileForm.state} onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white" />
                  </label>
                  <label className="text-xs text-slate-400">Service area
                    <select value={profileForm.serviceArea} onChange={(e) => setProfileForm({ ...profileForm, serviceArea: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white">
                      <option value="Statewide">All Jharkhand (Statewide)</option>
                      {jharkhandDistricts.map((district) => <option key={district} value={district}>{district}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-slate-400">Specialization
                    <input value={profileForm.specialization} onChange={(e) => setProfileForm({ ...profileForm, specialization: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white" />
                  </label>
                  {isGuide && (
                    <label className="text-xs text-slate-400">Languages
                      <input value={profileForm.languages} onChange={(e) => setProfileForm({ ...profileForm, languages: e.target.value })} placeholder="Hindi, English" className="mt-2 w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white" />
                    </label>
                  )}
                  <label className="text-xs text-slate-400">License number
                    <input value={profileForm.licenseNumber} onChange={(e) => setProfileForm({ ...profileForm, licenseNumber: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white" />
                  </label>
                  <div className="md:col-span-2 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Submitted KYC documents</p>
                    {(dashboard?.verificationRequests || []).flatMap((request) => request.documents || []).length === 0
                      ? <p className="mt-2 text-xs text-slate-500">No submitted documents found.</p>
                      : <div className="mt-2 space-y-2">{(dashboard?.verificationRequests || []).flatMap((request) => request.documents || []).map((document, index) => <div key={`${document.fileName || document.type}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs"><span className="text-slate-200">{document.fileName || 'Submitted document'} <span className="text-amber-300">({document.type || 'Government ID'})</span></span>{document.dataUrl && <span className="flex items-center gap-2">{(document.fileType || '').startsWith('image/') ? <a href={document.dataUrl} target="_blank" rel="noreferrer" className="text-amber-300 hover:text-amber-200">View</a> : <a href={document.dataUrl} download={document.fileName || 'submitted-document'} className="text-amber-300 hover:text-amber-200">Download</a>}</span>}</div>)}</div>}
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 p-4">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Profile image</label>
                  <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 text-2xl font-serif text-amber-300">
                      {profileForm.profileImage ? <img src={profileForm.profileImage} alt="Profile preview" className="h-full w-full object-cover" /> : (profileForm.name || 'P').charAt(0).toUpperCase()}
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0], (profileImage) => setProfileForm({ ...profileForm, profileImage }))} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:font-semibold file:text-slate-950" />
                  </div>
                </div>
                <button disabled={profileSaving} className="w-full rounded-xl bg-amber-400 py-3 text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-amber-300 disabled:opacity-60">{profileSaving ? 'Saving...' : 'Save profile details'}</button>
              </form>

              <div className="space-y-6">
                <form onSubmit={handlePasswordChange} className="space-y-4 rounded-3xl border border-slate-800 bg-[#0b1326] p-6 md:p-8">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Security</p>
                  <h2 className="text-xl font-serif font-bold">Change password</h2>
                  <input required type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} placeholder="Current password" className="w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white" />
                  <input required minLength="6" type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} placeholder="New password" className="w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white" />
                  <input required minLength="6" type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} placeholder="Confirm new password" className="w-full rounded-xl border border-slate-700 bg-[#070b14] px-4 py-3 text-sm text-white" />
                  <button disabled={profileSaving} className="w-full rounded-xl border border-slate-700 py-3 text-xs font-bold uppercase tracking-wider text-slate-200 hover:border-amber-400 disabled:opacity-60">Change password</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD PRODUCT */}
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0b1326] border border-slate-700 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6 text-slate-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-xl font-serif font-bold text-white">Add Handcrafted Product</h3>
                <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Product Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dhokra Brass Dancing Figure"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Category</label>
                    <select
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      {['Paintings', 'Dhokra', 'Bamboo', 'Textiles', 'Jewellery', 'Home Decor'].map(c => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      required
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">District</label>
                    <select
                      value={productForm.district}
                      onChange={(e) => setProductForm({ ...productForm, district: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      {['Ranchi', 'Hazaribagh', 'Ramgarh', 'Dumka', 'Latehar', 'Giridih'].map(d => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Material</label>
                    <input
                      type="text"
                      placeholder="e.g. Brass, Natural Pigments"
                      value={productForm.material}
                      onChange={(e) => setProductForm({ ...productForm, material: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {serviceForm.category === 'package' && (
                  <div className="grid grid-cols-1 gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Package providers (optional)</p>
                    {[
                      ['selectedGuides', 'Guides on selected route', providersOnRoute.guides],
                      ['selectedHotels', 'Hotels / homestays on selected route', providersOnRoute.homestays],
                      ['selectedRestaurants', 'Restaurants on selected route', providersOnRoute.restaurants]
                    ].map(([field, label, options]) => {
                      const type = field === 'selectedHotels' ? 'hotels' : field === 'selectedGuides' ? 'guides' : 'restaurants';
                      return <div key={field}>
                        <label className="block text-slate-400 uppercase tracking-wider mb-1">{label}</label>
                        <select multiple size={3} value={serviceForm.manualDefaults[type] ? [''] : serviceForm[field]} onChange={(e) => {
                          const values = Array.from(e.target.selectedOptions, (option) => option.value);
                          const isDefault = values.includes('');
                          const selectedValues = isDefault ? [] : values;
                          setServiceForm({
                            ...serviceForm,
                            [field]: selectedValues,
                            manualDefaults: { ...serviceForm.manualDefaults, [type]: isDefault },
                            ...(field === 'selectedHotels' ? {
                              hotelRoomTypes: Object.fromEntries(selectedValues.map((hotelId) => [hotelId, serviceForm.hotelRoomTypes[hotelId] || [{ type: 'AC Double Bed', pricePerPerson: '', availableRooms: '' }]]))
                            } : {})
                          });
                        }} className="h-20 w-full rounded-xl bg-[#070b14] border border-slate-700 p-2 text-xs text-slate-100">
                          <option value="">Default - no {type === 'hotels' ? 'hotel / homestay' : type.slice(0, -1)} selected</option>
                          {options.length === 0 && <option disabled>No registered providers on selected route</option>}
                          {options.map((option) => <option key={option.id} value={option.id}>{option.title} ({option.district})</option>)}
                        </select>
                      </div>;
                    })}
                    <div className="space-y-2 border-t border-slate-800 pt-3">
                      <p className="text-[10px] text-slate-400">Choose existing listings OR use the default/manual option for each category. They cannot be used together.</p>
                      {['hotels', 'guides', 'restaurants'].filter((type) => serviceForm.manualDefaults[type]).map((type) => (
                        <div key={type} className="rounded-lg border border-slate-800 p-2">
                          <div className="mb-2 flex items-center justify-between"><span className="text-xs capitalize text-slate-300">Manual {type === 'hotels' ? 'hotel / homestay' : type.slice(0, -1)}</span><button type="button" onClick={() => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: [...serviceForm.manualServices[type], { name: '', district: serviceForm.district, address: '', contact: '', details: '', price: '', duration: 'Full Day', maxGroupSize: '', availableFrom: '', availableTo: '', image: '', amenities: [], traits: [], roomTypes: type === 'hotels' ? [{ type: '', pricePerPerson: '', availableRooms: '' }] : [] }] } })} className="rounded border border-amber-400/40 px-2 py-1 text-[10px] text-amber-300">Add manual</button></div>
                          {serviceForm.manualServices[type].map((item, index) => <div key={`${type}-${index}`} className="grid gap-2 md:grid-cols-2"><input required value={item.name} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, name: e.target.value } : entry) } })} placeholder={type === 'hotels' ? 'Hotel / homestay name *' : type === 'guides' ? 'Guide name *' : 'Restaurant name *'} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /><select required value={item.district} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, district: e.target.value } : entry) } })} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"><option value="">Select district *</option>{jharkhandDistricts.map((district) => <option key={district}>{district}</option>)}</select><input required value={item.address || ''} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, address: e.target.value } : entry) } })} placeholder="Address *" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /><input required value={item.contact || ''} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, contact: e.target.value } : entry) } })} placeholder="Contact *" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /><input required type="number" min="0" value={item.price} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, price: e.target.value } : entry) } })} placeholder="Price / rate *" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" />{type === 'guides' && <><input required value={item.languages || ''} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, guides: serviceForm.manualServices.guides.map((entry, i) => i === index ? { ...entry, languages: e.target.value } : entry) } })} placeholder="Languages *" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /><input value={item.experience || ''} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, guides: serviceForm.manualServices.guides.map((entry, i) => i === index ? { ...entry, experience: e.target.value } : entry) } })} placeholder="Experience / expertise" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /><input value={item.serviceArea || ''} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, guides: serviceForm.manualServices.guides.map((entry, i) => i === index ? { ...entry, serviceArea: e.target.value } : entry) } })} placeholder="Service area / availability" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /></>}{type === 'restaurants' && <><input required value={item.cuisine || ''} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, restaurants: serviceForm.manualServices.restaurants.map((entry, i) => i === index ? { ...entry, cuisine: e.target.value } : entry) } })} placeholder="Cuisine *" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /><input type="time" value={item.openingTime || ''} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, restaurants: serviceForm.manualServices.restaurants.map((entry, i) => i === index ? { ...entry, openingTime: e.target.value } : entry) } })} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /><input type="time" value={item.closingTime || ''} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, restaurants: serviceForm.manualServices.restaurants.map((entry, i) => i === index ? { ...entry, closingTime: e.target.value } : entry) } })} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /><input type="number" min="1" value={item.capacity || ''} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, restaurants: serviceForm.manualServices.restaurants.map((entry, i) => i === index ? { ...entry, capacity: e.target.value } : entry) } })} placeholder="Capacity" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /></>}<textarea required value={item.details} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, details: e.target.value } : entry) } })} placeholder="Description and facilities *" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 md:col-span-2" /><select value={item.duration || 'Full Day'} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, duration: e.target.value } : entry) } })} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"><option>Full Day</option><option>Half Day</option><option>Multi-day</option></select><input type="number" min="1" value={item.maxGroupSize || ''} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, maxGroupSize: e.target.value } : entry) } })} placeholder="Maximum group size" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /><label className="text-[10px] text-slate-400">Available from<input type="date" value={item.availableFrom || ''} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, availableFrom: e.target.value } : entry) } })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /></label><label className="text-[10px] text-slate-400">Available to<input type="date" min={item.availableFrom || undefined} value={item.availableTo || ''} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, availableTo: e.target.value } : entry) } })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /></label><label className="md:col-span-2 text-[10px] text-slate-400">Photo<input type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0], (image) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, image } : entry) } }))} className="mt-1 w-full text-xs text-slate-300" /></label><div className="md:col-span-2"><p className="mb-1 text-[10px] text-slate-400">{type === 'guides' ? 'Traits' : 'Amenities'}</p><div className="flex flex-wrap gap-2">{(type === 'guides' ? ['Certified guide', 'Nature trail', 'Safari coordination', 'Local expert', 'Photography'] : type === 'restaurants' ? ['Local cuisine', 'Vegetarian options', 'Non-vegetarian options', 'Jain food', 'Tribal cuisine', 'Breakfast', 'Outdoor seating', 'Family friendly', 'Parking', 'Wi-Fi', 'Home delivery'] : ['Breakfast', 'Local transfers', 'Nature trail', 'Parking', 'Wi-Fi', 'Family friendly']).map((amenity) => <label key={amenity} className="flex items-center gap-1 text-[10px] text-slate-300"><input type="checkbox" checked={(type === 'guides' ? item.traits : item.amenities || []).includes(amenity)} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, [type]: serviceForm.manualServices[type].map((entry, i) => i === index ? { ...entry, [type === 'guides' ? 'traits' : 'amenities']: e.target.checked ? [...(entry[type === 'guides' ? 'traits' : 'amenities'] || []), amenity] : (entry[type === 'guides' ? 'traits' : 'amenities'] || []).filter((value) => value !== amenity) } : entry) } })} />{amenity}</label>)}</div></div></div>)}
                          {type === 'hotels' && serviceForm.manualServices.hotels.map((item, index) => <div key={`rooms-${index}`} className="mt-2 rounded border border-amber-400/20 p-2"><div className="mb-1 flex justify-between text-[10px] text-amber-300"><span>Room types for {item.name || 'manual hotel'}</span><button type="button" onClick={() => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, hotels: serviceForm.manualServices.hotels.map((entry, i) => i === index ? { ...entry, roomTypes: [...(entry.roomTypes || []), { type: '', pricePerPerson: '', availableRooms: '' }] } : entry) } })}>Add room type</button></div>{(item.roomTypes || []).map((room, roomIndex) => <div key={roomIndex} className="grid grid-cols-3 gap-2"><input required value={room.type} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, hotels: serviceForm.manualServices.hotels.map((entry, i) => i === index ? { ...entry, roomTypes: entry.roomTypes.map((r, ri) => ri === roomIndex ? { ...r, type: e.target.value } : r) } : entry) } })} placeholder="Room type" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /><input required type="number" value={room.pricePerPerson} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, hotels: serviceForm.manualServices.hotels.map((entry, i) => i === index ? { ...entry, roomTypes: entry.roomTypes.map((r, ri) => ri === roomIndex ? { ...r, pricePerPerson: e.target.value } : r) } : entry) } })} placeholder="Price / person" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /><input required type="number" value={room.availableRooms} onChange={(e) => setServiceForm({ ...serviceForm, manualServices: { ...serviceForm.manualServices, hotels: serviceForm.manualServices.hotels.map((entry, i) => i === index ? { ...entry, roomTypes: entry.roomTypes.map((r, ri) => ri === roomIndex ? { ...r, availableRooms: e.target.value } : r) } : entry) } })} placeholder="Rooms available" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" /></div>)}</div>)}
                        </div>
                      ))}
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-slate-400 uppercase tracking-wider mb-1">Intermediate stops</label>
                      {serviceForm.intermediateStops.map((stop, index) => (
                        <div key={`stop-${index}`} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                          <select value={stop.district} onChange={(e) => setServiceForm({ ...serviceForm, intermediateStops: serviceForm.intermediateStops.map((item, i) => i === index ? { ...item, district: e.target.value } : item) })} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-slate-100">
                            <option value="">Select district</option>
                            {['Bokaro','Chatra','Deoghar','Dhanbad','Dumka','East Singhbhum','Garhwa','Giridih','Godda','Gumla','Hazaribagh','Jamtara','Khunti','Koderma','Latehar','Lohardaga','Pakur','Palamu','Ramgarh','Ranchi','Sahibganj','Seraikela-Kharsawan','Simdega','West Singhbhum'].map((district) => <option key={district}>{district}</option>)}
                          </select>
                          <input value={stop.name} readOnly placeholder="Selected district" className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-slate-400" />
                          <button type="button" onClick={() => setServiceForm({ ...serviceForm, intermediateStops: serviceForm.intermediateStops.filter((_, i) => i !== index) })} className="px-2 text-red-300">×</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setServiceForm({ ...serviceForm, intermediateStops: [...serviceForm.intermediateStops, { district: '', name: '' }] })} className="rounded-lg border border-amber-400/40 px-3 py-1 text-[10px] font-bold uppercase text-amber-300">Add intermediate stop</button>
                    </div>
                  </div>
                )}

                {(serviceForm.category === 'homestay' || serviceForm.category === 'restaurant') && (
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">
                      {serviceForm.category === 'homestay' ? 'Hotel / Homestay name *' : 'Restaurant name *'}
                    </label>
                    <input
                      required
                      value={serviceForm.venueName}
                      onChange={(e) => setServiceForm({ ...serviceForm, venueName: e.target.value })}
                      placeholder={serviceForm.category === 'homestay' ? 'Enter hotel or homestay name' : 'Enter restaurant name'}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100"
                    />
                  </div>
                )}

                {serviceForm.category === 'homestay' && (
                  <div className="space-y-4 rounded-xl border border-slate-700 bg-[#070b14] p-4">
                    <p className="font-semibold uppercase tracking-wider text-slate-300">Room inventory by hotel / homestay</p>
                    {serviceForm.category === 'package' && <p className="text-[10px] text-slate-400">Select one or more hotels above, then enter separate room types, prices, and available counts for each hotel.</p>}
                    {(serviceForm.category === 'homestay' ? ['self'] : serviceForm.selectedHotels).map((hotelId) => {
                      const rooms = serviceForm.hotelRoomTypes[hotelId] || serviceForm.roomTypes;
                      const hotel = providersOnRoute.homestays.find((item) => String(item.id) === String(hotelId));
                      return (
                        <div key={hotelId} className="space-y-2 rounded-lg border border-slate-800 p-3">
                          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-amber-300">{hotel?.title || serviceForm.venueName || 'This homestay'}</span><button type="button" onClick={() => setServiceForm({ ...serviceForm, hotelRoomTypes: { ...serviceForm.hotelRoomTypes, [hotelId]: [...rooms, { type: '', pricePerPerson: '', availableRooms: '' }] } })} className="rounded-lg border border-amber-400/40 px-3 py-1 text-[10px] font-bold uppercase text-amber-300">Add room type</button></div>
                          {rooms.map((room, index) => <div key={`${hotelId}-room-${index}`} className="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-2"><input required value={room.type} onChange={(e) => setServiceForm({ ...serviceForm, hotelRoomTypes: { ...serviceForm.hotelRoomTypes, [hotelId]: rooms.map((item, i) => i === index ? { ...item, type: e.target.value } : item) } })} placeholder="AC / Non-AC / Double Bed" className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-slate-100" /><input required type="number" min="0" value={room.pricePerPerson} onChange={(e) => setServiceForm({ ...serviceForm, hotelRoomTypes: { ...serviceForm.hotelRoomTypes, [hotelId]: rooms.map((item, i) => i === index ? { ...item, pricePerPerson: e.target.value } : item) } })} placeholder="₹ / person" className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-slate-100" /><input required type="number" min="0" value={room.availableRooms} onChange={(e) => setServiceForm({ ...serviceForm, hotelRoomTypes: { ...serviceForm.hotelRoomTypes, [hotelId]: rooms.map((item, i) => i === index ? { ...item, availableRooms: e.target.value } : item) } })} placeholder="Rooms" className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-slate-100" />{rooms.length > 1 && <button type="button" onClick={() => setServiceForm({ ...serviceForm, hotelRoomTypes: { ...serviceForm.hotelRoomTypes, [hotelId]: rooms.filter((_, i) => i !== index) } })} className="px-2 text-red-300">×</button>}</div>)}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    placeholder="Describe traditional craft process, cultural significance, and dimensions..."
                    className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Craft image</label>
                  <input type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0], (image) => setProductForm({ ...productForm, image }))} className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:font-semibold file:text-slate-950" />
                  {productForm.image && <img src={productForm.image} alt="Craft preview" className="mt-3 h-28 w-full rounded-xl object-cover" />}
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={productSubmitting}
                    className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl uppercase tracking-wider transition"
                  >
                    {productSubmitting ? 'Publishing...' : 'Publish to Marketplace'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl uppercase font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD SERVICE */}
        {isServiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0b1326] border border-slate-700 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6 text-slate-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-xl font-serif font-bold text-white">{isGuide ? 'Add Guide Service' : 'Add Tourism Service'}</h3>
                <button onClick={() => setIsServiceModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateService} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">
                    {serviceForm.category === 'guide' ? 'Guide service title *' : serviceForm.category === 'package' ? 'Package title *' : 'Service title *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={serviceForm.category === 'guide' ? 'e.g. Netarhat Sunrise Guide' : serviceForm.category === 'package' ? 'e.g. Jharkhand Heritage Circuit' : 'Enter service title'}
                    value={serviceForm.title}
                    onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Service Type</label>
                    <select
                      value={serviceForm.category}
                      onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      {isGuide ? <option value="guide">Tourist Guide</option> : (
                        <>
                          <option value="homestay">Hotel / homestay</option>
                          <option value="restaurant">Restaurant</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Daily Rate / Cost (₹) *</label>
                    <input
                      type="number"
                      required
                      value={serviceForm.price}
                      onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">District</label>
                    <select
                      value={serviceForm.district}
                      onChange={(e) => setServiceForm({ ...serviceForm, district: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      {jharkhandDistricts.map(d => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">Duration</label>
                    <input
                      type="text"
                      placeholder="e.g. 1 Day, 3 Days / 2 Nights"
                      value={serviceForm.duration}
                      onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {serviceForm.category === 'guide' && (
                  <div className="grid grid-cols-2 gap-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                    <div>
                      <label className="block text-slate-400 uppercase tracking-wider mb-1">Languages spoken</label>
                      <input value={serviceForm.guideLanguages} onChange={(e) => setServiceForm({ ...serviceForm, guideLanguages: e.target.value })} placeholder="Hindi, English, Santhali" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
                    </div>
                    <div>
                      <label className="block text-slate-400 uppercase tracking-wider mb-1">Guide experience</label>
                      <input value={serviceForm.guideExperience} onChange={(e) => setServiceForm({ ...serviceForm, guideExperience: e.target.value })} placeholder="e.g. 5 years" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
                    </div>
                  </div>
                )}

                <div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 uppercase tracking-wider mb-1">Starting destination *</label>
                      <select required value={serviceForm.startingLocation} onChange={(e) => setServiceForm({ ...serviceForm, startingLocation: e.target.value })} className="w-full rounded-xl bg-[#070b14] border border-slate-700 px-3 py-2 text-slate-100">
                        <option value="">Select starting district</option>
                        {jharkhandDistricts.map((district) => <option key={`start-${district}`}>{district}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 uppercase tracking-wider mb-1">Final destination district *</label>
                      <select required value={serviceForm.destination} onChange={(e) => setServiceForm({ ...serviceForm, destination: e.target.value })} className="w-full rounded-xl bg-[#070b14] border border-slate-700 px-3 py-2 text-slate-100">
                        <option value="">Select destination district</option>
                        {jharkhandDistricts.map((district) => <option key={`final-${district}`}>{district}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                    placeholder="Detail meeting point, inclusions, meal options, and language fluency..."
                    className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  {serviceForm.category === 'guide' ? (
                    <>
                      <label className="block text-slate-400 uppercase tracking-wider mb-2">Guide traits</label>
                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700 bg-[#070b14] p-3 md:grid-cols-3">
                        {['Friendly', 'Local expert', 'Storyteller', 'Nature specialist', 'Wildlife expert', 'Family friendly', 'Punctual', 'Multilingual'].map((trait) => (
                          <label key={trait} className="flex items-center gap-2 text-xs text-slate-300">
                            <input type="checkbox" checked={serviceForm.guideTraits.includes(trait)} onChange={(e) => setServiceForm({ ...serviceForm, guideTraits: e.target.checked ? [...serviceForm.guideTraits, trait] : serviceForm.guideTraits.filter((item) => item !== trait) })} />
                            {trait}
                          </label>
                        ))}
                      </div>
                    </>
                  ) : serviceForm.category !== 'package' ? (
                    <>
                      <label className="block text-slate-400 uppercase tracking-wider mb-2">Amenities / inclusions</label>
                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700 bg-[#070b14] p-3 md:grid-cols-3">
                        {(serviceForm.category === 'restaurant' ? ['Local cuisine', 'Vegetarian options', 'Non-vegetarian options', 'Jain food', 'Tribal cuisine', 'Breakfast', 'Outdoor seating', 'Family friendly', 'Parking', 'Wi-Fi', 'Home delivery'] : ['Breakfast', 'Local transfers', 'Certified guide', 'Nature trail', 'Safari coordination', 'Wi-Fi', 'Parking', 'Family friendly']).map((amenity) => (
                          <label key={amenity} className="flex items-center gap-2 text-xs text-slate-300">
                            <input type="checkbox" checked={serviceForm.amenities.includes(amenity)} onChange={(e) => setServiceForm({ ...serviceForm, amenities: e.target.checked ? [...serviceForm.amenities, amenity] : serviceForm.amenities.filter((item) => item !== amenity) })} />
                            {amenity}
                          </label>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="text-slate-400">Available from<input type="date" value={serviceForm.availableFrom} onChange={(e) => setServiceForm({ ...serviceForm, availableFrom: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100" /></label>
                  <label className="text-slate-400">Available to<input type="date" min={serviceForm.availableFrom || undefined} value={serviceForm.availableTo} onChange={(e) => setServiceForm({ ...serviceForm, availableTo: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100" /></label>
                </div>
                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Maximum group size *</label>
                  <input required type="number" min="1" value={serviceForm.maxGroupSize} onChange={(e) => setServiceForm({ ...serviceForm, maxGroupSize: e.target.value })} placeholder="e.g. 12" className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100" />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">{serviceForm.category === 'guide' ? 'Guide image' : 'Tour package image'}</label>
                  <input type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0], (image) => setServiceForm({ ...serviceForm, image }))} className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:font-semibold file:text-slate-950" />
                  {serviceForm.image && <img src={serviceForm.image} alt={serviceForm.category === 'guide' ? 'Guide preview' : 'Tour package preview'} className="mt-3 h-28 w-full rounded-xl object-cover" />}
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={serviceSubmitting}
                    className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl uppercase tracking-wider transition"
                  >
                    {serviceSubmitting ? 'Saving...' : 'Add Service Package'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsServiceModalOpen(false)}
                    className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl uppercase font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
