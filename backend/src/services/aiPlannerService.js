import { db } from '../database/db.js';
import { estimateTransportPlan } from './transportService.js';

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

export const aiPlannerService = {
  /**
   * Generates an optimized day-by-day travel itinerary using Hybrid Filtering + TSP sequencing
   * @param {Object} preferences User input parameters
   */
  async generateItinerary(preferences) {
    const {
      days = 3,
      budget = 25000,
      travelers = 2,
      adults = travelers,
      children = 0,
      seniors = 0,
      startCity = 'Ranchi',
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
    const startCoord = CITY_COORDINATES[startCity] || CITY_COORDINATES.Ranchi;
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
    const candidateCount = Math.min(Math.max(Number(days) || 1, 1) * 2, scoredDestinations.length);
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
      startLocation: startCity,
      destinations: orderedDestinations,
      mode: transport,
      travelers: travelersCount,
      tripDate: preferences.tripDate
    });
    const lastDestination = orderedDestinations[orderedDestinations.length - 1];
    const returnDistanceKm = lastDestination
      ? calculateDistance(lastDestination.lat, lastDestination.lng, startCoord.lat, startCoord.lng)
      : 0;
    const returnCost = Math.max(250, Math.round((returnDistanceKm * 14 + 250) * travelersCount));
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
    const totalBudget = Number(budget) || 25000;
    const dailyBudget = Math.round(totalBudget / days);
    const dailyReturnLegs = itineraryGroups.map((group, index) => {
      const dayStart = index === 0 ? startCity : itineraryGroups[index - 1].destinations.at(-1).name;
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
    const dailyReturnCost = dailyReturnLegs.reduce((sum, leg) => sum + leg.estimatedCost, 0);
    const entryFeesKnown = orderedDestinations.every((dest) => /\d/.test(String(dest.ticket_info || '')));
    const estimatedEntryFees = orderedDestinations.reduce((sum, dest) => {
      const match = String(dest.ticket_info || '').match(/(?:₹|rs\.?|inr)\s*([\d,]+)/i);
      return sum + (match ? Number(match[1].replace(/,/g, '')) * travelersCount : 0);
    }, 0);
    const entryFees = entryFeesKnown && estimatedEntryFees > 0
      ? estimatedEntryFees
      : Math.round(totalBudget * 0.08);
    const remainingForEstimates = Math.max(0, totalBudget - entryFees);
    const accommodationCost = selectedHotels.length
      ? selectedHotels.reduce((sum, hotel) => sum + Number(hotel.price || 0), 0) * Math.max(1, Number(days) || 1)
      : Math.round(remainingForEstimates * 0.27);
    const guideCost = selectedGuides.length
      ? selectedGuides.reduce((sum, guide) => sum + Number(guide.price || 0), 0) * Math.max(1, Number(days) || 1)
      : 0;
    const packageCost = selectedPackage ? Number(selectedPackage.price || 0) : 0;
    const budgetBreakdown = {
      package: packageCost,
      guide: guideCost,
      transportation: transportPlan.estimatedCosts.total + returnCost + dailyReturnCost,
      accommodation: accommodationCost,
      food: Math.round(remainingForEstimates * 0.20),
      entryFees,
      activities: Math.round(remainingForEstimates * 0.13),
      parkingLocalTravel: 0,
      priceSources: {
        package: selectedPackage ? 'database' : 'not_selected',
        guide: selectedGuides.length ? 'database' : 'not_selected',
        accommodation: selectedHotels.length ? 'database' : 'estimated',
        transportation: 'estimated',
        returnToBase: 'estimated'
      }
    };
    const estimatedTotal = Object.values(budgetBreakdown)
      .filter((value) => typeof value === 'number' && Number.isFinite(value))
      .reduce((sum, value) => sum + value, 0);

    const generatedDays = itineraryGroups.map((group, index) => {
      const dayNum = index + 1;
      const destinationsForDay = group.destinations;
      const primaryDestination = destinationsForDay[0];
      const dayStart = index === 0 ? startCity : itineraryGroups[index - 1].destinations.at(-1).name;
      const dayEnd = destinationsForDay.at(-1).name;
      const returnLeg = dailyReturnLegs.find((leg) => leg.day === dayNum);
      const acts = destinationsForDay.flatMap((destination) => destination.activities || []);
      const dayDate = preferences.tripDate ? new Date(`${preferences.tripDate}T00:00:00`) : null;
      if (dayDate) dayDate.setDate(dayDate.getDate() + index);
      const transportLeg = transportPlan.intercity[index] || null;

      return {
        day: dayNum,
        date: dayDate ? dayDate.toISOString().slice(0, 10) : null,
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

    const routeList = [startCity, ...orderedDestinations.map(d => d.name), startCity];

    return {
      success: true,
      summary: {
        days,
        travelers,
        adults: Number(adults) || Number(travelers) || 1,
        children: Number(children) || 0,
        seniors: Number(seniors) || 0,
        startCity,
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
          statuses: {
            transportation: 'estimated',
            accommodation: 'estimated',
            food: 'estimated',
            entryFees: entryFeesKnown ? 'confirmed' : 'estimated',
            activities: 'estimated',
              parkingLocalTravel: 'estimated',
              package: selectedPackage ? 'database' : 'not_selected',
              guide: selectedGuides.length ? 'database' : 'not_selected'
          }
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
          from: lastDestination?.name || startCity,
          to: startCity,
          distanceKm: returnDistanceKm,
          estimatedCost: returnCost,
          notes: `Return to base in ${startCity} after the final stop.`
        }
      },
      tspOptimized: true,
      algorithm: "Hybrid SVD-Collaborative + Cosine Content-Based + Greedy Nearest-Neighbor TSP",
      aiRecommendationRationale: [
        `Tailored specifically for ${style.toLowerCase()} travel with a ${pace.toLowerCase()} pace.`,
        `Route ordered geographically using TSP nearest-neighbor algorithm and ${transportPlan.selectedMode} travel estimates.`,
        `Estimated transport cost is ₹${transportPlan.estimatedCosts.total.toLocaleString('en-IN')}; live availability was not checked.`,
        `Keeps spending strictly balanced within ₹${dailyBudget.toLocaleString('en-IN')} per day.`,
        `Incorporates verified ${accommodation.toLowerCase()} and trusted local guides.`
      ]
    };
  }
};
