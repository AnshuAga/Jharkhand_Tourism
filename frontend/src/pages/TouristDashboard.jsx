import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getProfileInterests } from '../utils/profileInterests';
import { io } from 'socket.io-client';
import { 
  Compass, 
  ShieldCheck, 
  Sparkles, 
  Calendar, 
  Wallet, 
  CheckCircle2, 
  Clock, 
  Star, 
  Send, 
  Navigation, 
  Eye, 
  Bus,
  Lock,
  Heart,
  ClipboardList,
  Sliders,
  Check,
  AlertTriangle,
  ShieldAlert,
  TrainFront,
  X,
  Trash2
} from 'lucide-react';

const TOURIST_INTERESTS = [
  ['nature', 'Nature & waterfalls'],
  ['wildlife', 'Wildlife & safaris'],
  ['culture', 'Tribal culture & crafts'],
  ['spiritual', 'Spiritual heritage'],
  ['adventure', 'Adventure & trekking'],
  ['food', 'Local food'],
  ['photography', 'Photography']
];

const interestLabels = Object.fromEntries(TOURIST_INTERESTS);

export default function TouristDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Review submission state
  const [selectedDestId, setSelectedDestId] = useState('');
  const [reviewBooking, setReviewBooking] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [sentimentResult, setSentimentResult] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState('');
  const [deletingReviewId, setDeletingReviewId] = useState(null);

  // Preferences update state
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false);
  const [prefForm, setPrefForm] = useState({
    budget: 25000,
    travelDuration: 4,
    startingLocation: 'Ranchi',
    groupType: 'family',
    interests: []
  });
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSavedMsg, setPrefSavedMsg] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [liveVehicles, setLiveVehicles] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [dismissedAlertId, setDismissedAlertId] = useState(null);
  const [recommendationData, setRecommendationData] = useState(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [completionCandidate, setCompletionCandidate] = useState(null);
  const [completionSaving, setCompletionSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, destRes] = await Promise.all([
        api.tourist.getDashboard(),
        api.destinations.getAll()
      ]);

      if (dashRes && dashRes.success) {
        setDashboardData(dashRes);
        setProfileForm({
          name: dashRes.tourist?.name || user?.name || '',
          phone: dashRes.tourist?.phone || user?.phone || ''
        });
        if (dashRes.tourist?.preferences) {
          setPrefForm({
            budget: dashRes.tourist.preferences.budget || 25000,
            travelDuration: dashRes.tourist.preferences.travel_duration || 4,
            startingLocation: dashRes.tourist.preferences.starting_location || 'Ranchi',
            groupType: dashRes.tourist.preferences.group_type || 'family',
            interests: getProfileInterests(dashRes)
          });
        }
      }

      if (destRes && destRes.success && Array.isArray(destRes.data)) {
        setDestinations(destRes.data);
        if (destRes.data.length > 0 && !selectedDestId) {
          setSelectedDestId(destRes.data[0].id);
        }
      }
      const savedPreferences = dashRes?.tourist?.preferences || {};
      if (dashRes?.personalizedRecommendations?.success) {
        setRecommendationData(dashRes.personalizedRecommendations);
      } else {
        setRecommendationLoading(true);
        try {
          const recommendationRes = await api.recommendations.get({
            budget: savedPreferences.budget,
            travelDuration: savedPreferences.travel_duration,
            interests: savedPreferences.interests,
            groupType: savedPreferences.group_type,
            startingLocation: savedPreferences.starting_location,
            limit: 6
          });
          setRecommendationData(recommendationRes);
        } catch (recommendationError) {
          console.warn('Recommendation lookup failed:', recommendationError);
          setRecommendationData(null);
        } finally {
          setRecommendationLoading(false);
        }
      }
      const [vehicleRes, alertRes] = await Promise.all([
        api.transport.getLiveVehicles().catch(() => ({ vehicles: [] })),
        api.transport.getAlerts().catch(() => ({ alerts: [] }))
      ]);
      setLiveVehicles(vehicleRes?.vehicles || []);
      // Quality flags contain internal review diagnostics for administrators,
      // not public travel advisories for tourists.
      setAlerts((alertRes?.alerts || []).filter((alert) => alert.type !== 'Quality Flag'));
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const socket = io();
    const updateVehicles = (vehicles) => setLiveVehicles(Array.isArray(vehicles) ? vehicles : []);
    socket.on('transport:vehicles', updateVehicles);
    const poll = setInterval(() => {
      api.transport.getLiveVehicles().then((res) => updateVehicles(res.vehicles)).catch(() => {});
    }, 5000);
    return () => {
      clearInterval(poll);
      socket.disconnect();
    };
  }, []);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewText.trim() || (!selectedDestId && !reviewBooking)) return;
    setReviewSubmitting(true);
    setReviewSuccessMsg('');
    try {
      const destObj = destinations.find(d => d.id === selectedDestId);
      const res = await api.sentiment.submitReview(reviewBooking ? (
        ['package', 'guide', 'homestay', 'restaurant', 'transport'].includes(reviewBooking.item_type) ? {
        bookingId: reviewBooking.id,
        serviceId: reviewBooking.item_id,
        serviceName: reviewBooking.item_title,
        rating,
        reviewText
      } : {
        bookingId: reviewBooking.id,
        productId: reviewBooking.item_id,
        productName: reviewBooking.item_title,
        rating,
        reviewText
      }) : {
        targetType: 'destination',
        targetId: selectedDestId,
        destinationId: selectedDestId,
        destinationName: destObj ? destObj.name : 'Jharkhand Destination',
        rating,
        reviewText
      });
      setSentimentResult(res);
      setReviewText('');
      setReviewBooking(null);
      setReviewSuccessMsg('Your review was analyzed and added to the official sentiment ledger!');
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (review) => {
    if (!window.confirm('Delete this review permanently? This cannot be undone.')) return;
    setDeletingReviewId(review.id);
    try {
      await api.sentiment.deleteReview(review.id);
      setDashboardData((current) => current ? {
        ...current,
        reviews: (current.reviews || []).filter((item) => item.id !== review.id),
        stats: {
          ...current.stats,
          reviewsSubmitted: Math.max(0, Number(current.stats?.reviewsSubmitted || 0) - 1)
        }
      } : current);
      setReviewSuccessMsg('Your review was deleted successfully.');
    } catch (error) {
      alert(error.message);
    } finally {
      setDeletingReviewId(null);
    }
  };

  const handleUpdatePreferences = async (e) => {
    e.preventDefault();
    setPrefSaving(true);
    try {
      await api.tourist.updatePreferences(prefForm);
      setPrefSavedMsg('Travel preferences saved! Recommended itineraries updated.');
      setIsPrefModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setPrefSaving(false);
    }
  };

  const handleCompleteBooking = async () => {
    if (!completionCandidate) return;
    setCompletionSaving(true);
    try {
      await api.tourist.completeBooking(completionCandidate.id);
      setCompletionCandidate(null);
      await loadData();
    } catch (error) {
      alert(error.message);
    } finally {
      setCompletionSaving(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage('');
    try {
      const response = await api.auth.updateProfile(profileForm);
      localStorage.setItem('jharkhand_user', JSON.stringify(response.user));
      setProfileMessage('Profile details updated successfully.');
      await loadData();
    } catch (err) {
      setProfileMessage(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setProfileMessage('New passwords do not match.');
      setProfileSaving(false);
      return;
    }
    try {
      await api.auth.changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setProfileMessage('Password changed successfully.');
    } catch (err) {
      setProfileMessage(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const stats = dashboardData?.stats || {
    activeTrips: 0,
    completedTrips: 0,
    totalSpent: 0,
    reviewsSubmitted: 0,
    savedCount: 0
  };

  const bookings = dashboardData?.bookings || [];
  const activeBookings = bookings.filter((booking) => booking.status !== 'completed');
  const completedBookings = bookings.filter((booking) => booking.status === 'completed');
  const today = new Date().toISOString().slice(0, 10);
  const reviews = dashboardData?.reviews || [];
  const recommendations = dashboardData?.recommendations || [];
  const preferences = dashboardData?.tourist?.preferences || {};
  const interests = getProfileInterests(preferences);
  const savedDestinationIds = new Set(
    (dashboardData?.favourites || [])
      .filter((favourite) => favourite.target_type === 'destination')
      .map((favourite) => String(favourite.target_id))
  );
  const savedDestinations = destinations.filter((destination) => savedDestinationIds.has(String(destination.id)));
  const visibleAlert = alerts.find((alert) => alert.id !== dismissedAlertId);
  const alertTone = visibleAlert?.severity === 'Alert'
    ? {
      icon: 'border-[#b64e32]/40 bg-[#b64e32]/15 text-[#e7a38f]',
      badge: 'border-[#b64e32]/45 bg-[#b64e32]/15 text-[#e7a38f]',
      accent: 'bg-[#b64e32]'
    }
    : visibleAlert?.severity === 'Warning'
      ? {
        icon: 'border-[#987448]/50 bg-[#987448]/15 text-[#e7d1b0]',
        badge: 'border-[#987448]/50 bg-[#987448]/15 text-[#e7d1b0]',
        accent: 'bg-[#987448]'
      }
      : {
        icon: 'border-[#e7d1b0]/35 bg-[#e7d1b0]/10 text-[#e7d1b0]',
        badge: 'border-[#e7d1b0]/35 bg-[#e7d1b0]/10 text-[#e7d1b0]',
        accent: 'bg-[#e7d1b0]'
      };
  const plannerPreferences = {
    days: preferences.travel_duration || 4,
    budget: preferences.budget || 25000,
    travelers: preferences.group_size || 2,
    startCity: preferences.starting_location || 'Ranchi',
    interests
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pt-32 pb-24 px-6 md:px-16 selection:bg-amber-500 selection:text-slate-950 font-sans">
      {visibleAlert && (
        <aside
          className="fixed top-24 left-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-[#987448]/55 bg-[#292725] p-5 shadow-2xl shadow-black/40"
          role="alert"
          aria-live="assertive"
        >
          <div className={`absolute inset-x-0 top-0 h-1 ${alertTone.accent}`} />
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${alertTone.icon}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e7d1b0]">
                  {visibleAlert.type || 'Travel Advisory'}
                </span>
                {visibleAlert.severity && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${alertTone.badge}`}>
                    {visibleAlert.severity}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-lg font-serif font-bold text-[#f8f1e7]">{visibleAlert.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#e7d1b0]">{visibleAlert.message}</p>
              {visibleAlert.location && (
                <p className="mt-2 text-xs font-semibold text-[#f8f1e7]">Location: {visibleAlert.location}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDismissedAlertId(visibleAlert.id)}
              aria-label="Dismiss travel advisory"
              className="rounded-lg p-1 text-[#e7d1b0]/70 transition hover:bg-[#3b3733] hover:text-[#f8f1e7]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </aside>
      )}
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold uppercase tracking-widest mb-3">
              <Compass size={14} />
              Tourist Traveler Portal
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold">
              Welcome, {user?.name || dashboardData?.tourist?.name || 'Explorer'}
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Your personalized itinerary, blockchain escrow transactions, and eco-tourism controls.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="#bookings"
              className="inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-amber-400/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-400 hover:text-slate-950 transition"
            >
              <ClipboardList size={15} />
              My Orders
            </Link>
            <button
              onClick={() => { setProfileMessage(''); setIsProfileModalOpen(true); }}
              className="px-4 py-2.5 rounded-full bg-slate-900 border border-slate-700 text-slate-200 font-semibold text-xs uppercase tracking-wider hover:border-amber-400 transition"
            >
              Profile & Security
            </button>
            <button
              onClick={() => setIsPrefModalOpen(true)}
              className="px-4 py-2.5 rounded-full bg-slate-900 border border-slate-700 text-slate-200 font-semibold text-xs uppercase tracking-wider hover:border-amber-400 transition flex items-center gap-2"
            >
              <Sliders size={14} />
              Travel Profile
            </button>
            <Link
              to="/ai-planner"
              state={{ plannerPreferences }}
              className="px-5 py-2.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition flex items-center gap-2 shadow-lg shadow-amber-400/20"
            >
              <Sparkles size={15} />
              AI Itinerary Planner
            </Link>
            <Link
              to="/transport"
              className="px-5 py-2.5 rounded-full bg-slate-900 border border-slate-700 text-slate-200 font-semibold text-xs uppercase tracking-wider hover:border-amber-400 transition flex items-center gap-2"
            >
              <Bus size={15} />
              Live Transit Fleet
            </Link>
          </div>
        </div>

        {prefSavedMsg && (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-semibold flex items-center justify-between">
            <span>{prefSavedMsg}</span>
            <button onClick={() => setPrefSavedMsg('')} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            ['Explore Destinations', '/destinations', Compass],
            ['Plan Trip', '/ai-planner', Sparkles],
            ['Saved Places', '#saved-places', Heart],
            ['My Orders', '#bookings', ClipboardList],
            ['Safety Center', '#safety-center', ShieldAlert],
            ['Live Transit', '/transport', Bus]
          ].map(([label, href, Icon]) => href.startsWith('#') ? <a key={label} href={href} className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#0b1326] px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:border-amber-400 hover:text-white"><Icon size={14} />{label}</a> : <Link key={label} to={href} className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#0b1326] px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:border-amber-400 hover:text-white"><Icon size={14} />{label}</Link>)}
        </div>

        {/* Real KPI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-6 rounded-2xl bg-[#0b1326] border border-slate-800">
            <div className="text-amber-400 text-xs uppercase tracking-widest mb-2 font-semibold">Active Trips</div>
            <div className="text-3xl font-serif font-bold text-white">
              {stats.activeTrips}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Confirmed bookings</span>
          </div>

          <div className="p-6 rounded-2xl bg-[#0b1326] border border-slate-800">
            <div className="text-amber-400 text-xs uppercase tracking-widest mb-2 font-semibold">Completed Trips</div>
            <div className="text-3xl font-serif font-bold text-white">
              {stats.completedTrips}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Archived journeys</span>
          </div>

          <div className="p-6 rounded-2xl bg-[#0b1326] border border-slate-800">
            <div className="text-amber-400 text-xs uppercase tracking-widest mb-2 font-semibold">Saved Places</div>
            <div className="text-3xl font-serif font-bold text-white">
              {stats.savedCount}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Synced to your account</span>
          </div>

          <div className="p-6 rounded-2xl bg-[#0b1326] border border-slate-800">
            <div className="text-amber-400 text-xs uppercase tracking-widest mb-2 font-semibold">Reviews Contributed</div>
            <div className="text-3xl font-serif font-bold text-white">
              {stats.reviewsSubmitted}
            </div>
            <span className="text-[10px] text-emerald-400 mt-1 block">NLP ABSA verified</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.4fr_0.6fr] gap-6">
          <section className="planner-profile-card rounded-3xl p-6 md:p-8">
            <div className="planner-profile-header">
              <div className="min-w-0">
                <span className="text-xs uppercase tracking-[0.2em] text-amber-400 font-bold">AI Trip Planner</span>
                <h2 className="mt-2 text-2xl font-serif font-bold md:text-3xl">Plan Your Jharkhand Journey</h2>
                <p className="mt-2 text-sm text-slate-400">Use your saved travel profile and let BirsaAI build a feasible route.</p>
              </div>
              <Link to="/ai-planner" state={{ plannerPreferences }} className="planner-profile-action inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-wider">
                <Sparkles size={15} /> Create My Itinerary
              </Link>
            </div>
            <div className="planner-profile-summary mt-7">
              {[
                ['Days', preferences.travel_duration || '—'],
                ['Budget', preferences.budget ? `₹${Number(preferences.budget).toLocaleString('en-IN')}` : '—'],
                ['Travelers', preferences.group_size || '—'],
                ['Starting', preferences.starting_location || '—'],
                ['Interests', interests.length ? interests.slice(0, 2).join(', ') : 'Not set']
              ].map(([label, value]) => <div key={label} className="planner-profile-stat rounded-xl p-3"><span className="block text-[10px] uppercase tracking-widest text-slate-500">{label}</span><span className="mt-1 block truncate text-sm font-semibold text-white">{value}</span></div>)}
            </div>
            <div className="mt-5 border-t border-slate-700/60 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Travel interests</span>
                <button
                  type="button"
                  onClick={() => setIsPrefModalOpen(true)}
                  className="text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white"
                >
                  Edit profile
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {interests.length ? interests.map((interest) => (
                  <span key={interest} className="rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1.5 text-[10px] font-semibold text-amber-100">
                    {interestLabels[interest] || interest}
                  </span>
                )) : (
                  <span className="text-xs text-slate-400">No interests selected yet.</span>
                )}
              </div>
            </div>
          </section>
          <section id="saved-places" className="rounded-3xl border border-slate-800 bg-[#0b1326] p-6 scroll-mt-32">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs uppercase tracking-[0.2em] text-amber-400 font-bold">Saved Destinations</span>
                <h2 className="text-xl font-serif font-bold mt-1">Places you want to explore</h2>
              </div>
              <a href="#review-section" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:border-amber-400 hover:text-white">
                <Star size={13} /> Submit Review
              </a>
            </div>
            {savedDestinations.length ? (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedDestinations.map((destination) => (
                  <div key={destination.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <h3 className="text-sm font-bold text-white">{destination.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{destination.district || 'Jharkhand'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-500">No destinations saved yet. Save places while exploring destinations to see them here.</p>
            )}
          </section>
          <section className="rounded-3xl border border-slate-800 bg-[#0b1326] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">BirsaAI recommendations</span>
                <h2 className="mt-2 text-xl font-serif font-bold text-white">Picked for your profile</h2>
              </div>
              <Sparkles className="mt-1 text-amber-300" size={18} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Ranked from active destinations, available experiences, marketplace stock, ratings, and stored review sentiment.
            </p>
            {recommendationLoading ? (
              <div className="mt-5 space-y-3" aria-live="polite">
                {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-800/70" />)}
              </div>
            ) : recommendationData?.recommendations?.length ? (
              <div className="mt-5 space-y-3">
                {recommendationData.recommendations.slice(0, 4).map((recommendation) => (
                  <div key={`${recommendation.type}-${recommendation.id}`} className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{recommendation.name}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{recommendation.reasons[0]}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-200">
                        {recommendation.score}%
                      </span>
                    </div>
                    <Link
                      to={recommendation.type === 'destination' ? '/destinations' : '/marketplace'}
                      onClick={() => api.recommendations.interact({
                        recommendationId: recommendation.id,
                        recommendationType: recommendation.type,
                        action: 'view'
                      }).catch(() => {})}
                      className="mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:text-white"
                    >
                      Explore related listings
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-4 text-xs text-slate-400">
                Recommendations will appear when active catalogue items are available.
              </p>
            )}
          </section>
        </div>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-slate-800 bg-[#0b1326] p-6">
            <div className="flex items-center justify-between"><div className="flex items-center gap-3"><TrainFront className="text-amber-400" size={20} /><div><span className="text-xs uppercase tracking-[0.2em] text-amber-400 font-bold">Live Transit Fleet</span><h2 className="text-xl font-serif font-bold mt-1">Current transport status</h2></div></div><Link to="/transport" className="text-xs text-amber-400 hover:underline">Open fleet →</Link></div>
            {liveVehicles.length ? <div className="mt-5 space-y-3">{liveVehicles.slice(0, 3).map((vehicle) => <div key={vehicle.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div><p className="text-sm font-semibold text-white">{vehicle.name || vehicle.plate || 'Transit vehicle'}</p><p className="text-[10px] text-slate-500">{vehicle.route || 'Route unavailable'}</p></div><span className="text-[10px] uppercase text-emerald-400">{vehicle.status || 'active'}{vehicle.eta ? ` · ${vehicle.eta}` : ''}</span></div>)}</div> : <div className="mt-5 rounded-xl border border-slate-800 p-5 text-sm text-slate-500">Live transit data is currently unavailable.</div>}
          </div>
          <div id="safety-center" className="rounded-3xl border border-amber-400/20 bg-[#0b1326] p-6 scroll-mt-32">
            <div className="flex items-center gap-3"><ShieldAlert className="text-amber-400" size={20} /><div><span className="text-xs uppercase tracking-[0.2em] text-amber-400 font-bold">Tourist Safety</span><h2 className="text-xl font-serif font-bold mt-1">Travel with confidence</h2></div></div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-slate-950/50 p-3"><span className="text-slate-500">Emergency</span><strong className="mt-1 block text-white">112</strong></div><div className="rounded-xl bg-slate-950/50 p-3"><span className="text-slate-500">Tourist help</span><strong className="mt-1 block text-white">1363</strong></div><div className="rounded-xl bg-slate-950/50 p-3"><span className="text-slate-500">Police</span><strong className="mt-1 block text-white">100</strong></div><div className="rounded-xl bg-slate-950/50 p-3"><span className="text-slate-500">Hospitals</span><strong className="mt-1 block text-white">108</strong></div></div>
            <div className="mt-4 rounded-xl border border-slate-800 p-3 text-xs text-slate-400">{alerts.length ? <><AlertTriangle size={14} className="mr-2 inline text-amber-400" />{alerts[0].title}: {alerts[0].message}</> : 'No active travel alerts are currently published.'}</div>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-800/40 bg-emerald-950/10 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div className="flex items-center gap-3"><ShieldCheck className="text-emerald-400" size={24} /><div><span className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-bold">Blockchain-Secured Tourism</span><h2 className="text-2xl font-serif font-bold mt-1">Booking protection and escrow status</h2></div></div><Link to="/verify" className="text-xs font-bold uppercase tracking-wider text-emerald-400 hover:underline">Verify ledger →</Link></div>
          <div className="mt-6 grid md:grid-cols-3 gap-3"><div className="rounded-xl border border-emerald-900/50 bg-slate-950/40 p-4"><span className="text-xs text-slate-500">Smart Contract Escrows</span><strong className="mt-2 block text-lg text-emerald-400">{bookings.filter((booking) => booking.escrow_status === 'locked').length} protected</strong></div><div className="rounded-xl border border-emerald-900/50 bg-slate-950/40 p-4"><span className="text-xs text-slate-500">Booking protection</span><strong className="mt-2 block text-lg text-white">Escrow enabled</strong></div><div className="rounded-xl border border-emerald-900/50 bg-slate-950/40 p-4"><span className="text-xs text-slate-500">Transaction status</span><strong className="mt-2 block text-lg text-white">{bookings.length ? 'Recorded' : 'No transactions'}</strong></div></div>
        </section>

        {/* Section: My Bookings & Blockchain Escrow */}
        <div id="bookings" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-serif font-bold">My Escrow-Secured Bookings</h2>
              <p className="text-xs text-slate-400 mt-1">
                Monetary funds remain safely anchored in smart contract escrow until tour completion or delivery confirmation.
              </p>
            </div>
            <Link to="/marketplace" className="text-xs text-amber-400 uppercase tracking-widest font-semibold hover:underline">
              Explore Marketplace →
            </Link>
          </div>

          {activeBookings.length === 0 ? (
            <div className="p-12 rounded-3xl bg-[#0b1326] border border-slate-800 text-center space-y-4">
              <Wallet className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-lg font-serif text-slate-200">No Active Bookings Available</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                You haven't booked any experiences or purchased handcrafted items yet. Visit our authentic marketplace or book verified guides to start exploring Jharkhand!
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <Link
                  to="/destinations"
                  className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider"
                >
                  Browse Destinations
                </Link>
                <Link
                  to="/marketplace"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider hover:border-amber-400"
                >
                  Visit Marketplace
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeBookings.map((b) => (
                <div key={b.id} className="p-6 rounded-3xl bg-[#0b1326] border border-slate-800 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 block mb-1">{b.id}</span>
                      <h3 className="text-lg font-bold text-white">{b.item_title || b.title || 'Journey booking'}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Trip: {b.check_in_date || '—'} to {b.check_out_date || '—'}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                      b.escrow_status === 'released'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : b.escrow_status === 'refunded'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                    }`}>
                      {b.escrow_status === 'locked' && <Lock size={11} />}
                      {b.escrow_status || 'locked'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 font-mono text-[11px] space-y-1 text-slate-400">
                    <p className="truncate"><strong className="text-slate-300">Contract Tx:</strong> {b.contract_tx_hash || '0xOnChainSecured'}</p>
                    <p><strong className="text-slate-300">Status:</strong> <span className="capitalize text-emerald-400 font-semibold">{b.status}</span></p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest block">Total Amount</span>
                      <span className="text-lg font-bold text-amber-400">₹{(b.total_amount || 0).toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {b.status === 'confirmed' && b.check_out_date && String(b.check_out_date).slice(0, 10) <= today && (
                        <button
                          type="button"
                          onClick={() => setCompletionCandidate(b)}
                          className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-300 hover:border-emerald-300 transition"
                        >
                          Mark Trip as Completed
                        </button>
                      )}
                      <Link
                        to="/verify"
                        className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300 hover:border-amber-400 hover:text-white transition"
                      >
                        Audit Ledger
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-serif font-bold">Completed Trips</h2>
            <p className="text-xs text-slate-400 mt-1">Journeys you have confirmed as completed.</p>
          </div>
          {completedBookings.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0b1326] p-6 text-sm text-slate-500">No completed trips yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {completedBookings.map((booking) => (
                <div key={booking.id} className="p-6 rounded-3xl bg-[#0b1326] border border-emerald-800/40 space-y-3">
                  <span className="text-[10px] font-mono text-slate-400">{booking.id}</span>
                  <h3 className="text-lg font-bold text-white">{booking.item_title || booking.title || 'Completed journey'}</h3>
                  <p className="text-xs text-slate-400">Trip: {booking.check_in_date || '—'} to {booking.check_out_date || '—'}</p>
                  <p className="text-xs text-emerald-300">Completed: {booking.settled_at ? new Date(booking.settled_at).toLocaleString() : 'Recorded'}</p>
                  {['product', 'package', 'guide', 'homestay', 'restaurant', 'transport'].includes(booking.item_type) && (
                    <a
                      href="#review-section"
                      onClick={() => setReviewBooking(booking)}
                      className="inline-flex items-center rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-300 hover:border-amber-300"
                    >
                      Write a Review
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {completionCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-labelledby="completion-dialog-title">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0b1326] p-6 shadow-2xl">
              <h2 id="completion-dialog-title" className="text-xl font-serif font-bold text-white">Have you completed this journey?</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Confirming moves this journey into Completed Trips. This does not automatically submit a review.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setCompletionCandidate(null)} disabled={completionSaving} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500">
                  Cancel
                </button>
                <button type="button" onClick={handleCompleteBooking} disabled={completionSaving} className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-300">
                  {completionSaving ? 'Completing…' : 'Confirm Completion'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section: Real-Time Feedback & Sentiment Analysis Pipeline */}
        <div id="review-section" className="bg-[#0b1326] border border-slate-800 rounded-3xl p-8 space-y-6 scroll-mt-32">
          <div>
            <div className="inline-flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-widest mb-2">
              <Sparkles size={14} />
              AI Review & Sentiment Engine (VADER + ABSA)
            </div>
            <h2 className="text-2xl font-serif font-bold">{reviewBooking ? `Review ${reviewBooking.item_title}` : 'Submit Experience Feedback'}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {reviewBooking ? 'This review is linked to your completed product order and will be checked before publication.' : 'Your feedback is automatically evaluated for Aspect-Based Sentiment across 5 critical dimensions: Cleanliness, Hospitality, Transport, Food, and Safety.'}
            </p>
          </div>

          <form onSubmit={handleReviewSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">{reviewBooking ? 'Purchased product' : 'Destination'}</label>
              {reviewBooking ? (
                <div className="rounded-xl bg-[#070b14] border border-emerald-700/50 px-4 py-3 text-xs text-emerald-200">{reviewBooking.item_title}</div>
              ) : (
                <select
                  value={selectedDestId}
                  onChange={(e) => setSelectedDestId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                >
                  {destinations.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.district})</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">Rating</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
              >
                <option value={5}>⭐⭐⭐⭐⭐ (5.0 - Exceptional)</option>
                <option value={4}>⭐⭐⭐⭐ (4.0 - Very Good)</option>
                <option value={3}>⭐⭐⭐ (3.0 - Moderate)</option>
                <option value={2}>⭐⭐ (2.0 - Below Average)</option>
                <option value={1}>⭐ (1.0 - Poor)</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">Detailed Tourist Review</label>
              <textarea
                rows={3}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your thoughts regarding cleanliness, tribal hospitality, mountain roads, local food, or safety..."
                className="w-full px-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={reviewSubmitting}
                className="px-6 py-3 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition flex items-center gap-2"
              >
                <Send size={15} />
                {reviewSubmitting ? 'Evaluating NLP Sentiment...' : 'Analyze & Post Review'}
              </button>
            </div>
          </form>

          {reviewSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-semibold">
              {reviewSuccessMsg}
            </div>
          )}

          {sentimentResult && (
            <div className="p-6 rounded-2xl bg-[#070b14] border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">
                  NLP Aspect-Based Sentiment Scores
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  sentimentResult.review?.sentiment === 'Positive' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {sentimentResult.review?.sentiment || 'Evaluated'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {sentimentResult.review?.aspects && Object.entries(sentimentResult.review.aspects).map(([aspect, sentiment]) => {
                  const label = aspectSentimentLabel(sentiment);
                  return (
                  <div key={aspect} className="p-3 rounded-xl bg-[#0b1326] border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 block capitalize">{aspect}</span>
                    <span className={`text-sm font-bold ${label === 'Negative' ? 'text-rose-300' : label === 'Positive' ? 'text-emerald-300' : 'text-slate-300'}`}>{label}</span>
                  </div>
                  );
                })}
              </div>
              {(!sentimentResult.review?.aspects || Object.keys(sentimentResult.review.aspects).length === 0) && (
                <p className="text-xs text-slate-500">No specific aspects detected.</p>
              )}
            </div>
          )}
        </div>

        {/* Section: My Past Reviews */}
        <div className="space-y-4">
            <h2 className="text-2xl font-serif font-bold">My Submitted Reviews ({reviews.length})</h2>
            {reviews.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-700 bg-[#0b1326] p-10 text-center text-sm text-slate-500">No reviews contributed yet. After a completed experience, your rating and review will appear here.</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.map((rev) => {
                const aspects = rev.aspects ? (typeof rev.aspects === 'string' ? JSON.parse(rev.aspects) : rev.aspects) : {};
                return (
                  <div key={rev.id} className="p-6 rounded-3xl bg-[#0b1326] border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-white text-base">{rev.target_id}</h4>
                        <span className="text-[10px] text-slate-500">{new Date(rev.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-amber-400 font-bold text-sm flex items-center gap-1">
                          <Star size={14} className="fill-amber-400" />
                          {rev.rating} ★
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(rev)}
                          disabled={deletingReviewId === rev.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-800/70 px-2 py-1.5 text-[10px] font-semibold text-rose-300 hover:bg-rose-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Delete review for ${rev.target_id}`}
                        >
                          <Trash2 size={13} />
                          {deletingReviewId === rev.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 italic">"{rev.review_text || rev.comment || ''}"</p>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-400">
                      {Object.entries(aspects).map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                          {k}: <strong className={aspectSentimentLabel(v) === 'Negative' ? 'text-rose-300' : aspectSentimentLabel(v) === 'Positive' ? 'text-emerald-300' : 'text-slate-300'}>{aspectSentimentLabel(v)}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>

        {/* Modal: Edit Travel Preferences */}
        {isPrefModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0b1326] border border-slate-700 rounded-3xl max-w-md w-full p-6 md:p-8 space-y-6 text-slate-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-xl font-serif font-bold text-white">Traveler Preferences</h3>
                <button onClick={() => setIsPrefModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleUpdatePreferences} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Trip Budget (₹)</label>
                  <input
                    type="number"
                    value={prefForm.budget}
                    onChange={(e) => setPrefForm({ ...prefForm, budget: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Travel Duration (Days)</label>
                  <input
                    type="number"
                    value={prefForm.travelDuration}
                    onChange={(e) => setPrefForm({ ...prefForm, travelDuration: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Starting City</label>
                  <input
                    type="text"
                    value={prefForm.startingLocation}
                    onChange={(e) => setPrefForm({ ...prefForm, startingLocation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">Group Type</label>
                  <select
                    value={prefForm.groupType}
                    onChange={(e) => setPrefForm({ ...prefForm, groupType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100"
                  >
                    <option value="solo">Solo Traveler</option>
                    <option value="couple">Couple</option>
                    <option value="family">Family</option>
                    <option value="group">Group</option>
                    <option>Adventure Friends</option>
                  </select>
                </div>

                <fieldset>
                  <legend className="mb-2 block text-slate-400 uppercase tracking-wider">Travel interests</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {TOURIST_INTERESTS.map(([value, label]) => {
                      const selected = prefForm.interests.includes(value);
                      return (
                        <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition ${selected ? 'border-amber-400/70 bg-amber-400/10 text-amber-200' : 'border-slate-700 bg-[#070b14] text-slate-400 hover:border-slate-600'}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => setPrefForm((previous) => ({
                              ...previous,
                              interests: selected
                                ? previous.interests.filter((interest) => interest !== value)
                                : [...previous.interests, value]
                            }))}
                            className="accent-amber-400"
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500">Choose one or more interests to personalize recommendations.</p>
                </fieldset>

                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={prefSaving}
                    className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl uppercase tracking-wider transition"
                  >
                    {prefSaving ? 'Saving...' : 'Update Preferences'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrefModalOpen(false)}
                    className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl uppercase font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
            <div className="my-8 w-full max-w-lg space-y-6 rounded-3xl border border-slate-700 bg-[#0b1326] p-6 text-slate-200 md:p-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div><h3 className="text-xl font-serif font-bold text-white">Profile & Security</h3><p className="mt-1 text-xs text-slate-500">Update your account details and password.</p></div>
                <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                <h4 className="text-amber-400 uppercase tracking-widest">Personal details</h4>
                <input required value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="Full name" className="w-full rounded-xl border border-slate-700 bg-[#070b14] px-3 py-3 text-slate-100" />
                <input value={user?.email || dashboardData?.tourist?.email || ''} readOnly className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-slate-500" />
                <input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="Phone number" className="w-full rounded-xl border border-slate-700 bg-[#070b14] px-3 py-3 text-slate-100" />
                <button disabled={profileSaving} className="w-full rounded-xl bg-amber-400 py-3 font-bold uppercase tracking-wider text-slate-950 disabled:opacity-60">Save profile</button>
              </form>

              <form onSubmit={handleChangePassword} className="space-y-4 border-t border-slate-800 pt-5 text-xs">
                <h4 className="text-amber-400 uppercase tracking-widest">Change password</h4>
                <input required type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} placeholder="Current password" className="w-full rounded-xl border border-slate-700 bg-[#070b14] px-3 py-3 text-slate-100" />
                <input required minLength="6" type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} placeholder="New password (minimum 6 characters)" className="w-full rounded-xl border border-slate-700 bg-[#070b14] px-3 py-3 text-slate-100" />
                <input required minLength="6" type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} placeholder="Confirm new password" className="w-full rounded-xl border border-slate-700 bg-[#070b14] px-3 py-3 text-slate-100" />
                <button disabled={profileSaving} className="w-full rounded-xl border border-slate-700 py-3 font-bold uppercase tracking-wider text-slate-200 hover:border-amber-400 disabled:opacity-60">Change password</button>
              </form>
              {profileMessage && <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-emerald-300">{profileMessage}</p>}
              <button onClick={() => setIsProfileModalOpen(false)} className="w-full rounded-xl bg-slate-800 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300">Close</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
const aspectSentimentLabel = (value) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (value >= 3.5) return 'Positive';
    if (value <= 2.5) return 'Negative';
    return 'Neutral';
  }
  return 'Unknown';
};
