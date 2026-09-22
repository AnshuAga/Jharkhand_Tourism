import React, { useState } from 'react';
import { Phone, Mail, MapPin } from 'lucide-react';
import { api } from '../services/api';

export default function Contact() {
  const [enquiry, setEnquiry] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitEnquiry = async (event) => {
    event.preventDefault();
    setStatus({ type: '', message: '' });
    setIsSubmitting(true);

    try {
      const result = await api.enquiries.create(enquiry);
      setEnquiry({ name: '', email: '', message: '' });
      setStatus({ type: 'success', message: result.message });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pt-32 pb-24 px-6 md:px-16 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <div className="max-w-7xl mx-auto space-y-16">
        
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-amber-400 text-xs uppercase tracking-[0.3em] font-semibold">Concierge Desk</span>
          <h1 className="text-5xl md:text-6xl font-serif">Begin Your Jharkhand Journey</h1>
          <p className="text-slate-300 font-light text-lg">Contact our 24/7 concierge team for bespoke itineraries and sovereign booking support.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 bg-[#0b1326]/40 p-8 md:p-12 rounded-3xl border border-slate-800">
          <div className="space-y-8">
            <h2 className="text-3xl font-serif">Get In Touch</h2>
            <p className="text-slate-300 font-light leading-relaxed">Whether you require private air-conditioned transit, chopper support, or private master craftsman workshop sessions, our team is ready.</p>
            
            <div className="space-y-6 pt-4">
              <div className="flex items-center space-x-4 text-slate-300">
                <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs uppercase tracking-widest text-slate-400 block">Direct Line</span>
                  <span className="font-semibold text-white">+91 (0651) 240-1200 </span>
                </div>
              </div>

              <div className="flex items-center space-x-4 text-slate-300">
                <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs uppercase tracking-widest text-slate-400 block">Electronic Mail</span>
                  <span className="font-semibold text-white">jharkhandtourism50@gmail.com</span>
                </div>
              </div>

              <div className="flex items-center space-x-4 text-slate-300">
                <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs uppercase tracking-widest text-slate-400 block">Headquarters</span>
                  <span className="font-semibold text-white">Ranchi Smart Tourism Hub, Jharkhand, India</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-[#070b14] border border-slate-800 space-y-6 shadow-2xl">
            <h3 className="text-2xl font-serif">Send an Inquiry</h3>
            <form className="space-y-4" onSubmit={submitEnquiry}>
              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2 font-semibold">Full Name</label>
                <input type="text" required maxLength="100" value={enquiry.name} onChange={(event) => setEnquiry({ ...enquiry, name: event.target.value })} placeholder="Rajesh Kumar" className="w-full px-4 py-3 rounded-xl bg-[#0b1326] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2 font-semibold">Email Address</label>
                <input type="email" required value={enquiry.email} onChange={(event) => setEnquiry({ ...enquiry, email: event.target.value })} placeholder="Rajesh@example.com" className="w-full px-4 py-3 rounded-xl bg-[#0b1326] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2 font-semibold">Message / Requirements</label>
                <textarea rows="4" required maxLength="2000" value={enquiry.message} onChange={(event) => setEnquiry({ ...enquiry, message: event.target.value })} placeholder="Tell us about your preferred travel dates..." className="w-full px-4 py-3 rounded-xl bg-[#0b1326] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"></textarea>
              </div>
              {status.message && (
                <p role="status" className={`text-sm ${status.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {status.message}
                </p>
              )}
              <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-widest hover:bg-amber-300 transition-all shadow-lg disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? 'Sending...' : 'Submit Inquiry'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}