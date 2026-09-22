import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Award, Globe2, Compass } from 'lucide-react';
import JonhaImage from "../assets/Jonha-Falls.jpeg";

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pt-32 pb-24 px-6 md:px-16 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <div className="max-w-7xl mx-auto space-y-24">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-amber-400 text-xs uppercase tracking-[0.3em] font-semibold"
          >
            Institutional Heritage
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-serif"
          >
            Architects of Sovereign Tourism
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-300 font-light text-lg leading-relaxed"
          >
            Pioneering the union of raw ecological splendor and immutable blockchain governance across the tribal heartlands of India.
          </motion.p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: Compass, title: "Unspoiled Trails", desc: "Curated paths through deep Sal forests, hidden waterfalls, and ancient plateau sanctuaries." },
            { icon: ShieldCheck, title: "Smart-Contract Escrows", desc: "Absolute fund protection with automated milestone verification for every single excursion." },
            { icon: Award, title: "Verified Indigenous", desc: "Empowering local tribal communities with NFT credentials and certified guide programs." },
            { icon: Globe2, title: "AI-Driven Precision", desc: "Machine learning itineraries crafted uniquely for elite global explorers." }
          ].map((item, idx) => (
            <div key={idx} className="p-8 rounded-2xl bg-[#0b1326]/60 border border-slate-800 space-y-4 hover:border-amber-400/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
                <item.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-serif">{item.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Deep Dive Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center bg-[#0b1326]/30 p-12 rounded-3xl border border-slate-800">
          <div className="lg:col-span-6 space-y-6">
            <span className="text-amber-400 text-xs uppercase tracking-[0.3em] font-semibold">Our Mission</span>
            <h2 className="text-3xl md:text-4xl font-serif">Bridging Heritage and High-Tech Luxury</h2>
            <p className="text-slate-300 font-light leading-relaxed">
              Jharkhand's topography is an untouched masterpiece. Our objective is to present this heritage to the world without compromising its ecological integrity. Through decentralized smart infrastructure and premium concierge services, we ensure sustainable luxury travel at its finest.
            </p>
          </div>
          <div className="lg:col-span-6">
            <div className="aspect-[16/10] rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl">
              <img 
                src={JonhaImage}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}