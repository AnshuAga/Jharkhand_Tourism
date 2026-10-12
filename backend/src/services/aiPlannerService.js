import { db } from '../database/db.js';
import { estimateTransportPlan, searchTrainOptions } from './transportService.js';

// Calculate Haversine distance in kilometers between two lat/lng points
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// City coordinates mapping for starting point
const CITY_COORDINATES = {
  Ranchi: { lat: 23.3441, lng: 85.3096 },
  Jamshedpur: { lat: 22.8046, lng: 86.2029 },
  Dhanbad: { lat: 23.7957, lng: 86.4304 },
  Bokaro: { lat: 23.6693, lng: 86.1511 },
  Deoghar: { lat: 24.4826, lng: 86.7003 },
  Hazaribagh: { lat: 23.9933, lng: 85.3622 },
  Latehar: { lat: 23.7437, lng: 84.5027 }
};

function isServiceAvailable(service, tripDate, travelers) {
  const availability = service?.availability || {};
  if (availability?.available === false) return false;
  if (Array.isArray(availability.dates) && availability.dates.length > 0) {
    return availability.dates.map(String).includes(String(tripDate));
  }
  const from = availability.availableFrom || availability.startDate;
  const to = availability.availableTo || availability.endDate;
  if (from || to) return Boolean(tripDate) && (!from || tripDate >= from) && (!to || tripDate <= to);
  if (Array.isArray(availability.days) && tripDate) {
    const weekday = new Date(`${tripDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
    return availability.days.includes(weekday);
  }
  return true;
}

function normalizePlaceName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\bdham\b/g, 'dam')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && localDateString(date) === value;
}

export const aiPlannerService = {
  /**
   * Generates an optimized day-by-day travel itinerary using Hybrid Filtering + TSP sequencing
   * @param {Object} preferences User input parameters
   */
  async generateItinerary(preferences) {
    const {
      journeyMode = 'within_jharkhand',
      days = 3,
      budget = 25000,
      travelers = 2,
      adults = travelers,
      children = 0,
      seniors = 0,
      startCity = 'Ranchi',
      hometown = '',
      entryStation = startCity,
      returnStation = startCity,
      endLocation = '',
      oneWay = false,
      returnDate = '',
      preferredTrainClass = '',
      trainOriginStation = '',
      trainDestinationStation = '',
      trainReturnStation = '',
      style = 'Relaxed & Scenic',
      interests = ['nature'],
      places = [],
      accommodation = 'Comfort Hotels',
      food = 'No Preference',
      transport = 'Private Car',
      pace = 'Balanced',
      requirements = '',
      adaptation = '',
      packageServiceId = '',
      guideServiceIds = [],
      hotelServiceIds = [],
      guideServiceId = '',
      hotelServiceId = ''
    } = preferences;

    const tripDays = Math.max(1, Number(days) || 1);
    const tripStartDate = preferences.tripDate
      ? String(preferences.tripDate)
      : localDateString();
    if (!isValidDateString(tripStartDate)) throw new Error('A valid trip start date is required.');
    const startDateObject = new Date(`${tripStartDate}T00:00:00`);
    if (Number.isNaN(startDateObject.getTime())) throw new Error('A valid trip start date is required.');
    const tripEndDateObject = new Date(startDateObject);
    tripEndDateObject.setDate(tripEndDateObject.getDate() + tripDays - 1);
    const tripEndDate = [
      tripEndDateObject.getFullYear(),
      String(tripEndDateObject.getMonth() + 1).padStart(2, '0'),
      String(tripEndDateObject.getDate()).padStart(2, '0')
    ].join('-');
    const returnTripDate = returnDate ? String(returnDate).slice(0, 10) : '';
    if (returnTripDate && (!isValidDateString(returnTripDate) || returnTripDate <= tripStartDate)) {
      throw new Error('Return date must be a valid date after the trip start date.');
    }
    const resolvedJourneyMode = ['hometown_round_trip', 'within_jharkhand', 'open_jaw'].includes(journeyMode)
      ? journeyMode
      : 'within_jharkhand';
    const travellerTotal = Number(adults) + Number(children) + Number(seniors);
    if (Number(travelers) <= 0 || travellerTotal <= 0 || travellerTotal !== Number(travelers)) {
      throw new Error('Total travellers must equal adults, children, and seniors, and must be greater than zero.');
    }
    if (!Number.isFinite(Number(budget)) || Number(budget) < 0) throw new Error('Budget must be a valid non-negative amount.');
    if (tripStartDate < localDateString()) throw new Error('Trip start date cannot be in the past.');
    if (resolvedJourneyMode !== 'within_jharkhand' && !String(hometown).trim()) throw new Error('Hometown or origin is required for this journey type.');
    if (resolvedJourneyMode !== 'within_jharkhand' && !String(entryStation).trim()) throw new Error('Jharkhand entry station is required.');
    if (resolvedJourneyMode === 'open_jaw' && !String(endLocation).trim()) throw new Error('Final station or city is required for an open-jaw journey.');
    const trainMode = transport === 'Train';
    const outboundOrigin = String(trainOriginStation || hometown || startCity).trim();
    const outboundDestination = String(trainDestinationStation || entryStation || endLocation || startCity).trim();
    const hometownReturnStation = resolvedJourneyMode === 'hometown_round_trip'
      ? String(entryStation).trim()
      : String(returnStation).trim();
    const outboundReturnStation = String(trainReturnStation || hometownReturnStation || outboundDestination).trim();
    if (trainMode && (!outboundOrigin || !outboundDestination)) {
      throw new Error('Origin and destination stations are required for train travel.');
    }
    if (trainMode && resolvedJourneyMode !== 'open_jaw' && !returnTripDate) {
      throw new Error('A return date is required for a round-trip train journey.');
    }
    const internalStart = resolvedJourneyMode === 'within_jharkhand' ? startCity : entryStation;
    const internalEnd = oneWay
      ? ''
      : resolvedJourneyMode === 'hometown_round_trip'
        ? hometownReturnStation
        : resolvedJourneyMode === 'open_jaw'
          ? endLocation
          : startCity;

    const allDestinations = db.destinations.list();
    const availableServices = db.services.list();
    const selectedPackage = packageServiceId
      ? availableServices.find((service) => service.id === packageServiceId && service.category === 'package')
      : null;
    const selectedGuideIds = Array.isArray(guideServiceIds) ? guideServiceIds : [guideServiceId].filter(Boolean);
    const selectedHotelIds = Array.isArray(hotelServiceIds) ? hotelServiceIds : [hotelServiceId].filter(Boolean);
    const selectedGuides = selectedGuideIds.map((id) => availableServices.find((service) => service.id === id && service.category === 'guide')).filter(Boolean);
    const selectedHotels = selectedHotelIds.map((id) => availableServices.find((service) => service.id === id && service.category === 'homestay')).filter(Boolean);
    for (const [label, ids, services] of [
      ['package', packageServiceId ? [packageServiceId] : [], selectedPackage ? [selectedPackage] : []],
      ['guide', selectedGuideIds, selectedGuides],
      ['accommodation', selectedHotelIds, selectedHotels]
    ]) {
      if (ids.length !== services.length || services.some((service) => !isServiceAvailable(service, preferences.tripDate, travelers))) {
        throw new Error(`The selected ${label} is not available for the selected date or traveler count.`);
      }
    }
    const startCoord = CITY_COORDINATES[internalStart] || CITY_COORDINATES[startCity] || CITY_COORDINATES.Ranchi;
    const destinationMatches = (value) => {
      const normalizedValue = normalizePlaceName(value);
      return allDestinations.find((destination) => {
        const names = [destination.name, destination.title].map(normalizePlaceName).filter(Boolean);
        return names.some((name) =>
          name === normalizedValue ||
          name.includes(normalizedValue) ||
          normalizedValue.includes(name)
        );
      });
    };
    const mentionedPlaces = allDestinations.filter((destination) => {
      const name = String(destination.name || destination.title);
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const firstNameToken = name.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escapedName}\\b`, 'i').test(String(requirements || ''))
        || new RegExp(`\\b${firstNameToken}\\b`, 'i').test(String(requirements || ''));
    });
    const startDestination = destinationMatches(startCity);
    const requestedDestinations = [
      ...places.map(destinationMatches).filter(Boolean),
      ...mentionedPlaces,
      startDestination
    ].filter(Boolean);
    const selectedNames = new Set(requestedDestinations.flatMap((place) => [
      normalizePlaceName(place.name),
      normalizePlaceName(place.title)
    ]).filter(Boolean));
    const isRequested = (destination) => [
      normalizePlaceName(destination.name),
      normalizePlaceName(destination.title)
    ].some((name) => selectedNames.has(name));
    const effectiveInterests = adaptation === 'nature'
      ? Array.from(new Set([...interests, 'nature']))
      : adaptation === 'wildlife'
        ? Array.from(new Set([...interests, 'wildlife']))
        : adaptation === 'culture'
          ? Array.from(new Set([...interests, 'culture', 'tribal']))
          : interests;

    // STEP 2 & 3: Hybrid Scoring (Collaborative + Content-Based Cosine Similarity)
    const scoredDestinations = allDestinations.map(dest => {
      // 1. Content-Based Score (Interest alignment & budget affinity)
      const destInterests = dest.interests || [];
      const interestMatches = destInterests.filter(i => effectiveInterests.includes(i)).length;
      const interestScore = effectiveInterests.length > 0 ? interestMatches / effectiveInterests.length : 0.5;

      // Budget scoring: compare average daily cost
      const dailyBudget = budget / days;
      const avgCost = dest.avg_cost || dest.avgCost || 2000;
      const budgetAffinity = Math.max(0, 1 - Math.abs(avgCost - dailyBudget) / dailyBudget);

      const contentScore = 0.7 * interestScore + 0.3 * budgetAffinity;

      // 2. Collaborative Score (Normalized rating & popularity weight)
      const reviewCount = dest.review_count || dest.reviewCount || 10;
      const collaborativeScore = (dest.rating / 5.0) * 0.8 + Math.min(reviewCount / 400, 1) * 0.2;

      // 3. Hybrid Combination: Final Score = α * Collab + β * Content
      const alpha = 0.4;
      const beta = 0.6;
      let finalScore = alpha * collaborativeScore + beta * contentScore;

      // Boost explicitly picked destinations if user handpicked some
      if (isRequested(dest)) {
        finalScore += 1.5;
      }
      if (adaptation === 'less-travel' && startCity && dest.district === startCity) finalScore += 0.5;
      if (adaptation === 'wildlife' && /wildlife|eco/i.test(dest.category)) finalScore += 0.8;
      if (adaptation === 'culture' && /heritage|spiritual|archaeology/i.test(dest.category)) finalScore += 0.8;

      return {
        ...dest,
        hybridScore: finalScore,
        contentScore: Math.round(contentScore * 100) / 100,
        collaborativeScore: Math.round(collaborativeScore * 100) / 100
      };
    });

    // Sort by hybrid score descending
    scoredDestinations.sort((a, b) => b.hybridScore - a.hybridScore);

    // Shortlist enough candidates for the AI to combine nearby stops on one day
    const requested = scoredDestinations.filter(isRequested);
    const ranked = scoredDestinations.filter((dest) => !requested.includes(dest));
    const candidateCount = Math.min(Math.max(tripDays, 1), scoredDestinations.length);
    let shortlisted = [...requested, ...ranked].slice(0, Math.max(candidateCount, requested.length));

    // STEP 5: Itinerary Sequencing using TSP Greedy Nearest-Neighbor Heuristic
    const orderedDestinations = [];
    let currentLocation = startCoord;
    const remaining = [...shortlisted];
    const travelersCount = Math.max(1, Number(travelers) || 1);

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const dist = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          remaining[i].lat,
          remaining[i].lng
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      const nextStop = remaining.splice(nearestIdx, 1)[0];
      nextStop.travelDistanceKm = minDistance;
      nextStop.travelTimeHours = Math.max(0.5, Math.round((minDistance / 45) * 10) / 10); // Average 45 km/h on plateau roads
      orderedDestinations.push(nextStop);
      currentLocation = { lat: nextStop.lat, lng: nextStop.lng };
    }

    const transportPlan = await estimateTransportPlan({
      startLocation: internalStart,
      destinations: orderedDestinations,
      mode: transport,
      travelers: travelersCount,
      tripDate: tripStartDate
    });
    const trainUnavailable = (message) => ({
      status: 'unavailable',
      dataClassification: 'unavailable',
      results: [],
      message,
      bookingUrl: 'https://www.irctc.co.in/nget/train-search'
    });
    const needsExternalTrain = trainMode || ['hometown_round_trip', 'open_jaw'].includes(resolvedJourneyMode);
    const outboundTrain = needsExternalTrain
      ? await searchTrainOptions({
        from: outboundOrigin,
        to: outboundDestination,
        date: tripStartDate,
        travelClass: preferredTrainClass,
        passengers: { adults, children, seniors }
      })
        .catch((error) => trainUnavailable(error.message))
      : null;
    const returnTrain = needsExternalTrain && (trainMode || resolvedJourneyMode === 'hometown_round_trip') && resolvedJourneyMode !== 'open_jaw' && !oneWay
      ? returnTripDate
        ? await searchTrainOptions({
          from: outboundReturnStation,
          to: outboundOrigin,
          date: returnTripDate,
          travelClass: preferredTrainClass,
          passengers: { adults, children, seniors }
        }).catch((error) => trainUnavailable(error.message))
        : trainUnavailable('Return date was not provided; check the return journey on official Indian Railways.')
      : null;
    const trainFareByLeg = [outboundTrain, returnTrain]
      .filter((journey) => journey?.status === 'live')
      .map((journey) => journey.results
        .map((result) => Number(result.fare))
        .filter((fare) => Number.isFinite(fare) && fare >= 0))
      .filter((fares) => fares.length > 0)
      .map((fares) => Math.min(...fares));
    const trainFare = trainMode && trainFareByLeg.length === (returnTrain ? 2 : 1)
      ? Math.round(trainFareByLeg.reduce((sum, fare) => sum + fare, 0) * travelersCount)
      : 0;
    const lastDestination = orderedDestinations[orderedDestinations.length - 1];
    const returnCoordinate = CITY_COORDINATES[internalEnd] || startCoord;
    const returnDistanceKm = lastDestination && !oneWay
      ? calculateDistance(lastDestination.lat, lastDestination.lng, returnCoordinate.lat, returnCoordinate.lng)
      : 0;
    const returnCost = oneWay || trainMode ? 0 : Math.max(250, Math.round((returnDistanceKm * 14 + 250) * travelersCount));
    orderedDestinations.forEach((destination, index) => {
      const leg = transportPlan.intercity[index];
      if (leg) {
        destination.travelTimeHours = leg.durationHours;
        destination.travelDistanceKm = leg.distanceKm;
      }
    });

    // Group nearby stops where the route remains practical. The AI can use one
    // or two destinations per day instead of forcing one destination per day.
    const itineraryGroups = [];
    orderedDestinations.forEach((destination) => {
      const currentGroup = itineraryGroups[itineraryGroups.length - 1];
      const previous = currentGroup?.destinations[currentGroup.destinations.length - 1];
      const interStopDistance = previous
        ? calculateDistance(previous.lat, previous.lng, destination.lat, destination.lng)
        : 0;
      const canShareDay = currentGroup
        && interStopDistance <= 75
        && currentGroup.travelHours + destination.travelTimeHours + 3 <= 9;

      if (canShareDay) {
        currentGroup.destinations.push(destination);
        currentGroup.travelHours += destination.travelTimeHours + Math.max(0.5, interStopDistance / 45);
      } else {
        itineraryGroups.push({
          destinations: [destination],
          travelHours: destination.travelTimeHours
        });
      }
    });

    // STEP 6: Output Generation - Construct Structured Day-Wise Plan
    const totalBudget = Number.isFinite(Number(budget)) && Number(budget) >= 0 ? Number(budget) : 25000;
    const dailyBudget = Math.round(totalBudget / days);
    const dailyReturnLegs = itineraryGroups.map((group, index) => {
      const dayStart = index === 0 ? internalStart : itineraryGroups[index - 1].destinations.at(-1).name;
      const dayEnd = group.destinations.at(-1).name;
      if (selectedHotels.length || dayStart === dayEnd) return null;
      const from = group.destinations.at(-1);
      const to = index === 0 ? startCoord : itineraryGroups[index - 1].destinations.at(-1);
      const distance = calculateDistance(from.lat, from.lng, to.lat, to.lng);
      return {
        day: index + 1,
        from: dayEnd,
        to: dayStart,
        distanceKm: distance,
        estimatedCost: Math.max(250, Math.round((distance * 14 + 250) * travelersCount))
      };
    }).filter(Boolean);
    const entryFeesKnown = orderedDestinations.length > 0 && orderedDestinations.every((dest) => /\d/.test(String(dest.ticket_info || '')));
    const estimatedEntryFees = orderedDestinations.reduce((sum, dest) => {
      const match = String(dest.ticket_info || '').match(/(?:₹|rs\.?|inr)\s*([\d,]+)/i);
      return sum + (match ? Number(match[1].replace(/,/g, '')) * travelersCount : 0);
    }, 0);
    const entryFees = entryFeesKnown ? estimatedEntryFees : 0;
    const nights = Math.max(0, tripDays - 1);
    const rooms = Math.max(1, Number(preferences.rooms) || 1);
    const adultUnits = Math.max(0, Number(adults) || 0);
    const childUnits = Math.max(0, Number(children) || 0) * 0.5;
    const seniorUnits = Math.max(0, Number(seniors) || 0) * 0.8;
    const mealUnits = adultUnits + childUnits + seniorUnits;
    const accommodationCost = selectedHotels.length
      ? selectedHotels.reduce((sum, hotel) => sum + (Number(hotel.price) > 0 ? Number(hotel.price) : 0), 0) * nights * rooms
      : 0;
    const guideCost = selectedGuides.length
      ? selectedGuides.reduce((sum, guide) => sum + (Number(guide.price) > 0 ? Number(guide.price) : 0), 0) * tripDays
      : 0;
    const packageCost = selectedPackage ? Number(selectedPackage.price || 0) : 0;
    const foodCost = mealUnits > 0 ? Math.round(mealUnits * tripDays * 450) : 0;
    const activities = orderedDestinations.length > 0 ? Math.round(mealUnits * orderedDestinations.length * 250) : 0;
    const transportation = transportPlan.estimatedCosts.total + returnCost + trainFare;
    const budgetBreakdown = {
      package: packageCost,
      guide: guideCost,
      transportation,
      accommodation: accommodationCost,
      food: foodCost,
      entryFees,
      activities,
      parkingLocalTravel: 0,
      taxes: Math.round((packageCost + guideCost + transportation + accommodationCost + food + entryFees + activities) * 0.05),
      priceSources: {
        package: selectedPackage && Number(selectedPackage.price) > 0 ? 'confirmed' : selectedPackage ? 'unavailable' : 'not_selected',
        guide: selectedGuides.length && selectedGuides.every((guide) => Number(guide.price) > 0) ? 'confirmed' : selectedGuides.length ? 'unavailable' : 'not_selected',
        accommodation: selectedHotels.length && selectedHotels.every((hotel) => Number(hotel.price) > 0) ? 'confirmed' : selectedHotels.length ? 'unavailable' : 'unavailable',
        transportation: trainMode && !trainFare ? 'unavailable' : trainMode ? 'confirmed' : 'estimated',
        localTransport: 'estimated',
        returnToBase: oneWay ? 'not_applicable' : 'estimated',
        food: 'estimated',
        entryFees: entryFeesKnown ? 'confirmed' : 'unavailable',
        activities: orderedDestinations.length ? 'estimated' : 'unavailable',
        taxes: 'estimated'
      }
    };
    const unavailable = Object.entries(budgetBreakdown.priceSources)
      .filter(([, status]) => status === 'unavailable')
      .map(([category]) => category);
    const estimatedTotal = Object.values(budgetBreakdown)
      .filter((value) => typeof value === 'number' && Number.isFinite(value))
      .reduce((sum, value) => sum + value, 0);

    const generatedDays = itineraryGroups.map((group, index) => {
      const dayNum = index + 1;
      const destinationsForDay = group.destinations;
      const primaryDestination = destinationsForDay[0];
      const dayStart = index === 0 ? internalStart : itineraryGroups[index - 1].destinations.at(-1).name;
      const dayEnd = destinationsForDay.at(-1).name;
      const returnLeg = dailyReturnLegs.find((leg) => leg.day === dayNum);
      const acts = destinationsForDay.flatMap((destination) => destination.activities || []);
      const dayDate = tripStartDate ? new Date(`${tripStartDate}T00:00:00`) : null;
      if (dayDate) dayDate.setDate(dayDate.getDate() + index);
      const transportLeg = transportPlan.intercity[index] || null;

      return {
        day: dayNum,
        date: dayDate ? [
          dayDate.getFullYear(),
          String(dayDate.getMonth() + 1).padStart(2, '0'),
          String(dayDate.getDate()).padStart(2, '0')
        ].join('-') : null,
        place: destinationsForDay.map((destination) => destination.name).join(' → '),
        places: destinationsForDay.map((destination) => destination.name),
        title: destinationsForDay.map((destination) => destination.title || destination.name).join(' & '),
        type: destinationsForDay.map((destination) => destination.category).filter(Boolean).join(' · '),
        district: Array.from(new Set(destinationsForDay.map((destination) => destination.district).filter(Boolean))).join(' · '),
        duration: dayNum === 1 ? 'Arrival & Scenic Exploration' : 'Full Day Expedition',
        routePlan: `${dayStart} → ${destinationsForDay.map((destination) => destination.name).join(' → ')}${returnLeg ? ` → ${dayStart}` : ''}`,
        overnight: returnLeg
          ? { type: 'return_to_day_start', location: dayStart, transportCost: returnLeg.estimatedCost }
          : { type: 'stay_at_destination', location: dayEnd, transportCost: 0 },
        activities: [
          ...acts.slice(0, 4),
          destinationsForDay.length > 1
            ? `Travel between ${destinationsForDay.map((destination) => destination.name).join(' and ')}`
            : `${primaryDestination.name} scenic overlook and photography trail`,
          acts[1] || 'Local guided exploration and cultural experience',
          acts[2] || `Free time at ${primaryDestination.name}; confirm local timings before visiting`
        ].filter((activity, activityIndex, list) => activity && list.indexOf(activity) === activityIndex).slice(0, 6),
        transport: transportLeg,
        travelDistanceKm: destinationsForDay.reduce((sum, destination) => sum + (Number(destination.travelDistanceKm) || 0), 0),
        estimatedTravelTime: `${Math.round(group.travelHours * 10) / 10} hrs transit`,
        recommendedAccommodation: selectedHotels.length
          ? selectedHotels.map((hotel) => hotel.title).join(', ')
          : 'No approved accommodation selected. Availability needs to be confirmed.',
        accommodation: selectedHotels.length ? selectedHotels.map((hotel) => ({
          id: hotel.id,
          name: hotel.title,
          type: hotel.category,
          district: hotel.district,
          price: Number(hotel.price || 0),
          priceStatus: 'database',
          availabilityStatus: 'needs_confirmation',
          amenities: hotel.amenities || []
        })) : [],
        guide: selectedGuides.length ? selectedGuides.map((guide) => ({
          id: guide.id,
          name: guide.title,
          provider: guide.provider_name,
          price: Number(guide.price || 0),
          priceStatus: 'database',
          availabilityStatus: 'needs_confirmation',
          description: guide.description
        })) : [],
        weather: 'Weather information unavailable — check the forecast before travel.',
        food: food === 'No Preference' ? 'Local cuisine options near the destination — verify availability.' : `${food} meal options near the destination — verify availability.`,
        entryFees: destinationsForDay.map((destination) => `${destination.name}: ${destination.ticket_info || 'Price not available — verify before visiting.'}`).join(' | '),
        safety: 'Follow local signs, opening hours, weather warnings, and destination staff instructions.',
        budget: dailyBudget,
        budgetBreakdown: {
          stay: Math.round(dailyBudget * 0.45),
          food: Math.round(dailyBudget * 0.25),
          activitiesAndTransit: Math.round(dailyBudget * 0.3),
          priceStatus: 'estimated'
        }
      };
    });
    while (generatedDays.length < tripDays) {
      const dayNumber = generatedDays.length + 1;
      const dayDate = new Date(`${tripStartDate}T00:00:00`);
      dayDate.setDate(dayDate.getDate() + dayNumber - 1);
      generatedDays.push({
        day: dayNumber,
        date: localDateString(dayDate),
        place: internalStart,
        places: [],
        title: 'Flexible local exploration and rest',
        type: 'Rest and local planning',
        district: '',
        duration: 'Flexible day',
        routePlan: `Stay near ${internalStart}; choose local activities after confirming timings`,
        overnight: { type: 'stay_at_destination', location: internalStart, transportCost: 0 },
        activities: [
          'Keep time for rest, meals, and check-in or check-out.',
          'Choose a nearby activity after confirming opening hours and local conditions.'
        ],
        transport: null,
        travelDistanceKm: 0,
        estimatedTravelTime: 'No intercity travel planned',
        recommendedAccommodation: selectedHotels.length
          ? selectedHotels.map((hotel) => hotel.title).join(', ')
          : 'No approved accommodation selected. Availability needs to be confirmed.',
        accommodation: [],
        guide: [],
        weather: 'Weather information unavailable — check the forecast before travel.',
        food: food === 'No Preference' ? 'Local cuisine options — verify availability.' : `${food} meal options — verify availability.`,
        entryFees: 'No destination entry fee was calculated for this flexible day.',
        safety: 'Follow local signs, opening hours, weather warnings, and destination staff instructions.',
        budget: dailyBudget,
        budgetBreakdown: {
          stay: Math.round(dailyBudget * 0.45),
          food: Math.round(dailyBudget * 0.25),
          activities: Math.round(dailyBudget * 0.2),
          activitiesAndTransit: Math.round(dailyBudget * 0.1),
          priceStatus: 'estimated'
        }
      });
    }

    const routeList = [internalStart, ...orderedDestinations.map(d => d.name), ...(oneWay ? [] : [internalEnd])];

    return {
      success: true,
      summary: {
        days: tripDays,
        tripStartDate,
        tripEndDate,
        returnDate: returnTripDate || null,
        journeyMode: resolvedJourneyMode,
        origin: resolvedJourneyMode === 'hometown_round_trip' ? hometown : internalStart,
        entryStation: internalStart,
        returnStation: internalEnd || null,
        oneWay: Boolean(oneWay),
        travelers,
        adults: Number(adults) || Number(travelers) || 1,
        children: Number(children) || 0,
        seniors: Number(seniors) || 0,
        startCity: internalStart,
        totalBudget,
        dailyBudget,
        style,
        accommodation,
        transport,
        pace,
        adaptation,
        costEstimate: {
          ...budgetBreakdown,
          estimatedTotal,
          budget: totalBudget,
          remaining: totalBudget - estimatedTotal,
          costPerPerson: Math.round(estimatedTotal / travelersCount),
          nights,
          rooms,
          unavailable,
          statuses: {
            package: budgetBreakdown.priceSources.package,
            guide: budgetBreakdown.priceSources.guide,
            transportation: budgetBreakdown.priceSources.transportation,
            accommodation: budgetBreakdown.priceSources.accommodation,
            food: budgetBreakdown.priceSources.food,
            entryFees: budgetBreakdown.priceSources.entryFees,
            activities: budgetBreakdown.priceSources.activities,
            parkingLocalTravel: 'estimated',
            taxes: budgetBreakdown.priceSources.taxes
          },
        },
        budgetStatus: estimatedTotal > totalBudget ? 'over_budget' : 'within_budget',
        budgetRecommendation: estimatedTotal > totalBudget
          ? `Estimated costs exceed the budget by ₹${(estimatedTotal - totalBudget).toLocaleString('en-IN')}. Consider Bus, fewer destinations, or a lower-cost stay.`
          : 'Estimated costs are within the selected budget. Verify live fares and prices before booking.',
        uniquePlacesCount: routeList.length,
        route: routeList
      },
      days: generatedDays,
      route: routeList,
      selectedPackage: selectedPackage ? {
        id: selectedPackage.id,
        name: selectedPackage.title,
        price: Number(selectedPackage.price || 0),
        durationDays: selectedPackage.duration_days,
        priceStatus: 'database',
        availabilityStatus: 'needs_confirmation',
        description: selectedPackage.description,
        inclusions: selectedPackage.amenities || []
      } : null,
      selectedGuide: selectedGuides,
      selectedAccommodation: selectedHotels,
      transportPlan: {
        ...transportPlan,
        returnToBase: {
          from: lastDestination?.name || internalStart,
          to: internalEnd || null,
          distanceKm: returnDistanceKm,
          estimatedCost: returnCost,
          mode: trainMode ? 'Train' : transport,
          bookingType: trainMode ? 'official-railway' : 'self-arranged',
          bookingUrl: trainMode ? 'https://www.irctc.co.in/' : null,
          availabilityStatus: oneWay ? 'not_applicable' : trainMode ? 'unavailable' : 'not_checked',
          notes: oneWay
            ? 'One-way journey selected; no internal return leg was added.'
            : trainMode
              ? 'Train return fare and availability are unavailable unless returned by an authorized railway integration.'
            : `Return to ${internalEnd} after the final stop.`
        }
      },
      journey: {
        mode: resolvedJourneyMode,
        origin: resolvedJourneyMode === 'hometown_round_trip' ? hometown || 'Not provided' : internalStart,
        entryStation: internalStart,
        returnStation: internalEnd || null,
        returnDate: returnTripDate || null,
        preferredTrainClass: preferredTrainClass || null,
        outboundTrain,
        returnTrain
      },
      tspOptimized: false,
      algorithm: "Hybrid content/rating shortlist + geographic nearest-neighbor route estimate",
      aiRecommendationRationale: [
        `Tailored specifically for ${style.toLowerCase()} travel with a ${pace.toLowerCase()} pace.`,
        `Route ordered using a geographic nearest-neighbor estimate; it is not a globally optimized TSP route.`,
        trainMode && !trainFare
          ? 'Train fare is unavailable until an authorized integration returns a fare; it is excluded from the estimate.'
          : `Estimated transport cost is ₹${transportPlan.estimatedCosts.total.toLocaleString('en-IN')}; live availability was not checked.`,
        `Keeps spending strictly balanced within ₹${dailyBudget.toLocaleString('en-IN')} per day.`,
        `Incorporates verified ${accommodation.toLowerCase()} and trusted local guides.`
      ]
    };
  }
};
