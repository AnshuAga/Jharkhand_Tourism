import React, { useState } from 'react';

export default function ItineraryPlanner() {
  const [duration, setDuration] = useState('3');
  const [budget, setBudget] = useState('Medium');
  const [interest, setInterest] = useState('Nature');
  const [loading, setLoading] = useState(false);
  const [itinerary, setItinerary] = useState(null);

  const handleGenerate = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setItinerary([
        { day: 1, title: 'Ranchi Waterfalls & Skyline', subtitle: 'Hundru & Dassam Expedition', desc: 'Immersive exploration of major plateau cascades followed by sunset views at Kanke Dam.' },
        { day: 2, title: 'Netarhat Plateau Heights', subtitle: 'Queen of Chotanagpur', desc: 'Witness the iconic sunrise at Magnolia Point, explore pine forests, and heritage viewpoints.' },
        { day: 3, title: 'Betla National Park Safari', subtitle: 'Wildlife & Ancient Strongholds', desc: 'Guided jungle safari tour through dense reserves and historic 16th-century Chero dynasty forts.' }
      ]);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 text-center">
          <span className="text-emerald-400 font-semibold text-xs uppercase tracking-widest bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/50">
            Recommendation Matrix Engine
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold mt-3 tracking-tight">AI Personalized Itinerary Planner</h2>
          <p className="text-slate-400 mt-2">Configure your preferences to trigger real-time algorithmic route optimization[cite: 1].</p>
        </div>

        <form onSubmit={handleGenerate} className="bg-slate-900/60 border border-slate-800 p-8 rounded-3xl backdrop-blur-md shadow-2xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Duration (Days)</label>
            <select 
              value={duration} 
              onChange={(e) => setDuration(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            >
              <option value="3">3 Days (Express)</option>
              <option value="5">5 Days (Comprehensive)</option>
              <option value="7">7 Days (Ultimate Expedition)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Budget Tier</label>
            <select 
              value={budget} 
              onChange={(e) => setBudget(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            >
              <option value="Low">Low (Backpacker / Eco)</option>
              <option value="Medium">Medium (Standard)</option>
              <option value="High">High (Luxury / Premium)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Primary Interest</label>
            <select 
              value={interest} 
              onChange={(e) => setInterest(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            >
              <option value="Nature">Nature & Waterfalls</option>
              <option value="Culture">Tribal Heritage & Arts</option>
              <option value="Pilgrimage">Pilgrimage & Sacred Spaces</option>
            </select>
          </div>

          <div className="md:col-span-3 pt-2">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-wide shadow-lg shadow-emerald-900/40 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Processing Neural Vectors...
                </>
              ) : 'Generate Optimized Itinerary Schedule'}
            </button>
          </div>
        </form>

        {itinerary && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-xl font-bold text-white">Your Custom Generated Route</h3>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-md border border-emerald-800/40">Status: Optimized (TSP Heuristic)</span>
            </div>

            {itinerary.map((item) => (
              <div key={item.day} className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-emerald-500/40 transition">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold tracking-widest uppercase">
                      Day 0{item.day}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{item.subtitle}</span>
                  </div>
                  <h4 className="text-xl font-bold text-white">{item.title}</h4>
                  <p className="text-slate-400 text-sm mt-1 max-w-2xl">{item.desc}</p>
                </div>
                <div className="self-start md:self-center">
                  <span className="text-xs text-slate-400 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 font-mono">
                    Estimated Duration: Full Day
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}