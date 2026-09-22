import React, { useRef, useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Eye,
  Camera,
  Volume2,
  VolumeX,
  Compass,
  Users,
  Sun,
  ShieldCheck,
  ChevronRight,
  Maximize2,
  MapPin
} from 'lucide-react';

/*
 * YouTube video IDs supplied for the Jharkhand tourism VR experiences.
 */
const YOUTUBE_VIDEOS = {
  hundru: 'qTr1BFMie_Y',
  betla: '1IVfz-1OtD0',
  baidyanath: 'e6-N7-Ae8f0',
  netarhat: 'B3lJzO4kCy0'
};

/*
 * Gets the correct YouTube video for a VR tour.
 * It first checks whether the backend already provides a YouTube ID/URL,
 * then matches the tour by its name/title/district.
 */
const getYoutubeId = (tour) => {
  if (tour?.youtubeId) {
    return tour.youtubeId;
  }

  if (tour?.youtubeUrl) {
    const match = tour.youtubeUrl.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/
    );

    if (match?.[1]) {
      return match[1];
    }
  }

  const text = `
    ${tour?.id || ''}
    ${tour?.title || ''}
    ${tour?.name || ''}
    ${tour?.district || ''}
    ${tour?.category || ''}
  `.toLowerCase();

  if (text.includes('hundru') || text.includes('hundroo')) {
    return YOUTUBE_VIDEOS.hundru;
  }

  if (text.includes('betla')) {
    return YOUTUBE_VIDEOS.betla;
  }

  if (
    text.includes('baidyanath') ||
    text.includes('baba baidyanath') ||
    text.includes('deoghar') ||
    text.includes('jyotirlinga')
  ) {
    return YOUTUBE_VIDEOS.baidyanath;
  }

  if (text.includes('netarhat')) {
    return YOUTUBE_VIDEOS.netarhat;
  }

  return null;
};

