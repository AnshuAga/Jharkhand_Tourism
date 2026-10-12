import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ArrowRight, Search, Filter, X, Clock, IndianRupee, Compass, Calendar, ExternalLink, CloudSun, Wind, Droplets, Heart, Star } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getProfileInterests } from '../utils/profileInterests';

import NetarhatPlateau from '../assets/Netarhat-Plateau.jpeg';
import BetlaNationalPark from '../assets/Betla-National-Park.jpg';
import HundruWaterfalls from '../assets/Hundru-Waterfalls.jpeg';
import DeogharShrines from '../assets/Deoghar-Shrines.jpg';
import ParasnathHills from '../assets/Parasnath-Hills.jpeg';
import JonhaFalls from '../assets/Jonha-Falls.jpeg';
import RajrappaTemple from '../assets/Chhinnamastika_Temple_Rajrappa.jpg';
import TenughatDam from '../assets/Tenughat-Dam.png';
import BhadrakaliTemple from '../assets/Bhadrakali-Temple.png';

function resolveImage(url, name = '') {
  if (!url) return NetarhatPlateau;
  if (url.startsWith('data:image/')) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) return url;
  if (url.includes('Netarhat') || name.includes('Netarhat')) return NetarhatPlateau;
  if (url.includes('Betla') || name.includes('Betla')) return BetlaNationalPark;
  if (url.includes('Hundru') || name.includes('Hundru')) return HundruWaterfalls;
  if (url.includes('Deoghar') || url.includes('Baidyanath') || name.includes('Deoghar') || name.includes('Baidyanath')) return DeogharShrines;
  if (url.includes('Parasnath') || url.includes('Shikharji') || name.includes('Parasnath')) return ParasnathHills;
  if (url.includes('Jonha') || name.includes('Jonha')) return JonhaFalls;
  if (url.includes('Chinmastika') || url.includes('Chhinnamastika') || name.includes('Rajrappa')) return RajrappaTemple;
  if (url.includes('Tenughat') || name.includes('Tenughat')) return TenughatDam;
  if (url.includes('Bhadrakali') || name.includes('Bhadrakali')) return BhadrakaliTemple;
  return NetarhatPlateau;
}

