import React, { Component, useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  MapPin,
  Wallet,
  Users,
  Sparkles,
  Mountain,
  TreePine,
  Landmark,
  Camera,
  Utensils,
  Hotel,
  Car,
  Check,
  Clock3,
  Navigation,
  RotateCcw,
  ShieldCheck,
  Lock,
  CheckCircle2,
  ExternalLink,
  Download,
  CloudSun,
  BadgeCheck,
  Compass,
} from "lucide-react";
import NetarhatPlateau from "../assets/Netarhat-Plateau.jpeg";
import BetlaNationalPark from "../assets/Betla-National-Park.jpg";
import JharkhandHero from "../assets/hero.png";
import { motion, AnimatePresence } from "framer-motion";

const interests = [
  { id: "nature", label: "Nature & Waterfalls", icon: <Mountain size={18} /> },
  { id: "wildlife", label: "Wildlife & Safari", icon: <TreePine size={18} /> },
  { id: "tribal", label: "Tribal Heritage", icon: <Landmark size={18} /> },
  { id: "culture", label: "Culture & Arts", icon: <Camera size={18} /> },
  { id: "spiritual", label: "Temples & Spirituality", icon: <Sparkles size={18} /> },
  { id: "food", label: "Local Food", icon: <Utensils size={18} /> },
];

const places = [
  "Ranchi",
  "Hundru Falls",
  "Jonha Falls",
  "Dassam Falls",
  "Netarhat",
  "Betla National Park",
  "Deoghar",
  "Parasnath",
  "Hazaribagh",
  "Palamu",
];

const jharkhandDistricts = [
  "Bokaro",
  "Chatra",
  "Deoghar",
  "Dhanbad",
  "Dumka",
  "East Singhbhum",
  "Garhwa",
  "Giridih",
  "Godda",
  "Gumla",
  "Hazaribagh",
  "Jamtara",
  "Khunti",
  "Koderma",
  "Latehar",
  "Lohardaga",
  "Pakur",
  "Palamu",
  "Ramgarh",
  "Ranchi",
  "Sahibganj",
  "Seraikela-Kharsawan",
  "Simdega",
  "West Singhbhum",
];

const districtCenters = {
  Bokaro: [23.67, 86.15],
  Chatra: [24.2, 84.87],
  Deoghar: [24.48, 86.7],
  Dhanbad: [23.8, 86.43],
  Dumka: [24.27, 87.25],
  "East Singhbhum": [22.8, 86.2],
  Garhwa: [24.18, 83.82],
  Giridih: [24.19, 86.3],
  Godda: [24.83, 87.22],
  Gumla: [23.04, 84.54],
  Hazaribagh: [23.99, 85.36],
  Jamtara: [23.96, 86.8],
  Khunti: [23.08, 85.28],
  Koderma: [24.47, 85.59],
  Latehar: [23.75, 84.5],
  Lohardaga: [23.43, 84.68],
  Pakur: [24.64, 87.85],
  Palamu: [24.03, 84.07],
  Ramgarh: [23.63, 85.52],
  Ranchi: [23.34, 85.31],
  Sahibganj: [25.24, 87.64],
  "Seraikela-Kharsawan": [22.8, 85.93],
  Simdega: [22.62, 84.5],
  "West Singhbhum": [22.57, 85.37],
};

