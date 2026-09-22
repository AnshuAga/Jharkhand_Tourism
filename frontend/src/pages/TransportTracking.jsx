import React, { useRef, useState, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../services/api';
import { io } from 'socket.io-client';
import {
  Bus,
  MapPin,
  Navigation,
  AlertTriangle,
  Radio,
  Clock,
  Gauge,
  Compass
} from 'lucide-react';

const DISTRICT_BASES = [
  ['Bokaro', 23.6693, 86.1511], ['Chatra', 24.2065, 84.8705], ['Deoghar', 24.4826, 86.7003],
  ['Dhanbad', 23.7957, 86.4304], ['Dumka', 24.2674, 87.2497], ['East Singhbhum', 22.8046, 86.2029],
  ['Garhwa', 24.1600, 83.8000], ['Giridih', 24.1900, 86.3000], ['Godda', 24.8300, 87.2100],
  ['Gumla', 23.0400, 84.5400], ['Hazaribagh', 23.9933, 85.3622], ['Jamtara', 23.9600, 86.8000],
  ['Khunti', 23.0700, 85.2800], ['Koderma', 24.4700, 85.5900], ['Latehar', 23.7437, 84.5027],
  ['Lohardaga', 23.4400, 84.6800], ['Pakur', 24.6400, 87.8500], ['Palamu', 24.0300, 84.0700],
  ['Ramgarh', 23.6300, 85.5200], ['Ranchi', 23.3441, 85.3096], ['Sahibganj', 25.2400, 87.6500],
  ['Seraikela-Kharsawan', 22.7000, 85.9300], ['Simdega', 22.6200, 84.5200], ['West Singhbhum', 22.5700, 85.8000]
].map(([name, lat, lng]) => ({ name, lat, lng }));

export default function TransportTracking() {
  const [vehicles, setVehicles] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [radius, setRadius] = useState(30);
  const [selectedCity, setSelectedCity] = useState({ name: 'Ranchi', lat: 23.3441, lng: 85.3096 });
  const [nearbyResults, setNearbyResults] = useState(null);
  const [fromCity, setFromCity] = useState('Ranchi');
  const [toCity, setToCity] = useState('Netarhat');
  const [routeResult, setRouteResult] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const routeLineRef = useRef(null);
  const radiusCircleRef = useRef(null);
  const demoIntervalRef = useRef(null);
  const demoProgressRef = useRef(0);

  // Initialize Socket.io connection for real-time telemetry
  useEffect(() => {
    // Initial fetch via HTTP
    api.transport.getLiveVehicles().then(res => {
      if (res.vehicles) setVehicles(res.vehicles);
    }).catch(console.warn);

    api.transport.getAlerts().then(res => {
      if (res.alerts) setAlerts(res.alerts);
    }).catch(console.warn);

    // Connect WebSocket
    const socket = io();
    socket.on('transport:vehicles', (updated) => {
      setVehicles(updated);
    });
    socket.on('transport:alerts', (updated) => {
      setAlerts(updated);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return undefined;
    mapRef.current = L.map(mapContainerRef.current, { zoomControl: true }).setView([selectedCity.lat, selectedCity.lng], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(mapRef.current);
    markersRef.current = L.layerGroup().addTo(mapRef.current);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return undefined;
      markersRef.current.clearLayers();
      routeLineRef.current?.remove();
      radiusCircleRef.current?.remove();
      radiusCircleRef.current = L.circle([selectedCity.lat, selectedCity.lng], {
        radius: radius * 1000,
        color: '#fbbf24',
        weight: 1,
        dashArray: '6 8',
        fillColor: '#fbbf24',
        fillOpacity: 0.04
      }).addTo(mapRef.current);
      const locations = [
        { lat: selectedCity.lat, lng: selectedCity.lng, title: `${selectedCity.name} base location`, kind: 'base' },
        ...(nearbyResults?.destinations || []).map((destination) => ({
          lat: Number(destination.lat),
          lng: Number(destination.lng),
          title: `${destination.name} (${destination.distanceKm} km)`,
          kind: 'destination',
          destination
        })),
        ...vehicles.map((vehicle) => ({
          lat: Number(vehicle.lat),
          lng: Number(vehicle.lng),
          title: `${vehicle.name} - ${vehicle.status}`,
          kind: 'vehicle',
          vehicle
        }))
      ];

      const validLocations = locations.filter((location) => Number.isFinite(location.lat) && Number.isFinite(location.lng));
      const bounds = L.latLngBounds(validLocations.map((location) => [location.lat, location.lng]));
      validLocations.forEach((location) => {
        const marker = L.circleMarker([location.lat, location.lng], {
          radius: location.kind === 'vehicle'
            ? selectedVehicle?.id === location.vehicle?.id ? 13 : 9
            : location.kind === 'base' ? 8 : 7,
          fillColor: location.kind === 'vehicle'
            ? '#34d399'
            : location.kind === 'base'
              ? location.name === selectedCity.name ? '#fbbf24' : '#fb923c'
              : '#94a3b8',
          color: location.kind === 'vehicle' ? '#052e16' : location.kind === 'base' ? '#451a03' : '#475569',
          weight: 2,
          fillOpacity: 1
        }).bindTooltip(location.title).addTo(markersRef.current);
        if (location.kind === 'vehicle') {
          marker.bindPopup(`<strong>${location.vehicle.name}</strong><br>${location.vehicle.route || 'Route unavailable'}<br>Speed: ${location.vehicle.speedKmH || location.vehicle.speed_kmh || 0} km/h`);
          marker.on('click', () => {
            setSelectedVehicle(location.vehicle);
            setSelectedDestination(null);
            mapRef.current?.panTo([location.lat, location.lng]);
          });
        }
        if (location.kind === 'destination') {
          marker.on('click', () => {
            setSelectedDestination(location.destination);
            setSelectedVehicle(null);
            mapRef.current?.panTo([location.lat, location.lng]);
          });
        }
      });
      if (routeResult?.waypoints?.length > 1) {
        routeLineRef.current = L.polyline(
          routeResult.waypoints.map((point) => [Number(point.lat), Number(point.lng)]),
          { color: '#fbbf24', opacity: 0.9, weight: 4 }
        ).addTo(mapRef.current);
      }
      const fitKey = `${selectedCity.name}-${radius}-${nearbyResults?.totalFound || 0}`;
      if (validLocations.length > 1 && mapRef.current._birsaFitKey !== fitKey) {
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
        mapRef.current._birsaFitKey = fitKey;
      }
  }, [selectedCity, nearbyResults, vehicles, routeResult, selectedVehicle, radius]);

  // Fetch nearby attractions when city or radius changes
  useEffect(() => {
    api.transport.getNearby(selectedCity.lat, selectedCity.lng, radius)
      .then(setNearbyResults)
      .catch(console.warn);
  }, [selectedCity, radius]);

  const handleCalculateRoute = async (e) => {
    e.preventDefault();
    try {
      const res = await api.transport.getRoute(fromCity, toCity);
      setRouteResult({
        from: res.from || fromCity,
        to: res.to || toCity,
        routeSource: res.routeSource || res.distanceSource || 'backend route estimate',
        waypoints: res.waypoints || [],
        distanceKm: res.distanceKm,
        estimatedTimeString: res.estimatedTimeString,
        guidance: (res.waypoints || []).map((point) => ({
          instruction: point.instruction,
          distance: point.step ? `${Math.round((res.distanceKm || 0) * point.step / 5)} km` : '',
          duration: ''
        }))
      });
    } catch (err) {
      console.warn(err);
    }
  };

  const openGoogleDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${fromCity}, Jharkhand, India`)}&destination=${encodeURIComponent(`${toCity}, Jharkhand, India`)}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const trackVehicle = (vehicle) => {
    setSelectedVehicle(vehicle);
    setSelectedDestination(null);
    if (mapRef.current && Number.isFinite(Number(vehicle.lat)) && Number.isFinite(Number(vehicle.lng))) {
      mapRef.current.panTo([Number(vehicle.lat), Number(vehicle.lng)]);
      mapRef.current.setZoom(13);
    }
  };

  const selectDestination = (destination) => {
    setSelectedDestination(destination);
    setSelectedVehicle(null);
    if (mapRef.current && Number.isFinite(Number(destination.lat)) && Number.isFinite(Number(destination.lng))) {
      mapRef.current.panTo([Number(destination.lat), Number(destination.lng)]);
      mapRef.current.setZoom(13);
    }
  };

  const planRouteTo = (destination) => {
    setToCity(destination.name);
    setSelectedDestination(destination);
    document.getElementById('route-planner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const [demoRunning, setDemoRunning] = useState(false);
  const [demoError, setDemoError] = useState('');

  useEffect(() => () => {
    if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
  }, []);

  const broadcastDemoPosition = async () => {
    const progress = demoProgressRef.current;
    const start = { lat: 23.3441, lng: 85.3096 };
    const end = { lat: 23.4795, lng: 84.2697 };
    const lat = start.lat + (end.lat - start.lat) * progress;
    const lng = start.lng + (end.lng - start.lng) * progress;
    const payload = {
      vehicleId: 'JH-EV-DEMO',
      name: 'Jharkhand Demo Eco-Bus',
      plate: 'DEMO EV 001',
      route: 'Ranchi Railway Station → Patratu Valley → Netarhat',
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      speedKmH: 35 + Math.round(progress * 10),
      status: 'active',
      nextStop: progress < 0.5 ? 'Patratu Valley' : 'Netarhat Sunrise Point'
    };

    try {
      await api.transport.updateTelemetry(payload);
      const res = await api.transport.getLiveVehicles();
      if (res && res.vehicles) setVehicles(res.vehicles);
      setSelectedVehicle((current) => current?.id === payload.vehicleId
        ? { ...current, ...payload }
        : current);
      demoProgressRef.current = progress >= 1 ? 0 : Number((progress + 0.05).toFixed(2));
      return true;
    } catch (err) {
      setDemoError(`Demo update failed: ${err.message}`);
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
      setDemoRunning(false);
      return false;
    }
  };

  const handleDemoToggle = async () => {
    setDemoError('');
    if (demoRunning) {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
      setDemoRunning(false);
      return;
    }

    demoProgressRef.current = 0;
    setDemoRunning(true);
    const started = await broadcastDemoPosition();
    if (started && !demoIntervalRef.current) {
      demoIntervalRef.current = setInterval(broadcastDemoPosition, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pt-32 pb-24 px-6 md:px-16 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold uppercase tracking-widest mb-3">
              <Radio size={14} className="animate-pulse" />
              LIVE SYSTEM
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold">
              Jharkhand Tourist Transit
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Track tourist transport, discover nearby attractions, and plan routes across Jharkhand.
            </p>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0b1326] border border-slate-800 text-xs font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>{vehicles.length} ACTIVE VEHICLES</span>
            <span className="text-slate-600">•</span>
            <span>{nearbyResults?.totalFound || 0} DESTINATIONS</span>
          </div>
        </div>

        {/* Live map powered by OpenStreetMap and Leaflet */}
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1326]">
          <div className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Live map</span>
              <h2 className="mt-1 text-2xl font-serif font-bold">Jharkhand Transport Network</h2>
              <p className="mt-1 text-xs text-slate-400">Track live buses and safari vehicles, then explore nearby tourism destinations.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> {vehicles.length} live vehicles</span>
              <a href={`https://www.google.com/maps/search/?api=1&query=${selectedCity.lat},${selectedCity.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-amber-400 hover:text-amber-300">
                <MapPin size={14} /> Open in Google Maps
              </a>
            </div>
          </div>
          <div ref={mapContainerRef} className="h-90 w-full bg-slate-950" aria-label="Interactive Jharkhand destinations and transport map" />
          <div className="flex flex-wrap items-center gap-4 border-t border-slate-800 px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Selected location</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-orange-400" />District base ({DISTRICT_BASES.length})</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />Active vehicle</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-slate-400" />Destination</span>
          </div>
          {selectedVehicle && (
            <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-950/60 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Selected live vehicle</p>
                <h3 className="mt-1 text-base font-bold text-white">{selectedVehicle.name}</h3>
                <p className="text-xs text-slate-400">{selectedVehicle.route} · GPS {selectedVehicle.lat}, {selectedVehicle.lng}</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-400">Speed <strong className="text-white">{selectedVehicle.speedKmH || selectedVehicle.speed_kmh || 0} km/h</strong></span>
                <span className="text-amber-400">Next stop: {selectedVehicle.nextStop || 'Route update pending'}</span>
                <button onClick={() => setSelectedVehicle(null)} className="text-slate-500 hover:text-white" aria-label="Close selected vehicle">×</button>
              </div>
            </div>
          )}
          {selectedDestination && (
            <div className="flex flex-col gap-4 border-t border-slate-800 bg-slate-950/60 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">Selected destination</p>
                <h3 className="mt-1 text-base font-bold text-white">{selectedDestination.name}</h3>
                <p className="text-xs text-slate-400">{selectedDestination.district} · {selectedDestination.category || 'Tourist attraction'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => planRouteTo(selectedDestination)} className="rounded-xl bg-amber-400 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-300">Plan Route</button>
                <button type="button" onClick={() => setSelectedDestination(null)} className="rounded-xl border border-slate-700 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:border-amber-400">Close</button>
              </div>
            </div>
          )}
        </section>

        {/* Section 1: Real-Time Active Transit Fleet */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-serif font-bold">Live Tourist Transit</h2>
              <p className="text-xs text-slate-400 mt-1">Registered vehicles reporting telemetry across Jharkhand circuits.</p>
            </div>
            <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
              {vehicles.length} Active Vehicle{vehicles.length === 1 ? '' : 's'}
            </span>
          </div>

          {vehicles.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#0b1326] border border-slate-800 space-y-3">
              <Bus className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-lg font-serif text-slate-200">Live Transport Fleet Offline</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No electric transit units or safari vehicles are currently broadcasting live GPS telemetry. Vehicles will appear here as soon as drivers initiate active shifts.
              </p>
              <button
                onClick={handleDemoToggle}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider hover:bg-amber-300 transition"
              >
                {demoRunning ? 'Stop Vehicle Demo' : 'Start Vehicle Demo'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.map((v) => (
                <div key={v.id} className="p-5 rounded-2xl bg-[#0b1326] border border-slate-800 space-y-3 hover:border-amber-400/40 transition">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold">
                      <Bus size={20} />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                      String(v.status).toLowerCase().includes('active') || String(v.status).toLowerCase().includes('transit')
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : String(v.status).toLowerCase().includes('idle')
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          : 'bg-red-500/10 text-red-300 border-red-500/20'
                    }`}>
                      {v.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif font-bold text-white text-base">{v.name}</h3>
                    <span className="text-[11px] font-mono text-amber-400 block mt-0.5">{v.plate}</span>
                    <p className="text-xs text-slate-400 mt-2 leading-snug">{v.route}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1"><Gauge size={13} /> Speed:</span>
                      <span className="font-mono font-bold text-white">{v.speedKmH} km/h</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1"><Clock size={13} /> Next Stop:</span>
                      <span className="text-amber-400 truncate max-w-37.5">{v.nextStop}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1"><MapPin size={13} /> GPS:</span>
                      <span className="font-mono text-[10px] text-slate-400">{v.lat}, {v.lng}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500">Demo Transit Data</span>
                    <button type="button" onClick={() => trackVehicle(v)} className="rounded-lg border border-amber-400/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-400 hover:text-slate-950">
                      Track on map
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {demoError && <p className="mt-4 rounded-xl border border-red-800/60 bg-red-950/20 p-3 text-xs text-red-300">{demoError}</p>}
          {vehicles.some((vehicle) => vehicle.id === 'JH-EV-DEMO') && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs">
              <span className="text-amber-200">Demo Transit Data is moving along the Ranchi → Netarhat route every 3 seconds.</span>
              <button type="button" onClick={handleDemoToggle} className="font-bold uppercase tracking-wider text-amber-300 hover:text-white">
                {demoRunning ? 'Stop demo' : 'Resume demo'}
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Spatial Discovery & Turn-by-Turn Route Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Spatial Radius Explorer */}
          <div className="lg:col-span-6 bg-[#0b1326] border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">Spatial Query Engine</span>
                <h2 className="text-xl font-serif font-bold mt-1">Discover Attractions Within Radius</h2>
              </div>
              <Compass size={20} className="text-amber-400" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">Base Location</label>
                <select
                  value={selectedCity.name}
                  onChange={(e) => {
                    const base = DISTRICT_BASES.find((location) => location.name === e.target.value) || DISTRICT_BASES[0];
                    setSelectedCity(base);
                    setFromCity(base.name);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                >
                  {DISTRICT_BASES.map((base) => <option key={base.name}>{base.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">
                  Radius: <strong className="text-amber-400">{radius} km</strong>
                </label>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="5"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full mt-2 accent-amber-400"
                />
              </div>
            </div>

            <div className="space-y-3 max-h-75 overflow-y-auto pr-2">
              {(nearbyResults?.destinations || []).map((d) => (
                <div key={d.id} className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <button type="button" onClick={() => selectDestination(d)} className="text-left text-sm font-bold text-white hover:text-amber-300">{d.name}</button>
                    <p className="text-[11px] text-slate-400">{d.category} • {d.district}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-amber-400">{d.distanceKm} km away</span>
                    <span className="text-[10px] text-slate-500 block">~{Math.round((d.distanceKm / 45) * 60)} min drive</span>
                    <button type="button" onClick={() => planRouteTo(d)} className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-amber-300">Plan route</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Turn-by-Turn Route Navigation Calculator */}
          <div id="route-planner" className="lg:col-span-6 self-start bg-[#0b1326] border border-slate-800 rounded-3xl p-6 space-y-5 scroll-mt-32">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">Route Planning & Waypoints</span>
                <h2 className="text-xl font-serif font-bold mt-1">Inter-District Route Calculator</h2>
              </div>
              <Navigation size={20} className="text-amber-400" />
            </div>

            <form onSubmit={handleCalculateRoute} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1">Departure Point</label>
                <select
                  value={fromCity}
                  onChange={(e) => setFromCity(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                >
                  {DISTRICT_BASES.map((base) => <option key={base.name}>{base.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1">Destination</label>
                <select
                  value={toCity}
                  onChange={(e) => setToCity(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option>Netarhat</option>
                  <option>Betla National Park</option>
                  <option>Hundru Falls</option>
                  <option>Parasnath</option>
                  <option>Patratu Valley</option>
                  {(nearbyResults?.destinations || []).map((destination) => <option key={destination.id} value={destination.name}>{destination.name}</option>)}
                </select>
              </div>

              <div className="col-span-2">
                <button
                  type="button"
                  onClick={openGoogleDirections}
                  className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition flex items-center justify-center gap-2"
                >
                  Open Driving Directions in Google Maps
                </button>
              </div>
            </form>

            {routeResult && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-white">{routeResult.from} → {routeResult.to}</span>
                  {routeResult.distanceKm && routeResult.estimatedTimeString ? (
                    <span className="text-xs font-mono text-emerald-400 font-bold">{routeResult.distanceKm} km • {routeResult.estimatedTimeString}</span>
                  ) : (
                    <span className="text-[10px] font-mono text-amber-300">Google route data unavailable</span>
                  )}
                </div>
                {routeResult.distanceKm && routeResult.estimatedTimeString && (
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{routeResult.routeSource}</p>
                )}
                {routeResult.guidance?.length ? (
                  <div className="space-y-1.5 border-b border-slate-800 pb-3">
                    {routeResult.guidance.map((step, index) => (
                      <div key={`${step.instruction}-${index}`} className="flex gap-2 text-[11px] text-slate-300">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-700 text-[9px] text-amber-400">{index + 1}</span>
                        <span>{step.instruction} <strong className="text-slate-500">({step.distance})</strong></span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${fromCity}, Jharkhand, India`)}&destination=${encodeURIComponent(`${toCity}, Jharkhand, India`)}&travelmode=driving`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-[10px] font-bold uppercase tracking-wider text-emerald-300 hover:text-emerald-200"
                >
                  Open driving directions
                </a>
                
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Live Travel Advisories & Alerts */}
        <div className="bg-[#0b1326] border border-slate-800 rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-widest mb-1">
                <AlertTriangle size={14} />
                Real-Time Push Notifications
              </div>
              <h2 className="text-2xl font-serif font-bold">Statewide Tourist Advisories</h2>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400">
                Important travel updates from the Tourism Bureau about road conditions, weather, safety, closures, crowd levels, and route disruptions so tourists can make informed travel decisions.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">Issued by Tourism Bureau</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {alerts.map((alt) => (
              <div
                key={alt.id}
                className={`p-6 rounded-2xl border space-y-3 ${
                  alt.severity === 'Warning'
                    ? 'bg-amber-950/20 border-amber-800/60'
                    : alt.severity === 'Alert'
                    ? 'bg-red-950/20 border-red-800/60'
                    : 'bg-slate-900/50 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    alt.severity === 'Warning' ? 'bg-amber-400/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {alt.type}: {alt.severity}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{new Date(alt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <h3 className="font-bold text-white text-sm">{alt.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{alt.message}</p>
                <span className="text-[10px] font-mono text-amber-400/80 block mt-2">Location: {alt.location}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