function getEntryFee(destination) {
  if (destination.entry_fee !== undefined && destination.entry_fee !== null && destination.entry_fee !== '') {
    return destination.entry_fee;
  }
  const ticketInfo = String(destination.ticket_info || '');
  const match = ticketInfo.match(/(?:₹|rs\.?|inr)\s*([\d,]+)/i);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

export default function Destinations() {
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedDest, setSelectedDest] = useState(null);
  const [destWeather, setDestWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [savedDestinationIds, setSavedDestinationIds] = useState(new Set());
  const [profileInterests, setProfileInterests] = useState([]);
  const [savingDestinationId, setSavingDestinationId] = useState('');
  const [recommendationMap, setRecommendationMap] = useState({});
  const [publicReviews, setPublicReviews] = useState(null);
  const [reviewQuery, setReviewQuery] = useState({ sort: 'newest', rating: '', page: 1 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  useEffect(() => {
    if (selectedDest) {
      setWeatherLoading(true);
      const queryCity = selectedDest.district || selectedDest.name || 'Ranchi';
      api.weather.get(queryCity)
        .then((data) => setDestWeather(data))
        .catch(() => setDestWeather(null))
        .finally(() => setWeatherLoading(false));
    } else {
      setDestWeather(null);
    }
  }, [selectedDest]);

  useEffect(() => {
    if (!selectedDest?.id) {
      setPublicReviews(null);
      return;
    }
    let active = true;
    setReviewsLoading(true);
    setReviewsError('');
    const params = new URLSearchParams({
      sort: reviewQuery.sort,
      page: String(reviewQuery.page),
      limit: '5'
    });
    if (reviewQuery.rating) params.set('rating', reviewQuery.rating);
    api.sentiment.getPublicReviews(selectedDest.id, params.toString())
      .then((response) => { if (active) setPublicReviews(response); })
      .catch((error) => { if (active) setReviewsError(error.message); })
      .finally(() => { if (active) setReviewsLoading(false); });
    return () => { active = false; };
  }, [selectedDest, reviewQuery]);

  useEffect(() => {
  }, [selectedDest]);

  const fetchDestinations = async (overrides = {}) => {
    setLoading(true);
    setError('');
    try {
      const activeSearch = overrides.search !== undefined ? overrides.search : search;
      const activeDistrict = overrides.district !== undefined ? overrides.district : selectedDistrict;
      const activeCategory = overrides.category !== undefined ? overrides.category : selectedCategory;
      let queryParams = [];
      if (activeSearch.trim()) queryParams.push(`search=${encodeURIComponent(activeSearch.trim())}`);
      if (activeDistrict !== 'ALL') queryParams.push(`district=${encodeURIComponent(activeDistrict)}`);
      if (activeCategory !== 'ALL') queryParams.push(`category=${encodeURIComponent(activeCategory)}`);
      queryParams.push(`_ts=${Date.now()}`);
      const qs = `?${queryParams.join('&')}`;

      const res = await api.destinations.getAll(qs);
      if (res && res.success) {
        const loadedDestinations = Array.isArray(res.data) ? res.data : (res.destinations || []);
        setDestinations(loadedDestinations);
        const requestedDestination = searchParams.get('destination');
        if (requestedDestination) {
          const requestedLower = requestedDestination.toLowerCase();
          const destination = loadedDestinations.find((item) =>
            String(item.id).toLowerCase() === requestedLower
            || String(item.slug).toLowerCase() === requestedLower
            || String(item.name).toLowerCase() === requestedLower
          );
          if (destination) setSelectedDest(destination);
        }
      } else {
        setDestinations([]);
      }
    } catch (err) {
      console.error('Failed to fetch destinations:', err);
      setError(err.message || 'Unable to load destinations from the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, [selectedDistrict, selectedCategory]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.tourist.getDashboard().then((response) => {
      setSavedDestinationIds(new Set((response.favourites || [])
        .filter((item) => item.target_type === 'destination')
        .map((item) => item.target_id)));
      setProfileInterests(getProfileInterests(response));
    }).catch(() => {
      setSavedDestinationIds(new Set());
    });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!destinations.length) return;
    api.recommendations.get({ type: 'destinations', interests: profileInterests, limit: 12 })
      .then((response) => {
        setRecommendationMap(Object.fromEntries((response.recommendations || []).map((item) => [item.id, item])));
      })
      .catch(() => setRecommendationMap({}));
  }, [destinations, profileInterests]);

  const toggleSavedDestination = async (destination) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setSavingDestinationId(destination.id);
    try {
      const response = await api.tourist.toggleFavourite('destination', destination.id);
      setSavedDestinationIds((current) => {
        const next = new Set(current);
        if (response.saved) next.add(destination.id);
        else next.delete(destination.id);
        return next;
      });
    } finally {
      setSavingDestinationId('');
    }
  };

  const recommendedDestinations = destinations
    .filter((destination) => recommendationMap[destination.id])
    .sort((first, second) => {
      return (recommendationMap[second.id]?.score || 0) - (recommendationMap[first.id]?.score || 0);
    })
    .slice(0, 3);
  const topRatedDestinations = recommendedDestinations.filter((destination) => {
    const scored = recommendationMap[destination.id];
    return scored?.rating !== null && scored?.reviewCount >= 2;
  });
  const attributeRecommendations = recommendedDestinations.filter((destination) => !topRatedDestinations.includes(destination));

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDestinations();
  };


  const districts = [
    'ALL', 'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum',
    'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti',
    'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi',
    'Sahibganj', 'Seraikela-Kharsawan', 'Simdega', 'West Singhbhum'
  ];
  const categories = [
    'ALL', 'Hill Station', 'Wildlife & Safari', 'Wildlife & Eco', 'Waterfalls',
    'Waterfalls & Nature', 'Waterfalls & Adventure', 'Spiritual & Heritage',
    'Spiritual & Nature', 'Archaeology & Heritage', 'Heritage & History',
    'Eco-Tourism & Lakes', 'Lakes & Eco-Tourism', 'Lakes & Nature',
    'Dam & Eco-Tourism', 'Bird Sanctuary & Eco-Tourism', 'Forest & Eco-Tourism',
    'Eco-Tourism & Tribal Culture', 'Nature & Hills', 'Nature & Rural Tourism'
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pt-32 pb-24 px-6 md:px-16 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-amber-400 text-xs uppercase tracking-[0.3em] font-semibold">Geographical Portfolio</span>
          <h1 className="text-5xl md:text-6xl font-serif">Explore Iconic Destinations</h1>
          <p className="text-slate-300 font-light text-lg">
            Discover the untouched landscapes, roaring waterfalls, and sacred heights of Jharkhand loaded directly from the state registry.
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-[#0b1326] border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search by destination name, district, or attractions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#070b14] border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); fetchDestinations({ search: '' }); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="w-full md:w-auto px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-semibold rounded-xl text-xs uppercase tracking-wider transition-colors shrink-0"
            >
              Search
            </button>
          </form>

          {/* District Pills */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>Filter by District</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {districts.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDistrict(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedDistrict === d
                      ? 'bg-amber-400 text-slate-950 font-semibold shadow-lg shadow-amber-400/20'
                      : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {recommendedDestinations.length > 0 && (
          <section className="rounded-3xl border border-amber-400/20 bg-[#0b1326] p-6">
            <span className="text-xs uppercase tracking-[0.2em] text-amber-400 font-bold">Data-driven destination recommendations</span>
            <h2 className="mt-1 text-2xl font-serif font-bold">
              Discover Your Next Destination
            </h2>
            <p className="mt-2 text-sm text-slate-400">Recommendations combine destination characteristics, available visitor feedback, and {profileInterests.length ? 'your selected interests.' : 'catalogue attributes.'}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Profile interests</span>
              {profileInterests.length
                ? profileInterests.map((interest) => <span key={interest} className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase text-amber-300">{interest}</span>)
                : <span className="text-xs text-slate-500">No saved interests; using catalogue attributes.</span>}
            </div>
            {topRatedDestinations.length > 0 && (
              <>
                <h3 className="mt-6 text-lg font-serif font-bold text-white">Top Rated by Visitors</h3>
                <p className="mt-1 text-xs text-slate-500">Destinations with at least two eligible published ratings.</p>
              </>
            )}
            <div className="mt-5 grid md:grid-cols-3 gap-4">
              {topRatedDestinations.map((destination) => (
                <button key={destination.id} type="button" onClick={() => setSelectedDest(destination)} className="text-left rounded-2xl border border-slate-800 bg-slate-950/50 p-4 hover:border-amber-400/50">
                  <h3 className="font-bold text-white">{destination.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">{destination.district} · {destination.category}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recommendationMap[destination.id]?.rating !== null && <span className="text-[10px] font-bold uppercase text-amber-300">★ {recommendationMap[destination.id].rating.toFixed(1)} · {recommendationMap[destination.id].reviewCount} ratings</span>}
                    {recommendationMap[destination.id]?.sentiment && recommendationMap[destination.id].sentiment.analyzedReviewCount >= 2 && <span className="text-[10px] font-bold uppercase text-emerald-300">Visitor sentiment: {recommendationMap[destination.id].sentiment.label} · Based on {recommendationMap[destination.id].sentiment.analyzedReviewCount} analyzed reviews</span>}
                    <span className="text-[10px] font-bold uppercase text-emerald-400">
                      {destination.best_season ? `Best: ${destination.best_season}` : 'Season information unavailable'}
                    </span>
                    {recommendationMap[destination.id]?.matchingInterests?.length > 0 && <span className="text-[10px] font-bold uppercase text-amber-300">Interest match</span>}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{recommendationMap[destination.id]?.reasons?.[0] || 'Recommended from destination attributes'}</p>
                  <details className="mt-3 text-[11px] text-slate-400">
                    <summary className="cursor-pointer text-amber-300">Why this destination?</summary>
                    <div className="mt-2 space-y-1">
                      <p>Interest relevance: {recommendationMap[destination.id]?.interestMatchScore ?? 0}/100</p>
                      <p>Matched interests: {recommendationMap[destination.id]?.matchingInterests?.join(', ') || 'None'}</p>
                      <p>Visitor rating: {recommendationMap[destination.id]?.rating === null ? 'Not yet rated' : `${recommendationMap[destination.id].rating.toFixed(1)}/5`}</p>
                      <p>Eligible reviews: {recommendationMap[destination.id]?.reviewCount ?? 0}</p>
                      <p>Review evidence: {recommendationMap[destination.id]?.reviewEvidence || 'No eligible visitor reviews'}</p>
                      <p>Evidence coverage: {recommendationMap[destination.id]?.evidenceCoverage?.percentage ?? 0}% ({recommendationMap[destination.id]?.evidenceCoverage?.label || 'Unavailable'})</p>
                      <p>Score basis: {recommendationMap[destination.id]?.scoreBasis || 'Available evidence'}</p>
                      {recommendationMap[destination.id]?.factorBreakdown && Object.entries(recommendationMap[destination.id].factorBreakdown).map(([factor, detail]) => (
                        <p key={factor}>{factor}: {detail.available ? `${Math.round(detail.value * 100)}% · ${Math.round(detail.contribution * 100)}% contribution` : 'Unavailable; excluded'}</p>
                      ))}
                      {recommendationMap[destination.id]?.adjustedRating !== null && <p>Adjusted review signal: {recommendationMap[destination.id].adjustedRating.toFixed(2)}/5 (internal)</p>}
                      <p>Final recommendation score: {recommendationMap[destination.id]?.finalRecommendationScore ?? recommendationMap[destination.id]?.score ?? 0}/100</p>
                      <p>{recommendationMap[destination.id]?.rankingExplanation}</p>
                    </div>
                  </details>
                </button>
              ))}
            </div>
            {attributeRecommendations.length > 0 && (
              <>
                <h3 className="mt-8 text-lg font-serif font-bold text-white">Recommended Destinations</h3>
                <div className="mt-4 grid md:grid-cols-3 gap-4">
                  {attributeRecommendations.map((destination) => (
                    <button key={destination.id} type="button" onClick={() => setSelectedDest(destination)} className="text-left rounded-2xl border border-slate-800 bg-slate-950/50 p-4 hover:border-amber-400/50">
                      <h3 className="font-bold text-white">{destination.name}</h3>
                      <p className="mt-1 text-xs text-slate-400">{destination.district} · {destination.category}</p>
                      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{recommendationMap[destination.id]?.reasons?.[0] || 'Recommended from destination attributes'}</p>
                      {destination.best_season && <p className="mt-2 text-[10px] font-bold uppercase text-emerald-400">Best: {destination.best_season}</p>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* Content Section */}
        {loading ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400 text-sm tracking-wide">Querying Jharkhand State Destination Registry...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-red-950/20 border border-red-800/40 text-center space-y-4 max-w-xl mx-auto">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={fetchDestinations}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs uppercase tracking-wider text-slate-200"
            >
              Retry
            </button>
          </div>
        ) : destinations.length === 0 ? (
          <div className="py-24 text-center space-y-3 bg-[#0b1326] border border-slate-800/60 rounded-2xl p-12">
            <Compass className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-lg font-serif text-slate-300">No Destinations Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No tourism destinations matched your search filters. Try clearing your search keyword or selecting "ALL" districts.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedDistrict('ALL');
                setSelectedCategory('ALL');
                fetchDestinations({ search: '', district: 'ALL', category: 'ALL' });
              }}
              className="mt-4 px-4 py-2 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg uppercase tracking-wider"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {destinations.map((dest, idx) => {
              const scoredRecommendation = recommendationMap[dest.id];
              const activities = Array.isArray(dest.activities)
                ? dest.activities
                : (typeof dest.activities === 'string' ? JSON.parse(dest.activities || '[]') : []);

              return (
                <motion.div 
                  key={dest.id || idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                  className="rounded-2xl bg-[#0b1326] border border-slate-800 overflow-hidden group hover:border-amber-400/40 transition-all flex flex-col justify-between shadow-xl"
                >
                  <div>
                    <div className="aspect-16/10 overflow-hidden relative">
                      <img 
                        src={resolveImage(dest.image || dest.image_url, dest.name)} 
                        alt={dest.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                      />
                      <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-slate-700 text-amber-400 text-[10px] font-semibold uppercase tracking-wider">
                        {dest.tag || dest.category || 'Jharkhand Highlight'}
                      </div>
                      <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-slate-700 text-slate-300 text-[10px] font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400" />
                        <span>{dest.district}</span>
                      </div>
                      <button type="button" aria-label={`Save ${dest.name}`} onClick={() => toggleSavedDestination(dest)} disabled={savingDestinationId === dest.id} className={`absolute right-4 bottom-4 rounded-full p-2 backdrop-blur-md ${savedDestinationIds.has(dest.id) ? 'bg-rose-500 text-white' : 'bg-black/60 text-slate-200 hover:text-rose-300'}`}>
                        <Heart size={16} fill={savedDestinationIds.has(dest.id) ? 'currentColor' : 'none'} />
                      </button>
                      <div className="absolute bottom-4 left-4 rounded-full bg-slate-950/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/40">
                        {dest.best_season ? `Best: ${dest.best_season}` : 'Season information unavailable'}
                      </div>
                    </div>
                    <div className="p-6 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-xl font-serif text-slate-100 group-hover:text-amber-400 transition-colors">{dest.name}</h3>
                        {scoredRecommendation?.matchingInterests?.length > 0 && (
                          <span className="ml-2 shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-300">
                            Interest match
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {Number(dest.review_count || dest.reviewCount || 0) > 0 && <span className="text-amber-300">★ {Number(dest.rating).toFixed(1)}</span>}
                        {Number(dest.review_count || dest.reviewCount || 0) > 0 && <span>({dest.review_count || dest.reviewCount} reviews)</span>}
                        <span>· Best time: {dest.best_season || 'Seasonal visits'}</span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                        {scoredRecommendation?.sentiment && scoredRecommendation.sentiment.analyzedReviewCount >= 2 ? (
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="font-bold uppercase tracking-wider text-slate-500">Visitor sentiment</span>
                            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 font-bold text-emerald-300">{scoredRecommendation.sentiment.label}</span>
                            <span className="text-slate-500">{scoredRecommendation.reviewCount} analyzed review{scoredRecommendation.reviewCount === 1 ? '' : 's'}</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                            <span>{dest.category}</span>
                            {activities.slice(0, 2).map((activity) => <span key={activity} className="text-amber-300">{activity}</span>)}
                          </div>
                        )}
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{scoredRecommendation?.reasons?.[0] || 'Recommended from destination attributes'}</p>
                        {scoredRecommendation && (
                          <details className="mt-2 text-[11px] text-slate-400">
                            <summary className="cursor-pointer text-amber-300">Why this destination?</summary>
                            <div className="mt-2 space-y-1">
                              <p>Interest relevance: {scoredRecommendation.interestMatchScore}/100</p>
                              <p>Matched interests: {scoredRecommendation.matchingInterests?.join(', ') || 'None'}</p>
                              <p>Actual visitor rating: {scoredRecommendation.rating === null ? 'Not yet rated' : `${scoredRecommendation.rating.toFixed(1)}/5`}</p>
                              <p>Eligible reviews: {scoredRecommendation.reviewCount ? `${scoredRecommendation.reviewCount} eligible review${scoredRecommendation.reviewCount === 1 ? '' : 's'}` : 'No eligible visitor reviews available'}</p>
                              <p>Sentiment evidence: {scoredRecommendation.factorBreakdown?.sentiment?.available ? `${scoredRecommendation.sentiment?.label || 'Available'} · ${scoredRecommendation.analyzedReviewCount} analyzed` : 'Unavailable'}</p>
                              <p>Evidence coverage: {scoredRecommendation.evidenceCoverage?.percentage ?? 0}%</p>
                              <p>Recommendation score based on available evidence: {scoredRecommendation.finalRecommendationScore ?? scoredRecommendation.score}/100</p>
                              {scoredRecommendation.factorBreakdown && Object.entries(scoredRecommendation.factorBreakdown).map(([factor, detail]) => (
                                <p key={factor}>{factor}: {detail.available ? `${Math.round(detail.value * 100)}%` : 'Unavailable; excluded'}</p>
                              ))}
                              <p>{scoredRecommendation.rankingExplanation}</p>
                            </div>
                          </details>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-light leading-relaxed line-clamp-3">
                        {dest.description}
                      </p>
                      {activities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {activities.slice(0, 3).map((act, aIdx) => (
                            <span key={aIdx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400">
                              {act}
                            </span>
                          ))}
                          {activities.length > 3 && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-amber-400 font-medium">
                              +{activities.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-6 pb-6 pt-2 border-t border-slate-800/40 flex items-center justify-between">
                    <button 
                      onClick={() => setSelectedDest(dest)}
                      className="text-amber-400 hover:text-amber-300 text-xs uppercase tracking-widest font-semibold flex items-center space-x-2 group-hover:translate-x-1 transition-transform"
                    >
                      <span>Explore Details</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    {isAuthenticated && role === 'tourist' && <button
                        onClick={() => navigate('/ai-planner', { state: { prefilledDestination: dest.name } })}
                        className="px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 hover:bg-amber-400 hover:text-slate-950 text-xs font-semibold transition-colors"
                      >
                        Plan Trip
                      </button>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Detailed Modal */}
        <AnimatePresence>
          {selectedDest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0b1326] border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6 relative text-slate-200"
              >
                <button
                  onClick={() => setSelectedDest(null)}
                  className="absolute top-6 right-6 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="rounded-2xl overflow-hidden aspect-video relative border border-slate-800">
                  <img
                    src={                    resolveImage(selectedDest.image || selectedDest.image_url, selectedDest.name)}
                    alt={selectedDest.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-slate-700 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                    {selectedDest.tag || selectedDest.category}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold uppercase tracking-wider">
                    <MapPin className="w-4 h-4" />
                    <span>{selectedDest.district} District, Jharkhand</span>
                  </div>
                  <h2 className="text-3xl font-serif text-white">{selectedDest.name}</h2>
                  <p className="text-sm text-slate-300 font-light leading-relaxed">
                    {selectedDest.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-xl bg-[#070b14] border border-slate-800 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <IndianRupee className="w-3 h-3 text-amber-400" /> Entry Fee
                    </span>
                    <p className="font-semibold text-slate-200">
                      {getEntryFee(selectedDest) === null ? 'Fee information unavailable' : getEntryFee(selectedDest) === 0 ? 'Free Entry' : `₹${getEntryFee(selectedDest)}`}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" /> Opening Hours
                    </span>
                    <p className="font-semibold text-slate-200">{selectedDest.opening_hours || 'Open 24/7'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-400" /> Best Season
                    </span>
                    <p className="font-semibold text-slate-200">{selectedDest.best_season || selectedDest.best_time_to_visit || 'Season information unavailable'}</p>
                  </div>
                </div>

                {/* Coordinates & Navigation */}
                {(selectedDest.latitude || selectedDest.lat) && (selectedDest.longitude || selectedDest.lng) && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Compass className="w-4 h-4 text-amber-400" />
                      <span>GPS Coordinates: {Number(selectedDest.latitude ?? selectedDest.lat).toFixed(4)}° N, {Number(selectedDest.longitude ?? selectedDest.lng).toFixed(4)}° E</span>
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedDest.latitude ?? selectedDest.lat},${selectedDest.longitude ?? selectedDest.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                    >
                      <span>View Map</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Activities */}
                {selectedDest.activities && (
                  <div className="space-y-2">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">Available Activities & Experiences</h4>
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(selectedDest.activities)
                        ? selectedDest.activities
                        : (typeof selectedDest.activities === 'string' ? JSON.parse(selectedDest.activities || '[]') : [])
                      ).map((act, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-amber-400 font-medium">
                          ✦ {act}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Weather Forecast powered by OpenWeather */}
                {destWeather && destWeather.available !== false && (
                  <div className="p-3.5 rounded-xl bg-linear-to-r from-sky-950/40 to-slate-900/60 border border-sky-800/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {destWeather.icon ? (
                        <img src={destWeather.icon} alt={destWeather.condition} className="w-9 h-9" />
                      ) : (
                        <CloudSun className="w-6 h-6 text-amber-400" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-white">{destWeather.temp}°C</span>
                          <span className="text-slate-300 capitalize">{destWeather.description}</span>
                        </div>
                        <span className="text-[10px] text-sky-400 font-mono">{destWeather.source || 'Weather source'} ({destWeather.city})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-sky-400" /> {destWeather.humidity}% Humidity</span>
                      <span className="flex items-center gap-1"><Wind className="w-3.5 h-3.5 text-sky-400" /> {destWeather.windSpeed} km/h</span>
                    </div>
                  </div>
                )}
                {destWeather && destWeather.available === false && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-500">
                    Current weather is unavailable because no live weather source returned data.
                  </div>
                )}

                <section className="space-y-4 border-t border-slate-800 pt-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-xl font-serif font-bold text-white">Tourist Reviews & Ratings</h3>
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                        <span className="flex items-center gap-1 text-amber-300"><Star size={15} fill="currentColor" /> {publicReviews?.summary?.averageRating ? publicReviews.summary.averageRating.toFixed(1) : 'No rating yet'}</span>
                        <span className="text-slate-500">({publicReviews?.summary?.totalReviews || 0} published reviews)</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select value={reviewQuery.sort} onChange={(event) => setReviewQuery((current) => ({ ...current, sort: event.target.value, page: 1 }))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-slate-300">
                        <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option>
                      </select>
                      <select value={reviewQuery.rating} onChange={(event) => setReviewQuery((current) => ({ ...current, rating: event.target.value, page: 1 }))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-slate-300">
                        <option value="">All stars</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
                      </select>
                    </div>
                  </div>
                  {publicReviews?.summary?.totalReviews > 0 && <div className="grid grid-cols-5 gap-1">{[5, 4, 3, 2, 1].map((value) => <div key={value} className="rounded-lg bg-slate-950/60 p-2 text-center text-[10px] text-slate-400"><span className="block text-amber-300">{value}★</span>{publicReviews.summary.ratingDistribution?.[value] || 0}</div>)}</div>}
                  {reviewsLoading ? <p className="text-sm text-slate-500">Loading published reviews...</p> : reviewsError ? <p className="text-sm text-rose-300">{reviewsError}</p> : !publicReviews?.summary?.totalReviews ? <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">No reviews yet. Be the first to share your experience!</p> : <div className="space-y-3">{publicReviews.reviews.map((review) => <article key={review.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{review.user_name || 'Tourist'}</p><p className="text-[10px] text-slate-500">{new Date(review.created_at).toLocaleDateString()}</p></div><span className="flex items-center gap-1 text-sm text-amber-300">{review.rating} <Star size={13} fill="currentColor" /></span></div><p className="mt-3 text-sm leading-relaxed text-slate-300">{review.review_text}</p></article>)}</div>}
                  {publicReviews?.pagination?.totalPages > 1 && <div className="flex items-center justify-between"><button disabled={reviewQuery.page <= 1} onClick={() => setReviewQuery((current) => ({ ...current, page: current.page - 1 }))} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] text-slate-300 disabled:opacity-40">Previous</button><span className="text-[10px] text-slate-500">Page {publicReviews.pagination.page} of {publicReviews.pagination.totalPages}</span><button disabled={reviewQuery.page >= publicReviews.pagination.totalPages} onClick={() => setReviewQuery((current) => ({ ...current, page: current.page + 1 }))} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] text-slate-300 disabled:opacity-40">Next</button></div>}
                </section>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-800">
                  {isAuthenticated && role === 'tourist' && <button
                      onClick={() => {
                        setSelectedDest(null);
                        navigate('/ai-planner', { state: { prefilledDestination: selectedDest.name } });
                      }}
                      className="flex-1 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-semibold rounded-xl text-xs uppercase tracking-wider transition-colors text-center"
                    >
                      Generate AI Itinerary for {selectedDest.name}
                    </button>}
                  <button
                    onClick={() => setSelectedDest(null)}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl uppercase tracking-wider transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}