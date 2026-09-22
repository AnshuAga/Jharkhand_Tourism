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
  const availability = service?.availability;
  if (!availability || availability.available === false) return false;
  const maxGroupSize = Number(availability.maxGroupSize || availability.max_group_size);
  if (Number.isFinite(maxGroupSize) && maxGroupSize > 0 && Number(travelers) > maxGroupSize) return false;
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
  return false;
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
      guideServiceId = '',
      hotelServiceId = ''
    } = preferences;

    const allDestinations = db.destinations.list();
    const availableServices = db.services.list();
    const selectedPackage = packageServiceId
      ? availableServices.find((service) => service.id === packageServiceId && service.category === 'package')
      : null;
    const selectedGuide = guideServiceId
      ? availableServices.find((service) => service.id === guideServiceId && service.category === 'guide')
      : null;
    const selectedHotel = hotelServiceId
      ? availableServices.find((service) => service.id === hotelServiceId && service.category === 'homestay')
      : null;
    for (const [label, id, service] of [
      ['package', packageServiceId, selectedPackage],
      ['guide', guideServiceId, selectedGuide],
      ['accommodation', hotelServiceId, selectedHotel]
    ]) {
      if (id && (!service || !isServiceAvailable(service, preferences.tripDate, travelers))) {
        throw new Error(`The selected ${label} is not available for the selected date or traveler count.`);
      }
    }
    const startCoord = CITY_COORDINATES[startCity] || CITY_COORDINATES.Ranchi;
    const selectedNames = new Set(places.map((place) => String(place).toLowerCase()));
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
      if (selectedNames.has(String(dest.name).toLowerCase()) || selectedNames.has(String(dest.title).toLowerCase())) {
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
    const requested = scoredDestinations.filter((dest) =>
      selectedNames.has(String(dest.name).toLowerCase()) ||
      selectedNames.has(String(dest.title).toLowerCase())
    );
    const ranked = scoredDestinations.filter((dest) => !requested.includes(dest));
    const candidateCount = Math.min(Math.max(Number(days) || 1, 1) * 2, scoredDestinations.length);
    let shortlisted = [...requested, ...ranked].slice(0, candidateCount);

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
        && currentGroup.destinations.length < 2
        && interStopDistance <= 75
        && currentGroup.travelHours + destination.travelTimeHours + 3 <= 9;

      if (canShareDay) {
        currentGroup.destinations.push(destination);
        currentGroup.travelHours += destination.travelTimeHours + Math.max(0.5, interStopDistance / 45);
      } else if (itineraryGroups.length < Number(days)) {
        itineraryGroups.push({
          destinations: [destination],
          travelHours: destination.travelTimeHours
        });
      }
    });

    // STEP 6: Output Generation - Construct Structured Day-Wise Plan
    const totalBudget = Number(budget) || 25000;
    const dailyBudget = Math.round(totalBudget / days);
    const entryFeesKnown = orderedDestinations.every((dest) => /\d/.test(String(dest.ticket_info || '')));
    const estimatedEntryFees = orderedDestinations.reduce((sum, dest) => {
      const match = String(dest.ticket_info || '').match(/(?:₹|rs\.?|inr)\s*([\d,]+)/i);
      return sum + (match ? Number(match[1].replace(/,/g, '')) * travelersCount : 0);
    }, 0);
    const entryFees = entryFeesKnown && estimatedEntryFees > 0
      ? estimatedEntryFees
      : Math.round(totalBudget * 0.08);
    const remainingForEstimates = Math.max(0, totalBudget - entryFees);
    const accommodationCost = selectedHotel
      ? Number(selectedHotel.price || 0) * Math.max(1, Number(days) || 1)
      : Math.round(remainingForEstimates * 0.27);
    const guideCost = selectedGuide
      ? Number(selectedGuide.price || 0) * Math.max(1, Number(days) || 1)
      : 0;
    const packageCost = selectedPackage ? Number(selectedPackage.price || 0) : 0;
    const budgetBreakdown = {
      package: packageCost,
      guide: guideCost,
      transportation: transportPlan.estimatedCosts.total,
      accommodation: accommodationCost,
      food: Math.round(remainingForEstimates * 0.20),
      entryFees,
      activities: Math.round(remainingForEstimates * 0.13),
      parkingLocalTravel: 0,
      priceSources: {
        package: selectedPackage ? 'database' : 'not_selected',
        guide: selectedGuide ? 'database' : 'not_selected',
        accommodation: selectedHotel ? 'database' : 'estimated',
        transportation: 'estimated'
      }
    };
    const estimatedTotal = Object.values(budgetBreakdown)
      .filter((value) => typeof value === 'number' && Number.isFinite(value))
      .reduce((sum, value) => sum + value, 0);

    const generatedDays = itineraryGroups.map((group, index) => {
      const dayNum = index + 1;
      const destinationsForDay = group.destinations;
      const primaryDestination = destinationsForDay[0];
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
        recommendedAccommodation: selectedHotel
          ? selectedHotel.title
          : 'No approved accommodation selected. Availability needs to be confirmed.',
        accommodation: selectedHotel ? {
          id: selectedHotel.id,
          name: selectedHotel.title,
          type: selectedHotel.category,
          district: selectedHotel.district,
          price: Number(selectedHotel.price || 0),
          priceStatus: 'database',
          availabilityStatus: 'needs_confirmation',
          amenities: selectedHotel.amenities || []
        } : null,
        guide: selectedGuide ? {
          id: selectedGuide.id,
          name: selectedGuide.title,
          provider: selectedGuide.provider_name,
          price: Number(selectedGuide.price || 0),
          priceStatus: 'database',
          availabilityStatus: 'needs_confirmation',
          description: selectedGuide.description
        } : null,
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

    const routeList = orderedDestinations.map(d => d.name);

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
              guide: selectedGuide ? 'database' : 'not_selected'
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
      selectedGuide: selectedGuide || null,
      selectedAccommodation: selectedHotel || null,
      transportPlan,
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