function distanceBetween(first, second) {
  const [lat1, lng1] = first;
  const [lat2, lng2] = second;
  const earthRadius = 6371;
  const latDelta = ((lat2 - lat1) * Math.PI) / 180;
  const lngDelta = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180)
    * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(lngDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const destinationData = {
  Ranchi: {
    title: "Ranchi",
    type: "City & Waterfalls",
    activities: [
      "Ranchi city exploration",
      "Jagannath Temple",
      "Kanke Dam sunset",
      "Local tribal cuisine",
    ],
  },
  "Hundru Falls": {
    title: "Hundru Falls",
    type: "Waterfall",
    activities: [
      "Hundru Falls viewpoint",
      "Forest trail",
      "Photography",
      "Local village experience",
    ],
  },
  "Jonha Falls": {
    title: "Jonha Falls",
    type: "Waterfall",
    activities: [
      "Jonha Falls",
      "Surya Temple",
      "Nature walk",
      "Local handicraft shopping",
    ],
  },
  "Dassam Falls": {
    title: "Dassam Falls",
    type: "Waterfall",
    activities: [
      "Dassam Falls",
      "Scenic drive",
      "Photography",
      "Forest exploration",
    ],
  },
  Netarhat: {
    title: "Netarhat",
    type: "Hill Station",
    activities: [
      "Magnolia Point sunrise",
      "Pine forest walk",
      "Upper Ghaghri Falls",
      "Sunset viewpoint",
    ],
  },
  "Betla National Park": {
    title: "Betla National Park",
    type: "Wildlife",
    activities: [
      "Jungle safari",
      "Wildlife spotting",
      "Palamu Fort",
      "Forest exploration",
    ],
  },
  Deoghar: {
    title: "Deoghar",
    type: "Spiritual",
    activities: [
      "Baidyanath Temple",
      "Tapovan Hills",
      "Trikut Hills",
      "Local sweets",
    ],
  },
  Parasnath: {
    title: "Parasnath",
    type: "Spiritual & Hills",
    activities: [
      "Parasnath Hills",
      "Jain temples",
      "Hill trek",
      "Sunrise views",
    ],
  },
  Hazaribagh: {
    title: "Hazaribagh",
    type: "Nature & Wildlife",
    activities: [
      "Hazaribagh National Park",
      "Canary Hill",
      "Lake exploration",
      "Nature photography",
    ],
  },
  Palamu: {
    title: "Palamu",
    type: "Heritage & Wildlife",
    activities: [
      "Palamu Fort",
      "Forest exploration",
      "Wildlife experience",
      "Local heritage",
    ],
  },
};

const styleOptions = [
  "Relaxed & Scenic",
  "Adventure Packed",
  "Luxury & Premium",
  "Culture & Heritage",
  "Family Friendly",
];

const accommodationOptions = [
  "Budget Homestays",
  "Comfort Hotels",
  "Nature Resorts",
  "Luxury Resorts",
];

const foodOptions = [
  "Local Jharkhand Cuisine",
  "Vegetarian",
  "Non-Vegetarian",
  "No Preference",
];

const transportOptions = [
  "Private Car",
  "Train",
  "Bus",
  "Let AI Decide",
];

function getBudgetNumber(budget) {
  const value = Number(budget);

  if (!value || value < 1) return 25000;

  return value;
}

function estimateFareForMode(mode, distanceKm, travelers) {
  const rates = {
    'Private Car': [14, 250],
    Train: [2.2, 80],
    Bus: [1.5, 30],
    'Let AI Decide': [14, 250]
  };
  const [rate, fixed] = rates[mode] || rates['Private Car'];
  return Math.max(fixed, Math.round((distanceKm * rate + fixed) * Math.max(1, Number(travelers) || 1)));
}

function resolvePlannerMode(mode, distanceKm, travelers) {
  if (mode !== 'Let AI Decide') return mode;
  if (distanceKm >= 80) return Number(travelers) > 2 ? 'Private Car' : 'Train';
  return 'Private Car';
}

function transportCheckUrl(mode, from, to) {
  if (mode === 'Train') return 'https://www.irctc.co.in/nget/train-search';
  if (mode === 'Bus') {
    const slug = (value) => encodeURIComponent(String(value || '').toLowerCase().trim().replace(/\s+/g, '-'));
    return `https://www.redbus.in/bus-tickets/${slug(from)}-to-${slug(to)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=driving`;
}

function isServiceAvailable(service, tripDate, travelers) {
  const availability = service?.availability;
  if (!availability || availability.available === false) return false;
  const maxGroupSize = Number(availability.maxGroupSize || availability.max_group_size);
  if (Number.isFinite(maxGroupSize) && maxGroupSize > 0 && Number(travelers) > maxGroupSize) return false;

  const dates = Array.isArray(availability.dates) ? availability.dates.map(String) : [];
  if (dates.length > 0) return dates.includes(String(tripDate));

  const from = availability.availableFrom || availability.startDate;
  const to = availability.availableTo || availability.endDate;
  if (from || to) {
    return Boolean(tripDate) && (!from || tripDate >= from) && (!to || tripDate <= to);
  }

  if (Array.isArray(availability.days) && tripDate) {
    const weekday = new Date(`${tripDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
    return availability.days.includes(weekday);
  }

  return false;
}

function buildCostEstimate(budget, travelers, days) {
  const totalBudget = getBudgetNumber(budget);
  const entryFees = Math.round(totalBudget * 0.08);
  const remaining = totalBudget - entryFees;
  const breakdown = {
    transportation: Math.round(remaining * 0.32),
    accommodation: Math.round(remaining * 0.27),
    food: Math.round(remaining * 0.20),
    entryFees,
    activities: Math.round(remaining * 0.13),
    parkingLocalTravel: 0
  };
  breakdown.parkingLocalTravel = Math.max(
    0,
    totalBudget - Object.values(breakdown).reduce((sum, value) => sum + value, 0)
  );
  return {
    ...breakdown,
    estimatedTotal: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    budget: totalBudget,
    remaining: totalBudget - Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    costPerPerson: Math.round(Object.values(breakdown).reduce((sum, value) => sum + value, 0) / Math.max(1, Number(travelers) || 1)),
    statuses: {
      transportation: 'estimated',
      accommodation: 'estimated',
      food: 'estimated',
      entryFees: 'estimated',
      activities: 'estimated',
      parkingLocalTravel: 'estimated'
    },
    source: 'frontend estimate',
    days
  };
}

function formatCurrency(value) {
  const amount = Number(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + Number(days) - 1);
  return date.toISOString().split('T')[0];
}

function resolveServiceImage(service) {
  const source = `${service.image || ''} ${service.title || ''}`.toLowerCase();
  if (source.includes('betla') || source.includes('forest lodge')) return BetlaNationalPark;
  if (source.includes('netarhat') || source.includes('sunrise')) return NetarhatPlateau;
  return JharkhandHero;
}

export default function AIPlanner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [itinerary, setItinerary] = useState(null);
  const [availablePlaces, setAvailablePlaces] = useState(places);
  const [availableStartLocations, setAvailableStartLocations] = useState(jharkhandDistricts);
  const [destinationRecords, setDestinationRecords] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState('');
  const [serviceOptions, setServiceOptions] = useState([]);
  const [weatherByPlace, setWeatherByPlace] = useState({});
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [verifiedFares, setVerifiedFares] = useState({});
  const [checklist, setChecklist] = useState({});

  const [form, setForm] = useState({
    days: 4,
    budget: 30000,
    travelers: 2,
    adults: 2,
    children: 0,
    seniors: 0,
    tripDate: getTodayDate(),
    month: "October",
    startCity: "Ranchi",
    style: "Relaxed & Scenic",
    interests: ["nature"],
    places: [],
    accommodation: "Comfort Hotels",
    food: "No Preference",
    transport: "Private Car",
    pace: "Balanced",
    requirements: "",
    packageServiceId: "",
    guideServiceId: "",
    hotelServiceId: "",
  });

  useEffect(() => {
    api.destinations.getAll().then((res) => {
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const districts = res.data.map((d) => d.district).filter(Boolean);
        setDestinationRecords(res.data);
        setAvailableStartLocations(
          Array.from(new Set([...jharkhandDistricts, ...districts])).sort()
        );
      }
    }).catch(console.warn);
    api.marketplace.getData().then((res) => setServiceOptions(res.services || [])).catch(console.warn);
  }, []);

  useEffect(() => {
    const plannerPreferences = location.state?.plannerPreferences;
    if (plannerPreferences) {
      const normalizedInterests = (Array.isArray(plannerPreferences.interests)
        ? plannerPreferences.interests
        : [plannerPreferences.interests]
      ).filter(Boolean).map((interest) => {
        const value = String(interest).toLowerCase();
        if (value.includes('waterfall') || value.includes('nature')) return 'nature';
        if (value.includes('wildlife')) return 'wildlife';
        if (value.includes('heritage') || value.includes('culture') || value.includes('tribal')) return 'culture';
        if (value.includes('religious') || value.includes('spiritual') || value.includes('temple')) return 'spiritual';
        if (value.includes('adventure')) return 'nature';
        return value;
      });
      setForm((previous) => ({
        ...previous,
        days: Number(plannerPreferences.days) || previous.days,
        budget: Number(plannerPreferences.budget) || previous.budget,
        travelers: Number(plannerPreferences.travelers) || previous.travelers,
        adults: Number(plannerPreferences.travelers) || previous.adults,
        startCity: plannerPreferences.startCity || previous.startCity,
        interests: Array.from(new Set(normalizedInterests)).filter((interest) => ['nature', 'wildlife', 'culture', 'spiritual'].includes(interest))
      }));
    }
    if (location.state?.prefilledDestination) {
      const pre = location.state.prefilledDestination;
      setForm((prev) => ({
        ...prev,
        places: prev.places.includes(pre) ? prev.places : [...prev.places, pre],
      }));
    }
  }, [location.state]);

  useEffect(() => {
    if (!destinationRecords.length) return;

    const origin = districtCenters[form.startCity];
    const ranked = destinationRecords
      .filter((destination) => destination.name && Number.isFinite(Number(destination.lat)) && Number.isFinite(Number(destination.lng)))
      .map((destination) => ({
        ...destination,
        distance: origin
          ? distanceBetween(origin, [Number(destination.lat), Number(destination.lng)])
          : Number.POSITIVE_INFINITY,
      }))
      .sort((first, second) => {
        const firstIsLocal = first.district?.toLowerCase() === form.startCity.toLowerCase();
        const secondIsLocal = second.district?.toLowerCase() === form.startCity.toLowerCase();
        if (firstIsLocal !== secondIsLocal) return firstIsLocal ? -1 : 1;
        return first.distance - second.distance;
      })
      .slice(0, 9)
      .map((destination) => destination.name);

    setAvailablePlaces(ranked);
    setForm((previous) => ({
      ...previous,
      places: previous.places.filter((place) => ranked.includes(place)),
    }));
  }, [destinationRecords, form.startCity]);

  const updateForm = (key, value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const toggleInterest = (interest) => {
    setForm((previous) => {
      const exists = previous.interests.includes(interest);

      return {
        ...previous,
        interests: exists
          ? previous.interests.filter((item) => item !== interest)
          : [...previous.interests, interest],
      };
    });
  };

  const togglePlace = (place) => {
    setForm((previous) => {
      const exists = previous.places.includes(place);

      return {
        ...previous,
        places: exists
          ? previous.places.filter((item) => item !== place)
          : [...previous.places, place],
      };
    });
  };

  const generateItinerary = async (preferences = form) => {
    if (!preferences.tripDate || preferences.tripDate < getTodayDate()) {
      setBookingError('Please choose a valid trip date from today onward.');
      return;
    }
    setGenerating(true);
    setBookingError('');

    try {
      const res = await api.itinerary.plan(preferences);
      if (Array.isArray(res.days) && res.days.length > 0 && res.summary) {
        const days = res.days.map((day, index) => ({
          ...day,
          day: day.day || index + 1,
          activities: Array.isArray(day.activities)
            ? day.activities
            : [day.activities || day.morning, day.afternoon, day.evening].filter(Boolean),
          transport: day.transport && typeof day.transport === 'object' ? day.transport : null,
        }));
        setItinerary({
          days,
          totalBudget: res.summary.totalBudget,
          dailyBudget: res.summary.dailyBudget,
          route: Array.isArray(res.route) ? res.route : [],
          costEstimate: res.summary.costEstimate || buildCostEstimate(preferences.budget, preferences.travelers, preferences.days),
          transportPlan: res.transportPlan || { intercity: [], localTransport: [], estimatedTotalTransportCost: 0 },
          budgetStatus: res.summary.budgetStatus,
          budgetRecommendation: res.summary.budgetRecommendation,
          selectedPackage: res.selectedPackage || null,
          selectedGuide: res.selectedGuide || null,
          selectedAccommodation: res.selectedAccommodation || null,
        });
        loadItineraryWeather([...(Array.isArray(res.route) ? res.route : []), ...days.map((day) => day.place)]);
        setGenerating(false);
        setStep(5);
        return;
      }
      throw new Error(res.message || 'The planner did not return an itinerary.');
    } catch (err) {
      setBookingError(err.message || 'Unable to generate a database-backed itinerary. Please try again.');
      setGenerating(false);
      return;
    }
  };

  const updateTransportLeg = (dayNumber, field, value, fareOverride) => {
    setItinerary((current) => {
      if (!current) return current;
      const days = current.days.map((day) => {
        if (day.day !== dayNumber || !day.transport) return day;
        const transport = { ...day.transport, [field]: value };
        let durationHours = Number(transport.durationHours) || 0;
        if (field === 'mode') {
          const distanceKm = Number(day.transport.distanceKm) || 0;
          const selectedMode = resolvePlannerMode(value, distanceKm, form.travelers);
          const speedByMode = { 'Private Car': 45, Train: 55, Bus: 38 };
          const fare = estimateFareForMode(selectedMode, distanceKm, form.travelers);
          durationHours = Math.max(0.2, Math.round((distanceKm / (speedByMode[selectedMode] || 45)) * 10) / 10);
          transport.mode = selectedMode;
          transport.durationHours = durationHours;
          transport.duration = `${durationHours} hours`;
          transport.estimatedCostValue = fare;
          transport.estimatedCost = `₹${fare.toLocaleString('en-IN')}`;
          transport.bookingUrl = transportCheckUrl(selectedMode, transport.from, transport.to);
          transport.notes = selectedMode === 'Train'
            ? 'Train route, fare and availability must be checked with Indian Railways.'
            : selectedMode === 'Bus'
              ? 'Bus fare, route and seat availability must be checked on RedBus.'
              : `Estimated ${selectedMode.toLowerCase()} cost and duration; verify before travel.`;
        }
        return {
          ...day,
          transport,
          estimatedTravelTime: `${durationHours || transport.durationHours || 'Time unavailable'} hrs transit`,
        };
      });
      const transportTotal = days.reduce((sum, day) => {
        const fare = day.day === dayNumber && fareOverride !== undefined
          ? Number(fareOverride)
          : Number(verifiedFares[day.day]);
        return sum + (Number.isFinite(fare) && fare >= 0 ? fare : Number(day.transport?.estimatedCostValue || 0));
      }, 0);
      const costEstimate = { ...current.costEstimate, transportation: transportTotal };
      costEstimate.estimatedTotal = Object.entries(costEstimate)
        .filter(([key, value]) => key !== 'estimatedTotal' && key !== 'budget' && key !== 'remaining' && key !== 'costPerPerson' && key !== 'statuses' && typeof value === 'number')
        .reduce((sum, [, value]) => sum + value, 0);
      costEstimate.remaining = costEstimate.budget - costEstimate.estimatedTotal;
      costEstimate.costPerPerson = Math.round(costEstimate.estimatedTotal / Math.max(1, Number(form.travelers) || 1));
      return { ...current, days, costEstimate };
    });
  };

  const setVerifiedFare = (dayNumber, value) => {
    setVerifiedFares((current) => ({ ...current, [dayNumber]: value }));
    updateTransportLeg(dayNumber, 'verifiedFare', value, value);
  };

  const adaptItinerary = (adaptation) => {
    const nextForm = { ...form, adaptation };
    if (adaptation === 'cheaper') {
      nextForm.budget = Math.max(5000, Math.round(Number(form.budget) * 0.8));
      nextForm.accommodation = 'Budget Homestays';
      nextForm.transport = 'Bus';
    } else if (adaptation === 'nature') {
      nextForm.interests = Array.from(new Set([...form.interests, 'nature']));
      nextForm.style = 'Relaxed & Scenic';
    } else if (adaptation === 'wildlife') {
      nextForm.interests = Array.from(new Set([...form.interests, 'wildlife']));
      nextForm.places = Array.from(new Set([...form.places, 'Betla National Park']));
    } else if (adaptation === 'culture') {
      nextForm.interests = Array.from(new Set([...form.interests, 'culture', 'tribal']));
      nextForm.places = Array.from(new Set([...form.places, 'Deoghar']));
    } else if (adaptation === 'relaxed') {
      nextForm.pace = 'Relaxed';
      nextForm.style = 'Relaxed & Scenic';
    } else if (adaptation === 'less-travel') {
      nextForm.transport = 'Bus';
      nextForm.pace = 'Relaxed';
    } else if (adaptation === 'family') {
      nextForm.style = 'Family Friendly';
      nextForm.pace = 'Relaxed';
      nextForm.requirements = `${form.requirements} Family-friendly plan; avoid strenuous activities.`.trim();
    } else if (adaptation === 'weather') {
      nextForm.requirements = `${form.requirements} Adjust outdoor activities around the latest available weather information.`.trim();
    }
    setForm(nextForm);
    setBookingSuccess(null);
    setTimeout(() => generateItinerary(nextForm), 0);
  };

  const loadItineraryWeather = async (route) => {
    const placesToCheck = Array.from(new Set((route || []).filter(Boolean)));
    setWeatherLoading(true);
    try {
      const entries = await Promise.all(placesToCheck.map(async (place) => [place, await api.weather.get(place)]));
      setWeatherByPlace(Object.fromEntries(entries));
    } catch (err) {
      console.warn('Itinerary weather lookup failed:', err);
    } finally {
      setWeatherLoading(false);
    }
  };

  const downloadItinerary = () => {
    const lines = [
      'JHARKHAND TOURISM ITINERARY',
      `Trip date: ${form.tripDate}`,
      `Return date: ${addDays(form.tripDate, form.days)}`,
      `Starting point: ${form.startCity}`,
      `Travelers: ${form.travelers}`,
      `Budget: ${formatCurrency(itinerary.totalBudget)}`,
      ...(itinerary.costEstimate ? [
        '',
        'TRIP COST ESTIMATE',
        `Transportation: ${formatCurrency(itinerary.costEstimate.transportation)}`,
        `Accommodation: ${formatCurrency(itinerary.costEstimate.accommodation)}`,
        `Food: ${formatCurrency(itinerary.costEstimate.food)}`,
        `Entry Fees: ${formatCurrency(itinerary.costEstimate.entryFees)}`,
        `Activities: ${formatCurrency(itinerary.costEstimate.activities)}`,
        `Parking / Local Travel: ${formatCurrency(itinerary.costEstimate.parkingLocalTravel)}`,
        `Estimated Total: ${formatCurrency(itinerary.costEstimate.estimatedTotal)}`,
        `Remaining: ${formatCurrency(itinerary.costEstimate.remaining)}`,
        `Cost per person: ${formatCurrency(itinerary.costEstimate.costPerPerson)}`
      ] : []),
      '',
      ...itinerary.days.flatMap((day) => [
        `DAY ${day.day}: ${day.place}`,
        `Weather: ${weatherByPlace[day.place]?.temp ?? 'Unavailable'}°C, ${weatherByPlace[day.place]?.description || 'Unavailable'}`,
        `Morning: ${day.morning}`,
        `Afternoon: ${day.afternoon}`,
        `Evening: ${day.evening}`,
        `Budget: ${formatCurrency(day.budget)}`,
        ''
      ])
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jharkhand-itinerary-${form.tripDate}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetPlanner = () => {
    setStep(1);
    setItinerary(null);
    setBookingSuccess(null);
    setBookingError('');
    setForm({
      days: 4,
      budget: 30000,
      travelers: 2,
      adults: 2,
      children: 0,
      seniors: 0,
      tripDate: getTodayDate(),
      month: "October",
      startCity: "Ranchi",
      style: "Relaxed & Scenic",
      interests: ["nature"],
      places: [],
      accommodation: "Comfort Hotels",
      food: "No Preference",
      transport: "Private Car",
      pace: "Balanced",
      requirements: "",
      packageServiceId: "",
      guideServiceId: "",
      hotelServiceId: "",
    });
  };

  const handleBookItinerary = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnUrl: '/ai-planner' } });
      return;
    }

    setBookingLoading(true);
    setBookingError('');
    try {
      const routeText = itinerary?.route?.join(' ➔ ') || 'Jharkhand Circuit';
      const title = `${form.days}-Day ${form.style} Expedition (${routeText})`;
      const bookings = [];
      const selectedIds = [
        form.packageServiceId,
        form.guideServiceId,
        form.hotelServiceId
      ].filter(Boolean);
      for (const serviceId of selectedIds) {
        const service = serviceOptions.find((option) => option.id === serviceId);
        if (!service) throw new Error('One of the selected services is no longer available.');
        const serviceBooking = await api.marketplace.book({
          itemType: service.category,
          itemId: service.id,
          title,
          travelers: form.travelers,
          days: service.category === 'package' ? form.days : (service.duration_days || 1),
          checkInDate: form.tripDate,
          checkOutDate: addDays(form.tripDate, service.category === 'package' ? form.days : (service.duration_days || 1)),
          paymentGateway: 'escrow'
        });
        bookings.push(serviceBooking.booking || serviceBooking);
      }

      if (bookings.length > 0) {
        setBookingSuccess({ ...bookings[0], relatedBookings: bookings.slice(1) });
      } else {
        throw new Error('Select a package, guide, or accommodation before booking.');
      }
    } catch (err) {
      setBookingError(err.message || 'Unable to complete smart contract escrow booking');
    } finally {
      setBookingLoading(false);
    }
  };

  const progress = useMemo(() => {
    if (step === 1) return 25;
    if (step === 2) return 50;
    if (step === 3) return 60;
    if (step === 4) return 80;
    return 100;
  }, [step]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pt-32 pb-20 px-5 md:px-8">

      {/* HERO */}
      <div className="max-w-6xl mx-auto mb-12">
        <div className="text-center max-w-3xl mx-auto">

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-400/20 bg-amber-400/5 text-amber-400 text-xs font-semibold tracking-[0.2em] uppercase">
            <Sparkles size={15} />
            Powered by BirsaAI
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-serif font-bold leading-tight">
            Your Journey.
            <span className="block text-amber-300 italic">
              Your Jharkhand.
            </span>
          </h1>

          <p className="mt-5 text-slate-400 text-base md:text-lg leading-relaxed">
            Tell BirsaAI what kind of journey you dream of.
            We will craft a personalized Jharkhand itinerary around
            your time, budget, interests and travel style.
          </p>
        </div>
      </div>

      {/* PROGRESS */}
      {!itinerary && (
        <div className="max-w-4xl mx-auto mb-8">

          <div className="flex justify-between text-xs uppercase tracking-widest text-slate-500 mb-3">
            <span>Trip Details</span>
            <span>Preferences</span>
            <span>Guides & Hotels</span>
            <span>Destinations</span>
            <span>Journey</span>
          </div>

          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* STEP 1 */}
        {step === 1 && !itinerary && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-[#0b1326]/80 border border-slate-800 rounded-3xl p-6 md:p-10 backdrop-blur-xl shadow-2xl">

              <StepHeading
                icon={<CalendarDays />}
                title="Let's understand your trip"
                description="Start with the basic details of your vacation."
              />

              <div className="grid md:grid-cols-2 gap-6 mt-8">

                <Field label="How many days?">
                  <select
                    value={form.days}
                    onChange={(e) => updateForm("days", Number(e.target.value))}
                    className="input"
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((day) => (
                      <option key={day} value={day}>
                        {day} Days
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Traveler breakdown">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['adults', 'Adults'],
                      ['children', 'Children'],
                      ['seniors', 'Seniors']
                    ].map(([key, label]) => (
                      <label key={key} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={form[key]}
                          onChange={(e) => {
                            const next = Math.max(0, Number(e.target.value));
                            updateForm(key, next);
                                             updateForm('travelers', Math.max(1, (key === 'adults' ? next : form.adults) + (key === 'children' ? next : form.children) + (key === 'seniors' ? next : form.seniors)));
                          }}
                          className="mt-2 w-full bg-transparent text-slate-200 outline-none"
                        />
                      </label>
                    ))}
                  </div>
                </Field>

               <Field label="Number of travelers">
                    <div className="flex items-center bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden focus-within:border-amber-400 transition">
                        <div className="pl-4 text-slate-500">
                        <Users size={18} />
                        </div>

                        <input
                        type="number"
                        min="1"
                        max="20"
                        value={form.travelers}
                        readOnly
                        aria-label="Total travelers derived from the breakdown"
                        className="planner-select w-full bg-transparent border-0 outline-none px-4 py-3.5 text-slate-200"
                        />
                    </div>
                </Field>

                <Field label="Total trip budget">
                    <div className="flex items-center bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden focus-within:border-amber-400 transition">

                        <div className="pl-4 text-slate-500">
                        <Wallet size={18} />
                        </div>

                        <span className="ml-3 text-slate-500">
                        ₹
                        </span>

                        <input
                        type="number"
                        min="5000"
                        value={form.budget}
                        onChange={(e) =>
                            updateForm("budget", Number(e.target.value))
                        }
                        className="w-full bg-transparent border-0 outline-none px-3 py-3.5 text-slate-200"
                        />

                    </div>
                </Field>

                <Field label="Month of travel">
                  <select
                    value={form.month}
                    onChange={(e) => updateForm("month", e.target.value)}
                    className="input"
                  >
                    {[
                      "January",
                      "February",
                      "March",
                      "April",
                      "May",
                      "June",
                      "July",
                      "August",
                      "September",
                      "October",
                      "November",
                      "December",
                    ].map((month) => (
                      <option key={month}>{month}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Trip start date">
                  <input
                    type="date"
                    min={getTodayDate()}
                    value={form.tripDate}
                    onChange={(e) => updateForm("tripDate", e.target.value)}
                    className="input"
                    required
                  />
                  <p className="mt-2 text-[10px] text-slate-500">Choose today or a future date. Return date: {form.tripDate ? addDays(form.tripDate, form.days) : 'Select a start date'}.</p>
                </Field>

                <Field label="Starting point">
                    <div className="flex items-center bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden focus-within:border-amber-400 transition">

                        <div className="pl-4 text-slate-500">
                        <MapPin size={18} />
                        </div>

                        <select
                        value={form.startCity}
                        onChange={(e) =>
                            updateForm("startCity", e.target.value)
                        }
                        className="w-full bg-transparent border-0 outline-none px-4 py-3.5 text-slate-200"
                        >
                        {availableStartLocations.map((locationName) => (
                          <option key={locationName}>{locationName}</option>
                        ))}
                        </select>

                    </div>
                </Field>

                <Field label="How do you want to travel?">
                  <select
                    value={form.transport}
                    onChange={(e) =>
                      updateForm("transport", e.target.value)
                    }
                    className="input"
                  >
                    {transportOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>

              </div>

              <NextButton onClick={() => setStep(2)} />
            </div>
          </motion.div>
        )}

        {/* STEP 2 */}
        {step === 2 && !itinerary && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-[#0b1326]/80 border border-slate-800 rounded-3xl p-6 md:p-10 backdrop-blur-xl shadow-2xl">

              <StepHeading
                icon={<Sparkles />}
                title="Tell BirsaAI your travel personality"
                description="This helps us shape the pace and character of your journey."
              />

              <div className="mt-8">

                <Field label="Your travel style">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {styleOptions.map((option) => (
                      <Choice
                        key={option}
                        active={form.style === option}
                        onClick={() => updateForm("style", option)}
                      >
                        {option}
                      </Choice>
                    ))}
                  </div>
                </Field>

                <Field label="What are you interested in? Select all that apply.">
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {interests.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => toggleInterest(item.id)}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          form.interests.includes(item.id)
                            ? "border-amber-400 bg-amber-400/10 text-amber-300"
                            : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {item.icon}
                          <span className="text-sm font-medium">
                            {item.label}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid md:grid-cols-2 gap-6">

                  <Field label="Accommodation">
                    <select
                      value={form.accommodation}
                      onChange={(e) =>
                        updateForm("accommodation", e.target.value)
                      }
                      className="input"
                    >
                      {accommodationOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Food preference">
                    <select
                      value={form.food}
                      onChange={(e) => updateForm("food", e.target.value)}
                      className="input"
                    >
                      {foodOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>

                </div>

                <Field label="Preferred trip pace">
                  <div className="grid grid-cols-3 gap-3">
                    {["Relaxed", "Balanced", "Fast Paced"].map((pace) => (
                      <Choice
                        key={pace}
                        active={form.pace === pace}
                        onClick={() => updateForm("pace", pace)}
                      >
                        {pace}
                      </Choice>
                    ))}
                  </div>
                </Field>

              </div>

              <div className="flex justify-between mt-10">
                <BackButton onClick={() => setStep(1)} />
                <NextButton onClick={() => setStep(3)} />
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: GUIDES AND HOTELS */}
        {step === 3 && !itinerary && (
          <motion.div
            key="step3-services"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-[#0b1326]/80 border border-slate-800 rounded-3xl p-6 md:p-10 backdrop-blur-xl shadow-2xl">
              <StepHeading
                icon={<Hotel />}
                title="Choose your guide and stay"
                description="Select from the currently available certified guides and hotels. These choices will be secured with your itinerary booking."
              />

              <div className="mt-8 space-y-8">
                {serviceOptions.some((service) => service.category === 'package') && (
                  <div>
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-amber-400">Travel package</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {serviceOptions.filter((service) => service.category === 'package' && isServiceAvailable(service, form.tripDate, form.travelers)).map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => updateForm('packageServiceId', form.packageServiceId === service.id ? '' : service.id)}
                          className={`rounded-xl border p-4 text-left ${form.packageServiceId === service.id ? 'border-amber-400 bg-amber-400/10' : 'border-slate-800 bg-slate-950/60'}`}
                        >
                          <div className="flex justify-between gap-3">
                            <strong className="text-white">{service.title}</strong>
                            <span className="text-xs text-amber-300">₹{Number(service.price || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">{service.description || 'Package details available from the certified provider.'}</p>
                          <div className="mt-3 flex flex-wrap gap-1">
                            {(service.amenities || []).map((amenity) => <span key={amenity} className="rounded-md border border-slate-800 bg-slate-950 px-1.5 py-0.5 text-[9px] text-slate-300">{amenity}</span>)}
                          </div>
                          <p className="mt-2 text-[10px] text-slate-500">
                            {service.duration_days || 1} day{service.duration_days === 1 ? '' : 's'} · {Object.entries(service.availability || {}).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ') || 'Availability on request'}
                          </p>
                        </button>
                      ))}
                    </div>
                    {!serviceOptions.some((service) => service.category === 'package' && isServiceAvailable(service, form.tripDate, form.travelers)) && (
                      <p className="mt-2 text-xs text-amber-300">No package is available for the selected date and traveler count.</p>
                    )}
                    {form.packageServiceId && <p className="mt-2 text-[10px] text-emerald-300">Only available services included in the selected package are shown below.</p>}
                  </div>
                )}
                {[
                  { category: 'guide', label: 'Available guides', field: 'guideServiceId', empty: 'No guide selected' },
                  { category: 'homestay', label: 'Available hotels and homestays', field: 'hotelServiceId', empty: 'No hotel selected' }
                ].map(({ category, label, field, empty }) => {
                  const selectedPackage = serviceOptions.find((service) => service.id === form.packageServiceId);
                  const includedIds = selectedPackage?.includedServiceIds || selectedPackage?.included_service_ids || [];
                  const services = serviceOptions.filter((service) =>
                    service.category === category &&
                    isServiceAvailable(service, form.tripDate, form.travelers) &&
                    (!selectedPackage || includedIds.length === 0 || includedIds.includes(service.id))
                  );
                  return (
                    <div key={category}>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-amber-400">{label}</h3>
                        <span className="text-[10px] text-slate-500">{services.length} available</span>
                      </div>
                      {services.length === 0 ? (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-xs text-slate-500">
                          No {category === 'guide' ? 'guides' : 'hotels'} are included in this package.
                          <a className="ml-2 text-amber-300 underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/${encodeURIComponent(`${category === 'guide' ? 'guides' : 'hotels'} near ${form.places[0] || form.startCity}`)}`}>Check nearby</a>
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {services.map((service) => {
                            const selected = form[field] === service.id;
                            const verified = service.approval_status === 'approved' && (
                              service.provider_verified === 'approved' ||
                              service.provider_verified === 'verified' ||
                              service.provider_verified === 1 ||
                              Boolean(service.provider_id)
                            );
                            return (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => updateForm(field, selected ? '' : service.id)}
                                className={`overflow-hidden rounded-xl border text-left transition ${selected ? 'border-amber-400 shadow-lg shadow-amber-400/10' : 'border-slate-800 hover:border-slate-600'} bg-[#070b14]`}
                              >
                                <div className="relative h-28">
                                  <img src={resolveServiceImage(service)} alt={service.title} className="h-full w-full object-cover" />
                                  <div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent" />
                                  {verified && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[9px] font-bold text-slate-950"><BadgeCheck size={11} /> Verified</span>}
                                  {selected && <span className="absolute bottom-2 left-2 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold text-slate-950">Selected</span>}
                                </div>
                                <div className="space-y-2.5 p-3.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div><h4 className="font-serif text-base font-bold text-white">{service.title}</h4><p className="mt-0.5 text-[10px] text-amber-400">{service.provider_name || 'Jharkhand Tourism Provider'} · {service.district}</p></div>
                                    <span className="shrink-0 text-xs font-bold text-white">₹{Number(service.price).toLocaleString('en-IN')}</span>
                                  </div>
                                  <p className="text-[11px] leading-relaxed text-slate-400 line-clamp-2">{service.description}</p>
                                  <div className="flex flex-wrap gap-1">{(service.amenities || []).map((amenity) => <span key={amenity} className="rounded-md border border-slate-800 bg-slate-950 px-1.5 py-0.5 text-[9px] text-slate-300">{amenity}</span>)}</div>
                                  <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-[9px] text-slate-500"><span>{service.duration_days || 1} day{service.duration_days === 1 ? '' : 's'}</span><span className="max-w-[65%] truncate">{Object.entries(service.availability || {}).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ') || 'Availability on request'}</span></div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {services.length > 0 && (
                        <a className="mt-2 inline-block text-[10px] text-amber-300 underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/${encodeURIComponent(`${category === 'guide' ? 'guides' : 'hotels'} near ${form.places[0] || form.startCity}`)}`}>Check nearby {category === 'guide' ? 'guides' : 'hotels'}</a>
                      )}
                      <p className="mt-2 text-[10px] text-slate-500">{form[field] ? 'Click the selected card again to remove it.' : empty}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-5 text-xs text-slate-300">
                <ShieldCheck className="mb-2 text-emerald-400" size={20} />
                Your selected guide and hotel will be booked only when you confirm the final itinerary checkout.
              </div>

              <div className="mt-10 flex justify-between">
                <BackButton onClick={() => setStep(2)} />
                <NextButton onClick={() => setStep(4)} />
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 4: DESTINATIONS */}
        {step === 4 && !itinerary && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-[#0b1326]/80 border border-slate-800 rounded-3xl p-6 md:p-10 backdrop-blur-xl shadow-2xl">

              <StepHeading
                icon={<Navigation />}
                title="Where do you want to go?"
                description={`Showing nearby, practical destinations from ${form.startCity}. BirsaAI will optimize the final route.`}
              />

              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mt-8">

                {availablePlaces.map((place) => {
                  const active = form.places.includes(place);

                  return (
                    <button
                      key={place}
                      type="button"
                      onClick={() => togglePlace(place)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        active
                          ? "border-amber-400 bg-amber-400/10"
                          : "border-slate-800 bg-slate-950/60 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">

                        <div>
                          <p
                            className={`font-medium ${
                              active ? "text-amber-300" : "text-slate-200"
                            }`}
                          >
                            {place}
                          </p>

                          <p className="text-xs text-slate-500 mt-1">
                            {destinationData[place]?.type}
                          </p>
                        </div>

                        {active && (
                          <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                            <Check size={14} />
                          </div>
                        )}

                      </div>
                    </button>
                  );
                })}

              </div>

              <div className="mt-8">

                <label className="block text-xs uppercase tracking-widest text-slate-500 mb-3">
                  Anything else BirsaAI should know?
                </label>

                <textarea
                  rows="4"
                  value={form.requirements}
                  onChange={(e) =>
                    updateForm("requirements", e.target.value)
                  }
                  placeholder="Example: I am travelling with parents, avoid long treks, want sunrise viewpoints and local food..."
                  className="input resize-none"
                />

              </div>

              <div className="flex justify-between mt-10">

                <BackButton onClick={() => setStep(2)} />

                <button
                  type="button"
                  onClick={() => generateItinerary()}
                  disabled={generating}
                  className="px-7 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold flex items-center gap-3 shadow-xl shadow-amber-500/20 hover:scale-[1.02] transition disabled:opacity-60"
                >
                  {generating ? (
                    <>
                      <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      BirsaAI is planning...
                    </>
                  ) : (
                    <>
                      <Sparkles size={19} />
                      Generate My Journey
                    </>
                  )}
                </button>

              </div>

              {bookingError && (
                <div
                  role="alert"
                  className="mt-5 rounded-xl border border-red-800 bg-red-950/30 p-4 text-center text-xs text-red-300"
                >
                  {bookingError}
                </div>
              )}

            </div>
          </motion.div>
        )}

        {/* RESULT */}
        {step === 5 && itinerary && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto"
          >

            {/* RESULT HEADER */}
            <div className="text-center mb-10">

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs uppercase tracking-widest">
                <Check size={15} />
                Journey Optimized
              </div>

              <h2 className="text-3xl md:text-5xl font-serif font-bold mt-5">
                Your Jharkhand Story
              </h2>

              <p className="text-slate-400 mt-3 max-w-2xl mx-auto">
                BirsaAI has created a {form.days}-day journey for{" "}
                {form.travelers} traveler
                {form.travelers > 1 ? "s" : ""}, starting from{" "}
                {form.startCity}.
              </p>

            </div>

            {(itinerary.selectedPackage || itinerary.selectedGuide || itinerary.selectedAccommodation) && (
              <div className="mb-8 grid gap-4 md:grid-cols-3">
                {itinerary.selectedPackage && (
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
                    <p className="text-[10px] uppercase tracking-widest text-amber-300">Selected package</p>
                    <p className="mt-2 font-semibold text-white">{itinerary.selectedPackage.name}</p>
                    <p className="mt-1 text-xs text-emerald-300">₹{Number(itinerary.selectedPackage.price || 0).toLocaleString('en-IN')} · Available for selected dates</p>
                  </div>
                )}
                {itinerary.selectedGuide && (
                  <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-5">
                    <p className="text-[10px] uppercase tracking-widest text-cyan-300">Selected guide</p>
                    <p className="mt-2 font-semibold text-white">{itinerary.selectedGuide.title}</p>
                    <p className="mt-1 text-xs text-emerald-300">₹{Number(itinerary.selectedGuide.price || 0).toLocaleString('en-IN')} · Available for selected dates</p>
                  </div>
                )}
                {itinerary.selectedAccommodation && (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-300">Selected accommodation</p>
                    <p className="mt-2 font-semibold text-white">{itinerary.selectedAccommodation.title}</p>
                    <p className="mt-1 text-xs text-emerald-300">₹{Number(itinerary.selectedAccommodation.price || 0).toLocaleString('en-IN')} · Available for selected dates</p>
                  </div>
                )}
              </div>
            )}

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

              <SummaryCard
                icon={<CalendarDays />}
                label="Duration"
                value={`${form.days} Days`}
              />

              <SummaryCard
                icon={<Wallet />}
                label="Estimated Budget"
                value={formatCurrency(itinerary.totalBudget)}
              />

              <SummaryCard
                icon={<MapPin />}
                label="Destinations"
                value={`${new Set(itinerary.route).size} Places`}
              />

              <SummaryCard
                icon={<Users />}
                label="Travelers"
                value={form.travelers}
              />

              <div className="col-span-2 md:col-span-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0b1326] px-5 py-4 text-sm">
                <div className="flex items-center gap-3">
                  <CalendarDays className="text-amber-400" size={18} />
                  <span>Travel dates: <strong className="text-white">{form.tripDate} to {addDays(form.tripDate, form.days)}</strong></span>
                </div>
                <button onClick={downloadItinerary} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300">
                  <Download size={14} /> Download itinerary
                </button>
              </div>

            </div>

            {/* ROUTE */}
            <div className="bg-[#0b1326] border border-slate-800 rounded-3xl p-6 mb-8">

              <div className="flex items-center gap-3 mb-5">
                <Navigation className="text-amber-400" size={20} />
                <h3 className="font-bold text-lg">
                  Your Optimized Route
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">

                {itinerary.route.map((place, index) => (
                  <React.Fragment key={`${place}-${index}`}>

                    <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm">
                      {place}
                    </div>

                    {index < itinerary.route.length - 1 && (
                      <ArrowRight
                        size={15}
                        className="text-amber-400"
                      />
                    )}

                  </React.Fragment>
                ))}

              </div>

            </div>

            {/* ITINERARY */}
            <div className="space-y-5">

              {itinerary.days.map((day) => (
                <motion.div
                  key={day.day}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: day.day * 0.08 }}
                  className="bg-[#0b1326]/90 border border-slate-800 rounded-3xl overflow-hidden"
                >

                  <div className="p-6 md:p-7">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">

                      <div className="flex items-center gap-4">

                        <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center font-bold">
                          {String(day.day).padStart(2, "0")}
                        </div>

                        <div>
                          <p className="text-xs text-amber-400 uppercase tracking-widest font-semibold">
                            Day {day.day}
                          </p>

                          <h3 className="text-xl md:text-2xl font-serif font-bold mt-1">
                            {day.place}
                          </h3>

                          <p className="text-xs text-slate-500 mt-1">
                            {day.type}{day.date ? ` · ${day.date}` : ''}
                          </p>
                        </div>

                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2">
                        <Clock3 size={15} />
                        {day.duration}
                      </div>

                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <Compass className="text-amber-400" size={18} />
                        Day activities
                      </div>
                      <div className="mt-4 space-y-3">
                        {(Array.isArray(day.activities) ? day.activities : [day.activities || day.morning, day.afternoon, day.evening]).filter(Boolean).map((activity, index) => (
                          <div key={`${day.day}-activity-${index}`} className="flex gap-3 rounded-xl border border-slate-800/80 bg-[#0b1326] p-4">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-xs font-bold text-amber-300">{index + 1}</span>
                            <p className="text-sm leading-6 text-slate-200">{activity}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {day.transport && (
                      <div className="mt-4 rounded-2xl border border-cyan-800/40 bg-cyan-950/20 p-5">
                        <div className="flex items-center gap-2 text-sm font-bold text-cyan-200">
                          <Car size={18} />
                          Transport for this day
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <InfoStrip label="Route" value={`${day.transport.from} → ${day.transport.to}`} />
                          <InfoStrip label="Mode" value={day.transport.mode} />
                          <InfoStrip label="Duration" value={day.transport.duration || `${day.transport.durationHours} hours`} />
                          <InfoStrip label="Estimated cost" value={day.transport.estimatedCost || (day.transport.estimatedCost !== undefined ? formatCurrency(day.transport.estimatedCost) : 'Check current fare')} />
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <label className="text-xs text-cyan-100/80">
                            Change mode for this leg
                            <select className="input mt-1" value={day.transport.mode || form.transport} onChange={(event) => updateTransportLeg(day.day, 'mode', event.target.value)}>
                              {transportOptions.map((option) => <option key={option}>{option}</option>)}
                            </select>
                          </label>
                          <label className="text-xs text-cyan-100/80">
                            Verified fare paid (optional)
                            <input className="input mt-1" type="text" inputMode="decimal" pattern="[0-9]*([.][0-9]+)?" placeholder="Enter fare after checking" value={verifiedFares[day.day] || ''} onChange={(event) => setVerifiedFare(day.day, event.target.value.replace(/[^\d.]/g, ''))} />
                          </label>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-cyan-100/70">
                            {day.transport.notes} Availability: {day.transport.availabilityStatus}.
                            {day.transport.mode === 'Train' ? ' Check live availability on IRCTC before booking.' : ''}
                          </p>
                          {day.transport.bookingUrl && (
                            day.transport.mode === 'Train' ? (
                              <a href={day.transport.bookingUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-cyan-300 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-950 hover:bg-cyan-200">
                                Check availability on IRCTC
                              </a>
                            ) : (
                              <a href={day.transport.bookingUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-cyan-300 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-950 hover:bg-cyan-200">
                                {day.transport.mode === 'Bus' ? 'Check bus fare on RedBus' : 'Check route'}
                              </a>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-5 flex items-center gap-3 rounded-xl border border-sky-800/40 bg-sky-950/20 px-4 py-3 text-xs">
                      <CloudSun className="text-sky-400" size={18} />
                      {weatherLoading && !weatherByPlace[day.place] ? (
                        <span className="text-slate-400">Loading live weather...</span>
                      ) : weatherByPlace[day.place] ? (
                        <span className="text-slate-300">Forecast for {day.place}: <strong className="text-white">{weatherByPlace[day.place].temp}°C, {weatherByPlace[day.place].description}</strong> · {weatherByPlace[day.place].humidity}% humidity · {weatherByPlace[day.place].windSpeed} km/h wind</span>
                      ) : (
                        <span className="text-slate-500">Weather unavailable for this stop.</span>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <InfoStrip label="Travel" value={`${day.travelDistanceKm || '—'} km · ${day.estimatedTravelTime || 'Time unavailable'}`} />
                      <InfoStrip label="Entry fees" value={day.entryFees || 'Price not available — verify before visiting.'} />
                      <InfoStrip label="Food" value={day.food || 'Food information unavailable — verify locally.'} />
                      <InfoStrip label="Stay" value={day.recommendedAccommodation || 'Accommodation unavailable — verify before booking.'} />
                    </div>
                    <a className="mt-3 inline-block text-xs text-amber-300 underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/${encodeURIComponent(`food near ${day.place}`)}`}>
                      Check nearby food options
                    </a>
                    <p className="mt-3 rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-200">
                      Safety: {day.safety || 'Follow local signs and destination staff instructions.'}
                    </p>

                  </div>

                </motion.div>
              ))}

            </div>

            <TripCostEstimate
              costEstimate={itinerary.costEstimate}
              travelers={form.travelers}
              budgetStatus={itinerary.budgetStatus}
              budgetRecommendation={itinerary.budgetRecommendation}
            />

            <div className="mt-8 rounded-3xl border border-slate-800 bg-[#0b1326] p-6">
              <h3 className="text-lg font-bold text-white">Before you travel checklist</h3>
              <p className="mt-1 text-xs text-slate-400">Confirm these items before departure. Checked items are saved for this planner session.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  ['transport', 'Confirm transport fare, route, and availability'],
                  ['stay', 'Confirm hotel or homestay reservation and check-in time'],
                  ['guide', 'Confirm guide availability and meeting point'],
                  ['documents', 'Carry identity documents, tickets, and booking confirmations'],
                  ['weather', 'Check the latest weather and destination opening hours'],
                  ['medical', 'Pack medicines, essentials, and accessibility equipment']
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
                    <input type="checkbox" checked={Boolean(checklist[key])} onChange={(event) => setChecklist((current) => ({ ...current, [key]: event.target.checked }))} className="h-4 w-4 accent-amber-400" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-amber-400/20 bg-amber-400/5 p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-bold text-lg">Adapt this itinerary</h3>
                  <p className="mt-1 text-xs text-slate-400">Choose a change and BirsaAI will regenerate the route using your current preferences.</p>
                </div>
                {generating && <span className="text-xs font-semibold text-amber-300">Updating your journey...</span>}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ['regenerate', '↻ Regenerate'],
                  ['cheaper', '💰 Make it cheaper'],
                  ['nature', '🌿 Add more nature'],
                  ['wildlife', '🐘 Add more wildlife'],
                  ['culture', '🏛 Add cultural places'],
                  ['relaxed', '😌 Make it relaxed'],
                  ['less-travel', '🚗 Reduce travelling'],
                  ['family', '👨‍👩‍👧 Family friendly'],
                  ['weather', '🌧 Adjust for weather']
                ].map(([action, label]) => (
                  <button
                    key={action}
                    type="button"
                    disabled={generating}
                    onClick={() => action === 'regenerate' ? generateItinerary() : adaptItinerary(action)}
                    className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-left text-xs font-semibold text-slate-200 transition hover:border-amber-400 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* TRIP INTELLIGENCE */}
            <div className="grid md:grid-cols-2 gap-5 mt-8">

              <div className="bg-[#0b1326] border border-slate-800 rounded-3xl p-6">

                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="text-amber-400" />
                  <h3 className="font-bold">
                    Why BirsaAI chose this plan
                  </h3>
                </div>

                <ul className="space-y-3 text-sm text-slate-400">

                  <li className="flex gap-3">
                    <Check className="text-amber-400 shrink-0" size={17} />
                    Designed around your {form.style.toLowerCase()} travel style.
                  </li>

                  <li className="flex gap-3">
                    <Check className="text-amber-400 shrink-0" size={17} />
                    Keeps your estimated spending near{" "}
                    {formatCurrency(form.budget)}.
                  </li>

                  <li className="flex gap-3">
                    <Check className="text-amber-400 shrink-0" size={17} />
                    Balances sightseeing with your selected trip pace.
                  </li>

                  <li className="flex gap-3">
                    <Check className="text-amber-400 shrink-0" size={17} />
                    Prioritizes the destinations you selected.
                  </li>

                </ul>

              </div>

              <div className="bg-[#0b1326] border border-slate-800 rounded-3xl p-6">

                <div className="flex items-center gap-3 mb-4">
                  <Hotel className="text-amber-400" />
                  <h3 className="font-bold">
                    Your travel profile
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">

                  <ProfileItem
                    label="Stay"
                    value={form.accommodation}
                  />

                  <ProfileItem
                    label="Transport"
                    value={form.transport}
                  />

                  <ProfileItem
                    label="Food"
                    value={form.food}
                  />

                  <ProfileItem
                    label="Travel Pace"
                    value={form.pace}
                  />

                </div>

              </div>

            </div>

            {/* SMART CONTRACT ESCROW BOOKING NOTIFICATION & CONFIRMATION */}
            {bookingSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 p-7 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-[#0b1326] to-slate-900 border border-emerald-500/40 shadow-2xl space-y-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <ShieldCheck size={26} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                        Smart Contract Escrow Locked
                      </span>
                      <span className="text-xs text-slate-400 font-mono">Status: 200 OK</span>
                    </div>
                    <h3 className="text-xl font-serif font-bold text-white mt-1">
                      Itinerary Successfully Booked & Secured!
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Your funds of <strong className="text-amber-400">₹{bookingSuccess.total_amount?.toLocaleString('en-IN')}</strong> are locked inside the decentralized Escrow contract. Payout to certified local guides is triggered only upon confirmed completion of your journey.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 font-mono text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Booking Reference ID</span>
                    <strong className="text-amber-400 text-sm">{bookingSuccess.id}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Escrow State</span>
                    <span className="text-emerald-400 font-bold uppercase">{bookingSuccess.escrow_status || 'LOCKED'}</span>
                  </div>
                  <div className="md:col-span-2 truncate">
                    <span className="text-slate-500 text-[10px] block uppercase">Smart Contract Address</span>
                    <span className="text-slate-300 text-[11px] select-all">{bookingSuccess.contract_address}</span>
                  </div>
                  <div className="md:col-span-2 truncate">
                    <span className="text-slate-500 text-[10px] block uppercase">Cryptographic Escrow Tx Hash</span>
                    <span className="text-emerald-400 text-[11px] select-all">{bookingSuccess.contract_tx_hash}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    to="/tourist"
                    className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                  >
                    <span>View in Tourist Dashboard</span>
                    <ArrowRight size={14} />
                  </Link>
                  <Link
                    to="/verify"
                    className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white font-semibold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                  >
                    <span>Verify on Blockchain Ledger</span>
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </motion.div>
            )}

            {bookingError && (
              <div className="mt-4 p-4 rounded-xl bg-red-950/30 border border-red-800 text-xs text-red-300 text-center">
                {bookingError}
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">

              {!bookingSuccess && (
                <button
                  type="button"
                  onClick={handleBookItinerary}
                  disabled={bookingLoading}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
                >
                  {bookingLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Securing Escrow on Blockchain...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Book This Itinerary (Smart Contract Escrow)</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={resetPlanner}
                className="w-full sm:w-auto px-6 py-4 rounded-2xl border border-slate-700 text-slate-300 hover:border-amber-400 hover:text-amber-400 transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider font-semibold cursor-pointer"
              >
                <RotateCcw size={16} />
                <span>Plan Another Journey</span>
              </button>

            </div>

          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

export class PlannerErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <div className="rounded-3xl border border-red-800 bg-red-950/30 p-8">
            <h2 className="text-xl font-bold text-red-200">The journey could not be displayed</h2>
            <p className="mt-3 text-sm text-red-300">{this.state.error.message || 'Unexpected planner display error.'}</p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-6 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------------------------ */
/* SMALL REUSABLE COMPONENTS */
/* ------------------------------------------------ */

function StepHeading({ icon, title, description }) {
  return (
    <div>
      <div className="flex items-center gap-3 text-amber-400 mb-3">
        {icon}
        <span className="text-xs uppercase tracking-[0.2em] font-semibold">
          BirsaAI Planner
        </span>
      </div>

      <h2 className="text-2xl md:text-3xl font-serif font-bold">
        {title}
      </h2>

      <p className="text-slate-400 mt-2 text-sm md:text-base">
        {description}
      </p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-6">
      <label className="block text-xs uppercase tracking-widest text-slate-500 mb-3">
        {label}
      </label>
      {children}
    </div>
  );
}

function Choice({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-xl border text-sm transition ${
        active
          ? "border-amber-400 bg-amber-400/10 text-amber-300"
          : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

function NextButton({ onClick }) {
  return (
    <div className="flex justify-end mt-10">
      <button
        type="button"
        onClick={onClick}
        className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold flex items-center gap-2 hover:scale-[1.02] transition"
      >
        Continue
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-6 py-3.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition flex items-center gap-2"
    >
      <ArrowLeft size={18} />
      Back
    </button>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="bg-[#0b1326] border border-slate-800 rounded-2xl p-5">
      <div className="text-amber-400 mb-3">{icon}</div>

      <p className="text-xs uppercase tracking-widest text-slate-500">
        {label}
      </p>

      <p className="text-lg font-bold text-white mt-1">
        {value}
      </p>
    </div>
  );
}

function TripCostEstimate({ costEstimate, travelers, budgetStatus, budgetRecommendation }) {
  if (!costEstimate) return null;
  const isOverBudget = Number(costEstimate.remaining) < 0;
  const calculatedRecommendation = isOverBudget
    ? `Estimated costs exceed the budget by ${formatCurrency(Math.abs(Number(costEstimate.remaining) || 0))}. Consider Bus, fewer destinations, or a lower-cost stay.`
    : 'Estimated costs are within the selected budget. Verify live fares and prices before booking.';
  const rows = [
    ['Transportation', costEstimate.transportation, costEstimate.statuses?.transportation],
    ['Accommodation', costEstimate.accommodation, costEstimate.statuses?.accommodation],
    ['Food', costEstimate.food, costEstimate.statuses?.food],
    ['Entry Fees', costEstimate.entryFees, costEstimate.statuses?.entryFees],
    ['Activities', costEstimate.activities, costEstimate.statuses?.activities],
    ['Parking / Local Travel', costEstimate.parkingLocalTravel, costEstimate.statuses?.parkingLocalTravel]
  ];
  return (
    <section className="mb-8 rounded-3xl border border-slate-800 bg-[#0b1326] p-6 md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="flex items-center gap-3 text-xl font-bold"><Wallet className="text-amber-400" /> Trip Cost Estimate</h3>
          <p className="mt-1 text-xs text-slate-500">Transport is estimated until you enter a fare verified with the external provider.</p>
        </div>
        <div className="flex gap-3 text-[10px] uppercase tracking-wider">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">Confirmed</span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-300">Estimated</span>
        </div>
      </div>
      <div className="mt-6 divide-y divide-slate-800">
        {rows.map(([label, value, status]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
            <span className="text-slate-300">{label}</span>
            <span className="text-right">
              <strong className="text-white">{formatCurrency(value)}</strong>
              <span className={`ml-2 text-[10px] uppercase tracking-wider ${status === 'confirmed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {status || 'estimated'}
              </span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 border-t border-slate-700 pt-5 sm:grid-cols-3">
        <CostTotal label="Estimated Total" value={costEstimate.estimatedTotal} />
        <CostTotal label="Budget" value={costEstimate.budget} />
        <CostTotal label="Remaining" value={costEstimate.remaining} positive={costEstimate.remaining >= 0} />
      </div>
      <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-slate-200">
        Cost per person: <strong className="text-amber-300">{formatCurrency(costEstimate.costPerPerson)}</strong>
        <span className="ml-2 text-xs text-slate-500">({travelers} traveler{travelers === 1 ? '' : 's'})</span>
      </div>
      <div className={`mt-4 rounded-xl border px-4 py-3 text-xs ${isOverBudget ? 'border-red-500/30 bg-red-950/30 text-red-200' : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'}`}>
        <strong>{isOverBudget ? 'Budget warning: ' : 'Budget check: '}</strong>
        {calculatedRecommendation}
      </div>
    </section>
  );
}

function TransportPlanSection({ transportPlan }) {
  const intercity = Array.isArray(transportPlan?.intercity)
    ? transportPlan.intercity
    : [];
  const localTransport = Array.isArray(transportPlan?.localTransport)
    ? transportPlan.localTransport
    : transportPlan?.localTransport
      ? [transportPlan.localTransport]
      : [];
  const journeys = [
    ...intercity,
    ...localTransport
  ];
  if (journeys.length === 0) return null;

  return (
    <section className="mb-8 rounded-3xl border border-slate-800 bg-[#0b1326] p-6 md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="flex items-center gap-3 text-xl font-bold">
            <Car className="text-amber-400" /> Transport Plan
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Live fares and seat availability are never assumed. Check the external provider before booking.
          </p>
        </div>
        <span className="text-sm font-semibold text-amber-300">
          Estimated total: {formatCurrency(transportPlan.estimatedTotalTransportCost || 0)}
        </span>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {journeys.map((journey, index) => (
          <TransportCard key={`${journey.from}-${journey.to}-${index}`} journey={journey} />
        ))}
      </div>
    </section>
  );
}

function TransportCard({ journey }) {
  const mode = String(journey.mode || '').toLowerCase();
  const icon = mode.includes('train') ? '🚆' : mode.includes('bus') ? '🚌' : mode.includes('walk') ? '🚶' : mode.includes('auto') ? '🛺' : mode.includes('taxi') || mode.includes('cab') ? '🚕' : '🚗';
  const bookingLabel = journey.bookingType === 'train' ? 'Check Train' : journey.bookingType === 'bus' ? 'Check Bus' : 'Check Route';
  const bookingUrl = journey.bookingUrl;
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Movement</p>
          <h4 className="mt-1 text-base font-bold text-white">{journey.from} <span className="text-amber-400">→</span> {journey.to}</h4>
        </div>
        <span className="text-2xl" aria-hidden="true">{icon}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <InfoStrip label="Mode" value={journey.mode || 'Let AI decide'} />
        <InfoStrip label="Distance" value={journey.distance || (journey.distanceKm ? `${journey.distanceKm} km` : 'Unavailable')} />
        <InfoStrip label="Duration" value={journey.duration || (journey.durationHours ? `${journey.durationHours} hours` : 'Verify before travel')} />
        <InfoStrip label="Cost" value={journey.estimatedCost || (journey.estimatedCost !== undefined ? formatCurrency(journey.estimatedCost) : 'Check current fare')} />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-400">{journey.notes || 'Travel details require verification before departure.'}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-wider text-amber-300">{journey.availabilityStatus || 'Availability not checked'}</span>
        {bookingUrl && (
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-amber-400 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-300">
            {bookingLabel}
          </a>
        )}
      </div>
    </article>
  );
}

function CostTotal({ label, value, positive = true }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${positive ? 'text-white' : 'text-red-300'}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function TimelineCard({ title, text, icon }) {
  const palette = {
    Morning: 'border-orange-400/30 bg-orange-400/5 text-orange-200',
    Afternoon: 'border-emerald-400/30 bg-emerald-400/5 text-emerald-200',
    Evening: 'border-indigo-400/30 bg-indigo-400/5 text-indigo-200'
  }[title] || 'border-slate-800 bg-slate-950/70 text-slate-200';
  return (
    <div className={`rounded-2xl border p-5 ${palette}`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">{icon}</span>
          <span className="text-xs uppercase tracking-widest font-bold">{title}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider opacity-60">Plan</span>
      </div>
      <p className="text-sm leading-7 text-slate-200">
        {text}
      </p>
    </div>
  );
}

function InfoStrip({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-300">{value}</p>
    </div>
  );
}

function ProfileItem({ label, value }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-600">
        {label}
      </p>

      <p className="text-sm text-slate-300 mt-1">
        {value}
      </p>
    </div>
  );
}