export default function ARVRExperience() {
  const [data, setData] = useState(null);
  const [selectedTour, setSelectedTour] = useState(null);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('vr'); // 'vr' | 'ar'
  const [selectedAR, setSelectedAR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllLandmarks, setShowAllLandmarks] = useState(false);
  const viewerRef = useRef(null);

  const loadExperiences = async () => {
    setLoading(true);
    setError('');

    try {
      const [res, destinationsResponse] = await Promise.all([
        api.arvr.getExperiences(),
        api.destinations.getAll()
      ]);

      if (res.success) {
        const existingLandmarks = res.arLandmarks || [];

        const existingNames = new Set(
          existingLandmarks.map((landmark) => landmark.name)
        );

        const destinationLandmarks = (destinationsResponse.data || [])
          .filter((destination) => !existingNames.has(destination.name))
          .map((destination) => ({
            landmarkId: `AR-${destination.id.toUpperCase()}`,
            name: destination.name,
            markerType: 'Destination GPS & Street Map Marker',
            coordinates: {
              lat: destination.lat,
              lng: destination.lng
            },
            overlayTitle: destination.title || destination.category,
            historicalFacts: destination.description,
            model3d: null,
            culturalPerformance:
              destination.activities?.[0] || 'Local heritage experience',
            ticketPrice:
              destination.ticket_info || 'See destination details',
            crowdLevel:
              destination.crowd_level ||
              'Information available on site'
          }));

        const mergedLandmarks = [
          ...existingLandmarks,
          ...destinationLandmarks
        ];

        /*
         * ONLY VR TOUR DATA IS MODIFIED HERE.
         * AR landmark data remains exactly as before.
         */
        const updatedVRTours = (res.vrTours || []).map((tour) => ({
          ...tour,
          youtubeId: getYoutubeId(tour)
        }));

        setData({
          ...res,
          vrTours: updatedVRTours,
          arLandmarks: mergedLandmarks
        });

        if (updatedVRTours.length > 0) {
          setSelectedTour(updatedVRTours[0]);
        }

        if (mergedLandmarks.length > 0) {
          setSelectedAR(mergedLandmarks[0]);
        }
      }
    } catch (err) {
      setError(
        err.message || 'Unable to load immersive experiences.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExperiences();

    return () => window.speechSynthesis?.cancel();
  }, []);

  const toggleAudioGuide = () => {
    if (audioPlaying) {
      window.speechSynthesis?.cancel();
      setAudioPlaying(false);
      return;
    }

    if (
      !selectedTour?.audioNarration ||
      !window.speechSynthesis
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const narration = new SpeechSynthesisUtterance(
      selectedTour.audioNarration
    );

    narration.onend = () => setAudioPlaying(false);

    window.speechSynthesis.speak(narration);
    setAudioPlaying(true);
  };

  const openViewerFullscreen = () => {
    if (viewerRef.current?.requestFullscreen) {
      viewerRef.current.requestFullscreen();
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pt-32 pb-24 px-6 md:px-16 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-400/20 bg-amber-400/5 text-amber-400 text-xs font-semibold uppercase tracking-widest">
            <Eye size={14} />
            Immersive WebXR & Three.js Engine
          </div>

          <h1 className="text-4xl md:text-6xl font-serif">
            AR/VR Sovereign Tourism
          </h1>

          <p className="text-slate-300 font-light text-base">
            Virtually step into Jharkhand’s roaring waterfalls, misty
            plateaus, and ancient sacred sanctums with 360° panoramic
            scenes and augmented reality overlays.
          </p>

          {/* Mode Tabs */}
          <div className="inline-flex p-1.5 rounded-full bg-[#0b1326] border border-slate-800 mt-4">
            <button
              onClick={() => setActiveTab('vr')}
              className={`px-6 py-2 rounded-full text-xs uppercase tracking-widest font-semibold transition ${
                activeTab === 'vr'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              360° Virtual Reality (VR)
            </button>

            <button
              onClick={() => setActiveTab('ar')}
              className={`px-6 py-2 rounded-full text-xs uppercase tracking-widest font-semibold transition ${
                activeTab === 'ar'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Augmented Reality (AR) Overlays
            </button>
          </div>
        </div>

        {loading && (
          <div className="rounded-3xl border border-slate-800 bg-[#0b1326] p-12 text-center text-sm text-slate-400">
            Loading immersive experiences...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-800/60 bg-red-950/20 p-8 text-center text-sm text-red-300">
            <p>{error}</p>

            <button
              onClick={loadExperiences}
              className="mt-4 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950"
            >
              Retry
            </button>
          </div>
        )}

        {/* VR Section */}
        {!loading &&
          !error &&
          activeTab === 'vr' &&
          selectedTour && (
            <div className="space-y-8">

              {/* Tour selector pills */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {(data?.vrTours || []).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTour(t);
                      setActiveHotspot(null);
                    }}
                    className={`px-5 py-2.5 rounded-full text-xs font-semibold transition ${
                      selectedTour.id === t.id
                        ? 'bg-amber-400 text-slate-950 shadow-lg'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {t.title.split('360°')[0]}
                  </button>
                ))}
              </div>

              {/* VR YouTube Viewer */}
              <div
                ref={viewerRef}
                className="relative aspect-[16/9] md:aspect-[21/9] rounded-3xl overflow-hidden border border-slate-700/60 shadow-2xl bg-slate-950 group"
              >

                {selectedTour.youtubeId ? (
                  <iframe
                    key={selectedTour.youtubeId}
                    src={`https://www.youtube-nocookie.com/embed/${selectedTour.youtubeId}?rel=0&controls=1&playsinline=1`}
                    title={selectedTour.title}
                    className="absolute inset-0 w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                    <div className="text-center">
                      <Camera
                        size={40}
                        className="mx-auto mb-4 text-slate-600"
                      />

                      <p className="text-slate-300 font-semibold">
                        Video unavailable
                      </p>

                      <p className="text-xs text-slate-500 mt-2">
                        No YouTube video is configured for this tour.
                      </p>
                    </div>
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                {/* Hotspot markers */}
                {selectedTour.hotspots?.map((hs, i) => (
                  <div
                    key={i}
                    style={{
                      top: `${45 + hs.pitch * 1.5}%`,
                      left: `${50 + hs.yaw * 0.35}%`
                    }}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                  >
                    <button
                      onClick={() =>
                        setActiveHotspot(
                          activeHotspot === hs ? null : hs
                        )
                      }
                      className="w-9 h-9 rounded-full bg-amber-400/90 text-slate-950 font-bold flex items-center justify-center shadow-2xl border-2 border-white hover:scale-125 transition animate-pulse"
                    >
                      ✦
                    </button>
                  </div>
                ))}

                {/* Top overlay info */}
                <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10 pointer-events-none">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur border border-slate-700 text-amber-400 text-[10px] uppercase tracking-widest font-bold">
                      360° Immersive Panoramic View
                    </span>

                    <span className="text-xs text-slate-300 hidden sm:inline">
                      District:{' '}
                      <strong className="text-white">
                        {selectedTour.district}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pointer-events-auto">
                    <button
                      onClick={toggleAudioGuide}
                      className="p-2.5 rounded-full bg-black/60 backdrop-blur border border-slate-700 text-amber-400 hover:text-white transition flex items-center gap-2 text-xs"
                    >
                      {audioPlaying ? (
                        <Volume2 size={16} />
                      ) : (
                        <VolumeX size={16} />
                      )}

                      <span className="hidden md:inline">
                        {audioPlaying
                          ? 'Audio Guide Playing'
                          : 'Play Audio Guide'}
                      </span>
                    </button>

                    <button
                      onClick={openViewerFullscreen}
                      title="Open immersive view"
                      className="p-2.5 rounded-full bg-black/60 backdrop-blur border border-slate-700 text-amber-400 hover:text-white transition"
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Hotspot details popover */}
                {activeHotspot && (
                  <div className="absolute top-20 right-6 z-30 max-w-xs p-5 rounded-2xl bg-[#0b1326]/95 border border-amber-400/50 backdrop-blur-xl shadow-2xl space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-amber-400 font-bold tracking-wider">
                        Point of Interest
                      </span>

                      <button
                        onClick={() => setActiveHotspot(null)}
                        className="text-slate-400 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>

                    <h4 className="text-sm font-bold text-white">
                      {activeHotspot.label}
                    </h4>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {activeHotspot.text}
                    </p>
                  </div>
                )}

                {/* Bottom bar */}
                <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 pointer-events-none">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-serif font-bold text-white">
                      {selectedTour.title}
                    </h3>

                    <p className="text-xs text-slate-300 mt-1">
                      {selectedTour.category}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 uppercase text-[9px] block">
                        Live Crowd
                      </span>

                      <span className="text-amber-400 font-bold">
                        {selectedTour.liveData?.crowd}
                      </span>
                    </div>

                    <div className="w-[1px] h-6 bg-slate-800" />

                    <div>
                      <span className="text-slate-500 uppercase text-[9px] block">
                        Weather
                      </span>

                      <span className="text-white font-bold">
                        {selectedTour.liveData?.weather}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct YouTube fallback/access link */}
              {selectedTour.youtubeId && (
                <div className="flex justify-center">
                  <a
                    href={`https://www.youtube.com/watch?v=${selectedTour.youtubeId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 text-xs font-semibold text-slate-300 hover:border-amber-400 hover:text-amber-300 transition"
                  >
                    <Camera size={15} />
                    Watch directly on YouTube
                  </a>
                </div>
              )}

              {/* Audio Guide Transcript */}
              <div className="p-6 rounded-3xl bg-[#0b1326] border border-slate-800 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0">
                  <Volume2 size={20} />
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">
                    Audio Guide Narration
                  </h4>

                  <p className="text-xs text-slate-300 italic leading-relaxed">
                    "{selectedTour.audioNarration}"
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* AR Section */}
        {!loading && !error && activeTab === 'ar' && (
          <div className="space-y-8">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h2 className="text-2xl font-serif font-bold">
                Augmented Reality Landmark Overlay Engine
              </h2>

              <p className="text-xs text-slate-400">
                Select a destination to anchor its AR information to real GPS coordinates, inspect the street map, and navigate to the physical landmark.
              </p>
            </div>

            <div className="mb-5 flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0b1326] px-5 py-4 text-xs">
              <span className="text-slate-400">
                {(data?.arLandmarks || []).length} destinations available for AR location overlays.
              </span>

              <span className="text-emerald-400">
                Select a card to inspect its map position
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {(showAllLandmarks
                ? data?.arLandmarks || []
                : (data?.arLandmarks || []).slice(0, 4)
              ).map((landmark) => (
                <button
                  key={landmark.landmarkId}
                  type="button"
                  onClick={() => setSelectedAR(landmark)}
                  className={`w-full p-8 rounded-3xl bg-[#0b1326] border text-left space-y-6 transition ${
                    selectedAR?.landmarkId === landmark.landmarkId
                      ? 'border-amber-400 shadow-lg shadow-amber-400/10'
                      : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-amber-400 font-bold">
                      {landmark.landmarkId}
                    </span>

                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                      {landmark.markerType}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-2xl font-serif font-bold text-white">
                      {landmark.name}
                    </h3>

                    <p className="text-xs text-amber-400 mt-1">
                      {landmark.overlayTitle}
                    </p>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                    {landmark.historicalFacts}
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#070b14] border border-slate-800">
                      <span className="text-slate-500 uppercase text-[10px] block">
                        Cultural Display
                      </span>

                      <span className="text-white font-medium">
                        {landmark.culturalPerformance}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#070b14] border border-slate-800">
                      <span className="text-slate-500 uppercase text-[10px] block">
                        Entry Pricing
                      </span>

                      <span className="text-amber-400 font-bold">
                        {landmark.ticketPrice}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>
                      GPS: {landmark.coordinates.lat},{' '}
                      {landmark.coordinates.lng}
                    </span>

                    <span className="text-emerald-400">
                      Target Tracked ✓
                    </span>
                  </div>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${landmark.coordinates.lat},${landmark.coordinates.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 py-2.5 text-xs font-semibold text-slate-300 hover:border-amber-400 hover:text-amber-300"
                  >
                    <Compass size={14} />
                    Navigate to landmark
                  </a>
                </button>
              ))}
            </div>

            {(data?.arLandmarks || []).length > 4 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() =>
                    setShowAllLandmarks((current) => !current)
                  }
                  className="rounded-xl border border-amber-400/40 px-5 py-3 text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-400/10"
                >
                  {showAllLandmarks
                    ? 'Show fewer places'
                    : `View more places ${
                        data.arLandmarks.length - 4
                      }`}
                </button>
              </div>
            )}

            {selectedAR && (
              <div className="overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1326]">
                <div className="p-6">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-widest">
                    <Compass size={15} />
                    Street map anchor
                  </div>

                  <h3 className="mt-2 text-xl font-serif font-bold text-white">
                    {selectedAR.name}
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    This map anchors the AR overlay to the landmark's real GPS position.
                  </p>
                </div>

                <iframe
                  title={`${selectedAR.name} street map`}
                  className="h-80 w-full border-0"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                    selectedAR.coordinates.lng - 0.12
                  }%2C${
                    selectedAR.coordinates.lat - 0.12
                  }%2C${
                    selectedAR.coordinates.lng + 0.12
                  }%2C${
                    selectedAR.coordinates.lat + 0.12
                  }&layer=mapnik&marker=${
                    selectedAR.coordinates.lat
                  }%2C${selectedAR.coordinates.lng}`}
                />

                <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 p-5">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${selectedAR.name}, Jharkhand`
                    )}&query_place_id=`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-xs font-semibold text-slate-300 hover:border-amber-400 hover:text-amber-300"
                  >
                    <MapPin size={15} />
                    Open exact tourist place
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}