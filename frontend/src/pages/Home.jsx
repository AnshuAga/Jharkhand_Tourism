import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import birsaMunda from '../assets/birsa-munda.jpg';
import deogharImage from "../assets/Deoghar-Shrines.jpg";
import BetlaImage from "../assets/Betla-National-Park.jpg";
import {
  Sparkles, 
  MapPin, 
  ShieldCheck, 
  Compass, 
  Globe2, 
  Calendar, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  Star,
  ChevronRight,
  Menu,
  Phone,
  Mail,
  Award,
  Layers,
  Lock
} from 'lucide-react';

export default function JharkhandTourismHome() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('nature');
  const [enquiry, setEnquiry] = useState({ name: '', email: '', message: '' });
  const [enquiryStatus, setEnquiryStatus] = useState({ type: '', message: '' });
  const [isSubmittingEnquiry, setIsSubmittingEnquiry] = useState(false);
  const submitEnquiry = async (event) => {
    event.preventDefault();
    setEnquiryStatus({ type: '', message: '' });
    setIsSubmittingEnquiry(true);

    try {
      const result = await api.enquiries.create(enquiry);
      setEnquiry({ name: '', email: '', message: '' });
      setEnquiryStatus({ type: 'success', message: result.message });
    } catch (error) {
      setEnquiryStatus({ type: 'error', message: error.message });
    } finally {
      setIsSubmittingEnquiry(false);
    }
  };

  const packages = {
    nature: {
      title: "The Nature & Wildlife Trail",
      duration: "4 Days / 3 Nights",
      price: "₹34,500 / person",
      desc: "Immerse yourself in the misty hill stations, cascading waterfalls, and dense Sal forests of Netarhat and Betla National Park.",
      image: BetlaImage,
      highlights: ["Hundru & Jonha Waterfalls Guided Trek", "Betla National Park Exclusive Jeep Safari", "Netarhat Sunrise Experience at Magnolia Point"]
    },
    spiritual: {
      title: "Spiritual & Cultural Heritage Circuit",
      duration: "3 Days / 2 Nights",
      price: "₹28,000 / person",
      desc: "Experience divine tranquility with priority access to sacred shrines and immersive indigenous art explorations across Deoghar and Parasnath.",
      image: deogharImage,
      highlights: ["Baidyanath Temple Priority Smart-Contract Darshan", "Parasnath Hills Heritage & Spiritual Trek", "Santhal & Munda Community Cultural Immersion"]
    },
    luxury: {
      title: "Royal Tribal Luxe Expedition",
      duration: "6 Days / 5 Nights",
      price: "₹65,000 / person",
      desc: "The pinnacle of Jharkhand tourism. Premium accommodations, private helicopter transfers between circuits, and personal curator assistance.",
      image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
      highlights: ["Private Air-conditioned Transit & Chopper Support", "VIP Access to State Cultural Galas", "Master Craftsman Private Workshop Sessions"]
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Luxurious Glassmorphism Floating Navigation */}
    

      {/* Hero Section styled like the Ceebros Reference */}
      <section className="relative min-h-screen flex items-end pb-24 px-6 md:px-16 overflow-hidden">
        {/* Background Image with Cinematic Gradient Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2000&q=90" 
            alt="Jharkhand Landscape" 
            className="w-full h-full object-cover object-center filter brightness-[0.45] contrast-[1.1]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/50 to-transparent" />
        </div>
        
        <div className="max-w-7xl w-full mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-8 space-y-6">
            

            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-6xl md:text-8xl font-serif font-normal tracking-tight leading-[1.05] text-white"
            >
              Land of <br />
              <span className="italic font-light text-amber-100">Forest .</span>
            </motion.h1>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-20 h-[1px] bg-amber-400/60 my-4"
            />

            <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-amber-50 text-xl md:text-2xl font-serif italic max-w-2xl leading-relaxed tracking-wide"
          >
            Where Ancient Tribal Heritage <br />
            Meets Untamed Wilderness.
          </motion.p>
          </div>

          <div className="lg:col-span-4 flex lg:justify-end">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="p-8 rounded-2xl bg-[#0b1326]/80 backdrop-blur-md border border-slate-700/60 space-y-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center space-x-3 text-amber-400">
                <Sparkles className="w-5 h-5" />
                <span className="text-xs uppercase tracking-widest font-semibold">AI Trip Concierge</span>
              </div>
              <h3 className="text-xl font-serif">Plan Your Bespoke Journey</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Let our machine learning engine construct your customized multi-day itinerary through Jharkhand instantly.</p>
              <button 
                onClick={() => navigate('/ai-planner')}
                className="w-full py-3.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <span>Start AI Planning</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-32 bg-[#070b14] border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <span className="text-amber-400 text-xs uppercase tracking-[0.3em] font-semibold">About The Experience</span>
              <h2 className="text-4xl md:text-5xl font-serif leading-tight">Redefining Luxury Tourism Through Innovation</h2>
              <p className="text-slate-300 font-light leading-relaxed">
                Jharkhand holds some of India's best-kept ecological secrets—from the cascading waterfalls of Hundru to the ancient shrines of Deoghar. Our platform marries this untamed beauty with world-class smart contracts, verified indigenous guides, and AI-driven precision.
              </p>
              
              <div className="grid grid-cols-2 gap-6 pt-4">
                <div className="p-6 rounded-2xl bg-[#0b1326]/50 border border-slate-800">
                  <h4 className="text-3xl font-serif text-amber-400 mb-1">100%</h4>
                  <p className="text-xs text-slate-400 tracking-wide uppercase">Blockchain Secured Escrows</p>
                </div>
                <div className="p-6 rounded-2xl bg-[#0b1326]/50 border border-slate-800">
                  <h4 className="text-3xl font-serif text-amber-400 mb-1">24/7</h4>
                  <p className="text-xs text-slate-400 tracking-wide uppercase">Multilingual AI Support</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl">
                <img 
                  src={birsaMunda} 
                  alt="Birsa Munda - Tribal Freedom Fighter" 
                  className="w-full h-full object-cover filter brightness-90 hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="absolute -bottom-8 -left-8 p-6 rounded-2xl bg-[#0b1326] border border-slate-700 shadow-2xl hidden md:block max-w-xs">
                <p className="text-xs italic text-slate-300 font-serif">"The seamless integration of AI itineraries and verified local guides changed how we experience eco-tourism."</p>
                <span className="text-[10px] text-amber-400 uppercase tracking-widest mt-3 block font-semibold">— Global Travel Review Board</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Curated Portfolio / Itineraries Section */}
      <section id="itineraries" className="py-32 bg-[#0b1326]/40 border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <span className="text-amber-400 text-xs uppercase tracking-[0.3em] font-semibold">Portfolio & Packages</span>
              <h2 className="text-4xl md:text-5xl font-serif mt-2">Curated Masterpiece Circuits</h2>
            </div>
            
            <div className="flex items-center p-1.5 rounded-full bg-[#070b14] border border-slate-800">
              {['nature', 'spiritual', 'luxury'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold transition-all ${activeTab === tab ? 'bg-amber-400 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-8">
              <div className="inline-block px-4 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                {packages[activeTab].duration} • {packages[activeTab].price}
              </div>
              <h3 className="text-3xl md:text-4xl font-serif">{packages[activeTab].title}</h3>
              <p className="text-slate-300 font-light leading-relaxed">{packages[activeTab].desc}</p>
              
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Exclusive Route Highlights</h4>
                {packages[activeTab].highlights.map((h, i) => (
                  <div key={i} className="flex items-center space-x-3 text-sm text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => navigate('/ai-planner')}
                className="px-8 py-4 rounded-full bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-widest hover:bg-amber-300 transition-all shadow-xl shadow-amber-500/10 flex items-center space-x-3 cursor-pointer"
              >
                <span>Secure Booking via Smart Contract</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="lg:col-span-6">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl relative group">
                <img 
                  src={packages[activeTab].image} 
                  alt={packages[activeTab].title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Verify (Blockchain) Section */}
      <section id="blockchain" className="py-32 bg-[#070b14] border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <span className="text-amber-400 text-xs uppercase tracking-[0.3em] font-semibold">Security Architecture</span>
            <h2 className="text-4xl md:text-5xl font-serif">Tamper-Proof Escrows & Guide Verification</h2>
            <p className="text-slate-400 font-light">Eliminating fraud through cryptographic QR codes, NFT credentials, and smart contract automated refunds.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Lock, title: "Smart Contract Escrows", desc: "Funds remain locked in decentralized escrow until service milestones are verified by traveler check-in." },
              { icon: ShieldCheck, title: "NFT Guide Credentials", desc: "Every local certified guide possesses an immutable blockchain badge confirming background verification." },
              { icon: Award, title: "Sentiment Analytics", desc: "Real-time AI sentiment tracking flags vendor inconsistencies instantly, ensuring elite hospitality standards." }
            ].map((item, idx) => (
              <div key={idx} className="p-8 rounded-2xl bg-[#0b1326]/50 border border-slate-800 hover:border-amber-400/40 transition-all group">
                <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                  <item.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-serif mb-3">{item.title}</h3>
                <p className="text-slate-400 text-sm font-light leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-32 bg-[#0b1326]/40 border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
            <span className="text-amber-400 text-xs uppercase tracking-[0.3em] font-semibold">Testimonials</span>
            <h2 className="text-4xl md:text-5xl font-serif">Words From Our Elite Travelers</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { quote: "The luxury travel packages through Netarhat were breathtaking. Knowing our payments were protected via smart contracts gave us absolute peace of mind.", author: "Aarav Sharma", role: "Tech Entrepreneur & Explorer" },
              { quote: "An absolute masterclass in UI design and travel engineering. The AI itinerary builder mapped out our exact preferences with incredible local accuracy.", author: "Priya Venkat", role: "Architect & Frequent Traveler" }
            ].map((t, idx) => (
              <div key={idx} className="p-10 rounded-2xl bg-[#070b14] border border-slate-800 space-y-6">
                <div className="flex space-x-1 text-amber-400">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400" />)}
                </div>
                <p className="text-slate-300 font-serif italic text-lg leading-relaxed">"{t.quote}"</p>
                <div>
                  <h4 className="font-semibold text-white">{t.author}</h4>
                  <p className="text-xs text-amber-400 uppercase tracking-widest mt-1">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-32 bg-[#070b14] border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div className="space-y-8">
              <span className="text-amber-400 text-xs uppercase tracking-[0.3em] font-semibold">Get In Touch</span>
              <h2 className="text-4xl md:text-5xl font-serif">Begin Your Jharkhand Journey Today</h2>
              <p className="text-slate-300 font-light leading-relaxed">Contact our team for custom itineraries, private helicopter transfers, or partnership inquiries.</p>
              
              <div className="space-y-4 pt-4">
                <div className="flex items-center space-x-4 text-slate-300">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
                    <Phone className="w-5 h-5" />
                  </div>
                  <span>+91 (0651) 240-1200 /Support</span>
                </div>
                <div className="flex items-center space-x-4 text-slate-300">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <span>jharkhandtourism50@gmail.com</span>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-[#0b1326] border border-slate-800 space-y-6 shadow-2xl">
              <h3 className="text-2xl font-serif">Send an Inquiry</h3>
              <form className="space-y-4" onSubmit={submitEnquiry}>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2 font-semibold">Full Name</label>
                  <input type="text" required maxLength="100" value={enquiry.name} onChange={(event) => setEnquiry({ ...enquiry, name: event.target.value })} placeholder="Rajesh Kumar" className="w-full px-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2 font-semibold">Email Address</label>
                  <input type="email" required value={enquiry.email} onChange={(event) => setEnquiry({ ...enquiry, email: event.target.value })} placeholder="Rajesh@example.com" className="w-full px-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2 font-semibold">Message / Requirements</label>
                  <textarea rows="4" required maxLength="2000" value={enquiry.message} onChange={(event) => setEnquiry({ ...enquiry, message: event.target.value })} placeholder="Tell us about your preferred travel dates..." className="w-full px-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"></textarea>
                </div>
                {enquiryStatus.message && (
                  <p role="status" className={`text-sm ${enquiryStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {enquiryStatus.message}
                  </p>
                )}
                <button type="submit" disabled={isSubmittingEnquiry} className="w-full py-4 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-widest hover:bg-amber-300 transition-all shadow-lg disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmittingEnquiry ? 'Sending...' : 'Submit Inquiry'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-[#070b14] py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-16 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <span className="font-serif tracking-widest uppercase font-bold text-white">Jharkhand Tourism</span>
          </div>
          <p className="text-xs text-slate-500 font-light">© 2026 Jharkhand Smart Tourism Platform. All rights reserved. Powered by Blockchain & AI.</p>
        </div>
      </footer>

    </div>
  );
}