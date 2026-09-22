import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ArrowRight, Search, Filter, X, Clock, IndianRupee, Compass, Calendar, ExternalLink, CloudSun, Wind, Droplets, Heart } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

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

function isFavourableMonth(destination) {
  const season = String(destination.best_season || destination.best_time_to_visit || '').toLowerCase();
  if (!season) return false;
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const currentMonth = months[new Date().getMonth()];
  const ranges = season.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s*[–—-]\s*(january|february|march|april|may|june|july|august|september|october|november|december)/i);
  if (ranges) {
    const start = months.indexOf(ranges[1].toLowerCase());
    const end = months.indexOf(ranges[2].toLowerCase());
    const current = months.indexOf(currentMonth);
    return start <= end ? current >= start && current <= end : current >= start || current <= end;
  }
  return season.includes(currentMonth);
}

export default function Destinations() {
  const { isAuthenticated } = useAuth();
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
      const interests = response.tourist?.preferences?.interests;
      if (Array.isArray(interests)) {
        setProfileInterests(interests);
      } else if (typeof interests === 'string') {
        try {
          setProfileInterests(JSON.parse(interests));
        } catch {
          setProfileInterests(interests.split(',').map((item) => item.trim()).filter(Boolean));
        }
      }
    }).catch(() => {
      setSavedDestinationIds(new Set());
    });
  }, [isAuthenticated]);

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

  const recommendedDestinations = destinations.filter((destination) => {
    if (!profileInterests.length) return false;
    const content = `${destination.category || ''} ${destination.description || ''} ${destination.activities || ''}`.toLowerCase();
    return profileInterests.some((interest) => content.includes(String(interest).toLowerCase()));
  }).slice(0, 3);

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
            <span className="text-xs uppercase tracking-[0.2em] text-amber-400 font-bold">Recommended for you</span>
            <h2 className="mt-1 text-2xl font-serif font-bold">Based on your travel interests</h2>
            <div className="mt-5 grid md:grid-cols-3 gap-4">
              {recommendedDestinations.map((destination) => (
                <button key={destination.id} type="button" onClick={() => setSelectedDest(destination)} className="text-left rounded-2xl border border-slate-800 bg-slate-950/50 p-4 hover:border-amber-400/50">
                  <h3 className="font-bold text-white">{destination.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">{destination.district} · {destination.category}</p>
                  {isFavourableMonth(destination) && <span className="mt-3 inline-block text-[10px] font-bold uppercase text-emerald-400">Favourable this season</span>}
                </button>
              ))}
            </div>
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
              const favourable = isFavourableMonth(dest);
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
                      {favourable && <div className="absolute bottom-4 left-4 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-950">Favourable now</div>}
                    </div>
                    <div className="p-6 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-xl font-serif text-slate-100 group-hover:text-amber-400 transition-colors">{dest.name}</h3>
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
                    {isAuthenticated && <button
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
                  {isFavourableMonth(selectedDest) && <div className="absolute bottom-4 right-4 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-950">Favourable now</div>}
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
                {destWeather && (
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
                        <span className="text-[10px] text-sky-400 font-mono">Live Weather ({destWeather.city})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-sky-400" /> {destWeather.humidity}% Humidity</span>
                      <span className="flex items-center gap-1"><Wind className="w-3.5 h-3.5 text-sky-400" /> {destWeather.windSpeed} km/h</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-800">
                  {isAuthenticated && <button
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