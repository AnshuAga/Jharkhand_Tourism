import { db } from '../database/db.js';

export const arvrService = {
  /**
   * Returns available 360° VR immersive tours
   */
  getVRTours() {
    return [
      {
        id: "vr-hundru",
        title: "Hundru Falls 360° Cascades",
        category: "Waterfall & Canyon",
        district: "Ranchi",
        panoramaUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2000&q=90",
        audioNarration: "Welcome to Hundru Falls, where the Subarnarekha River falls over 320 feet into a granite amphitheater. Feel the mist as water pounds into the natural reservoir below.",
        hotspots: [
          { pitch: 5, yaw: -20, label: "Main Waterfall Drop", text: "322-foot plunge point fed by the Subarnarekha river." },
          { pitch: -10, yaw: 45, label: "Granite Plunge Pool", text: "Deep emerald natural pool with lifeguards on duty." },
          { pitch: 0, yaw: 120, label: "Sal Forest Canopy Trail", text: "Trail connecting directly to local tribal souvenir stalls." }
        ],
        liveData: { crowd: "Moderate (35%)", weather: "26°C Sunny", currentWaterLevel: "High" }
      },
      {
        id: "vr-betla",
        title: "Betla National Park 360° Safari & Fort",
        category: "Wildlife & Ancient Stronghold",
        district: "Latehar",
        panoramaUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=90",
        audioNarration: "You are standing near the 16th-century Palamu Fort inside Betla National Park. Listen carefully for alarm calls of spotted deer and the trumpeting of Asian elephants.",
        hotspots: [
          { pitch: 12, yaw: 10, label: "16th-Century Chero Dynasty Fort", text: "Ancient masonry stronghold built by Maharaja Medini Ray." },
          { pitch: -5, yaw: -60, label: "Waterhole Observation Tower", text: "Prime vantage point for spotting tigers and gaurs." }
        ],
        liveData: { crowd: "Low (15%)", weather: "28°C Clear", safariStatus: "Open (Next batch 2:30 PM)" }
      },
      {
        id: "vr-baidyanath",
        title: "Baba Baidyanath Jyotirlinga Dham 360°",
        category: "Sacred Spiritual Shrine",
        district: "Deoghar",
        panoramaUrl: "https://images.unsplash.com/photo-1621699765101-f1873fb2a1d4?auto=format&fit=crop&w=2000&q=90",
        audioNarration: "Baba Baidyanath Temple is one of the 12 sacred Jyotirlingas in India. Millions of pilgrims come here carrying holy Ganga water during the sacred Shravani Mela.",
        hotspots: [
          { pitch: 20, yaw: 0, label: "Golden Panchashula Spire", text: "Unique five-pointed trident spire crowning the temple sanctum." },
          { pitch: -8, yaw: 85, label: "Shivganga Sacred Pond", text: "Holy waters where pilgrims take ritual cleansing baths." }
        ],
        liveData: { crowd: "High (82%)", weather: "29°C Humid", queueTime: "~25 mins" }
      },
      {
        id: "vr-netarhat",
        title: "Netarhat Magnolia Point 360° Sunset",
        category: "Hill Station Panoramic Plateau",
        district: "Latehar",
        panoramaUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2000&q=90",
        audioNarration: "Stand atop the Queen of Chotanagpur at Magnolia Point as the evening sun bathes the pine-forested Koel River valley in molten amber light.",
        hotspots: [
          { pitch: 2, yaw: -15, label: "Sunset Observation Deck", text: "Direct west-facing precipice overlooking the Vindhyan valley." },
          { pitch: -10, yaw: 150, label: "Colonial Pine Grove", text: "Historic British pine plantation planted in the early 1900s." }
        ],
        liveData: { crowd: "Moderate (40%)", weather: "21°C Breezy", sunsetTime: "17:52 IST" }
      }
    ];
  },

  /**
   * Returns AR marker specs & dynamic data bindings
   */
  getARLandmarks() {
    const featuredLandmarks = [
      {
        landmarkId: "AR-HUNDRU-01",
        name: "Hundru Gorge Feature Tracker",
        markerType: "Natural Landmark & QR Plate",
        coordinates: { lat: 23.4475, lng: 85.6567 },
        overlayTitle: "Subarnarekha Geological Formation",
        historicalFacts: "Erosion of the Chotanagpur granite gneiss plateau formed this hanging valley over 50 million years ago.",
        model3d: "waterfall_simulation_v1.glb",
        culturalPerformance: "Karam Festival Folk Dance Preview (Chhau)",
        ticketPrice: "₹30 per adult",
        crowdLevel: "35% capacity"
      },
      {
        landmarkId: "AR-PALAMU-02",
        name: "Palamu Fort Gate AR Target",
        markerType: "Architecture Feature Point",
        coordinates: { lat: 23.8864, lng: 84.1906 },
        overlayTitle: "Nagpuri Gate of Chero Kings",
        historicalFacts: "Constructed by Maharaja Medini Ray with Islamic Mughal-influenced stone carvings and secret escape tunnels.",
        model3d: "palamu_fort_reconstructed.glb",
        culturalPerformance: "Tribal Drumming & Flute Anthem",
        ticketPrice: "₹25 (Reserve Entry Included)",
        crowdLevel: "18% capacity"
      }
    ];

    const featuredNames = new Set(featuredLandmarks.map((landmark) => landmark.name));
    const destinationLandmarks = db.destinations.list().filter((destination) => !featuredNames.has(destination.name)).map((destination) => ({
      landmarkId: `AR-${destination.id.toUpperCase()}`,
      name: destination.name,
      markerType: 'Destination GPS & Street Map Marker',
      coordinates: { lat: destination.lat, lng: destination.lng },
      overlayTitle: destination.title || destination.category,
      historicalFacts: destination.description,
      model3d: null,
      culturalPerformance: (destination.activities || [])[0] || 'Local heritage experience',
      ticketPrice: destination.ticket_info || 'See destination details',
      crowdLevel: destination.crowd_level || 'Information available on site'
    }));

    return [...featuredLandmarks, ...destinationLandmarks];
  }
};
