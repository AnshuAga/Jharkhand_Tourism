import React from 'react';
import { Star } from 'lucide-react';

export default function Testimonials() {
  const reviews = [
    { quote: "The luxury travel packages through Netarhat were breathtaking. Knowing our payments were protected via smart contracts gave us absolute peace of mind.", author: "Aarav Sharma", role: "Tech Entrepreneur & Explorer" },
    { quote: "An absolute masterclass in UI design and travel engineering. The AI itinerary builder mapped out our exact preferences with incredible local accuracy.", author: "Priya Venkat", role: "Architect & Frequent Traveler" },
    { quote: "The tribal art workshops and private helicopter transfers made this the most exclusive trip of our lives. Exceptional attention to detail.", author: "Vikramaditya Roy", role: "Conservationist & Author" }
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pt-32 pb-24 px-6 md:px-16 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <div className="max-w-7xl mx-auto space-y-16">
        
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-amber-400 text-xs uppercase tracking-[0.3em] font-semibold">Global Reviews</span>
          <h1 className="text-5xl md:text-6xl font-serif">Words From Our Elite Travelers</h1>
          <p className="text-slate-300 font-light text-lg">Read feedback from discerning explorers who experienced our sovereign tourism ecosystem.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reviews.map((t, idx) => (
            <div key={idx} className="p-10 rounded-2xl bg-[#0b1326]/60 border border-slate-800 space-y-6 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex space-x-1 text-amber-400">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400" />)}
                </div>
                <p className="text-slate-300 font-serif italic text-lg leading-relaxed">"{t.quote}"</p>
              </div>
              <div className="pt-6 border-t border-slate-800">
                <h4 className="font-semibold text-white">{t.author}</h4>
                <p className="text-xs text-amber-400 uppercase tracking-widest mt-1">{t.role}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}