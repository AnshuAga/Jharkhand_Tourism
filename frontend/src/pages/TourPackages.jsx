import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, ChevronRight, MapPin, PackageOpen, X } from 'lucide-react';
import { api } from '../services/api';
import { loadRazorpay } from '../services/razorpay';

function availabilityText(packageItem) {
  const availability = packageItem.availability || {};
  if (availability.available === false) return 'Currently unavailable';
  if (availability.startDate || availability.endDate) {
    return `${availability.startDate || 'Now'} to ${availability.endDate || 'Open end'}`;
  }
  return 'Availability requires confirmation';
}

export default function TourPackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [district, setDistrict] = useState('All');
  const [maxPrice, setMaxPrice] = useState('');
  const [selected, setSelected] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');

  useEffect(() => {
    api.marketplace.getData()
      .then((response) => {
        if (!response?.success) throw new Error(response?.message || 'Unable to load tour packages.');
        setPackages(Array.isArray(response.packages) ? response.packages : []);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const districts = useMemo(
    () => ['All', ...Array.from(new Set(packages.map((item) => item.district).filter(Boolean))).sort()],
    [packages]
  );
  const visiblePackages = packages.filter((item) => (
    (district === 'All' || item.district === district)
    && (!maxPrice || Number(item.price) <= Number(maxPrice))
  ));

  useEffect(() => {
    if (!selected) return undefined;
    setReviews(null);
    api.sentiment.getServiceReviews(selected.id)
      .then((response) => setReviews(response))
      .catch(() => setReviews({ summary: { totalReviews: 0, averageRating: 0 }, reviews: [] }));
    return undefined;
  }, [selected]);

  const bookPackage = async () => {
    if (!selected || !bookingDate) {
      setBookingMessage('Choose a start date before booking.');
      return;
    }
    setBookingLoading(true);
    setBookingMessage('');
    try {
      const end = new Date(`${bookingDate}T00:00:00`);
      end.setDate(end.getDate() + Math.max(0, Number(selected.duration_days || 1) - 1));
      const checkOutDate = end.toISOString().slice(0, 10);
      const response = await api.payments.createOrder({
        itemType: 'package',
        itemId: selected.id,
        travelers: 1,
        checkInDate: bookingDate,
        checkOutDate,
        days: Number(selected.duration_days || 1)
      });
      const Razorpay = await loadRazorpay();
      await new Promise((resolve, reject) => {
        const checkout = new Razorpay({
          key: response.keyId,
          amount: response.order.amount,
          currency: response.order.currency,
          name: 'Jharkhand Tourism',
          description: selected.title,
          order_id: response.order.id,
          handler: async (payment) => {
            try {
              await api.payments.verify(payment);
              setBookingMessage('Payment verified. Your package booking is confirmed.');
              resolve();
            } catch (error) { reject(error); }
          },
          modal: { ondismiss: () => reject(new Error('Payment was cancelled.')) }
        });
        checkout.open();
      });
    } catch (error) {
      setBookingMessage(error.message || 'Unable to complete package booking.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070b14] px-6 pb-24 pt-32 text-slate-100 md:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 border-b border-slate-800 pb-8 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Official itineraries</span>
            <h1 className="mt-3 text-4xl font-serif font-bold">Tour Packages</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Browse published packages created from the platform's approved service catalogue. Availability and prices require confirmation before booking.</p>
          </div>
          <Link to="/ai-planner" className="rounded-xl bg-amber-400 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-950">Build a custom journey</Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-slate-800 bg-[#0b1326] p-4">
          <select aria-label="Filter packages by district" value={district} onChange={(event) => setDistrict(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs text-slate-200">
            {districts.map((value) => <option key={value}>{value}</option>)}
          </select>
          <input aria-label="Maximum package price" type="number" min="0" placeholder="Maximum price (INR)" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs text-slate-200" />
        </div>

        {loading && <div className="py-16 text-center text-sm text-slate-400">Loading published packages…</div>}
        {!loading && error && <div role="alert" className="mt-8 rounded-2xl border border-red-800 bg-red-950/30 p-5 text-sm text-red-300">{error}</div>}
        {!loading && !error && visiblePackages.length === 0 && (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-700 p-16 text-center">
            <PackageOpen className="mx-auto text-slate-600" size={42} />
            <h2 className="mt-4 font-serif text-xl">No published packages match these filters</h2>
            <p className="mt-2 text-sm text-slate-500">Try another district or build a custom itinerary.</p>
          </div>
        )}
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visiblePackages.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1326]">
              <div className="h-44 bg-slate-900">
                {item.image ? <img src={item.image} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-700"><PackageOpen size={44} /></div>}
              </div>
              <div className="space-y-4 p-5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">{item.district || 'Jharkhand'}</span>
                  <h2 className="mt-2 text-xl font-serif font-bold text-white">{item.title}</h2>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">{item.description}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span><CalendarDays size={13} className="mr-1 inline" />{item.duration_days || 1} day(s)</span>
                  <strong className="text-lg text-amber-300">₹{Number(item.price || 0).toLocaleString('en-IN')}</strong>
                </div>
                <button type="button" onClick={() => setSelected(item)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-400 hover:text-slate-950">View details <ChevronRight size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5" role="dialog" aria-modal="true" aria-label={`${selected.title} package details`}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-700 bg-[#0b1326] p-7">
            <div className="flex items-start justify-between gap-4">
              <div><span className="text-xs uppercase tracking-widest text-amber-400">Package details</span><h2 className="mt-2 text-3xl font-serif font-bold">{selected.title}</h2></div>
              <button type="button" aria-label="Close package details" onClick={() => setSelected(null)} className="text-slate-400 hover:text-white"><X /></button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 p-4 text-xs"><CalendarDays className="mb-2 text-amber-400" size={16} />{selected.duration_days || 1} day(s)</div>
              <div className="rounded-xl border border-slate-800 p-4 text-xs"><MapPin className="mb-2 text-amber-400" size={16} />{selected.district || 'Jharkhand'}</div>
              <div className="rounded-xl border border-slate-800 p-4 text-xs"><strong className="block text-lg text-amber-300">₹{Number(selected.price || 0).toLocaleString('en-IN')}</strong>Price requires confirmation</div>
            </div>
            <p className="mt-6 text-sm leading-7 text-slate-300">{selected.description}</p>
            {selected.availability?.destinations?.length > 0 && (
              <div className="mt-5 rounded-2xl border border-slate-800 p-5">
                <h3 className="font-bold">Destinations covered</h3>
                <p className="mt-2 text-xs text-slate-400">{selected.availability.destinations.join(' · ')}</p>
              </div>
            )}
            {selected.availability?.itinerary?.length > 0 && (
              <div className="mt-5 rounded-2xl border border-slate-800 p-5">
                <h3 className="font-bold">Day-by-day itinerary</h3>
                <ol className="mt-3 space-y-2 text-xs text-slate-400">
                  {selected.availability.itinerary.map((day, index) => <li key={`${day}-${index}`}><strong className="mr-2 text-amber-300">Day {index + 1}</strong>{typeof day === 'object' ? (day.description || day.title || JSON.stringify(day)) : day}</li>)}
                </ol>
              </div>
            )}
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <h3 className="font-bold">Included package information</h3>
              <ul className="mt-3 space-y-2 text-xs text-slate-400">{(Array.isArray(selected.amenities) ? selected.amenities : []).length ? selected.amenities.map((item) => <li key={item}><Check size={13} className="mr-2 inline text-emerald-400" />{item}</li>) : <li>Package inclusions have not been specified. Confirm details before booking.</li>}</ul>
              <p className="mt-4 text-xs text-slate-400"><strong>Accommodation:</strong> {selected.availability?.accommodation || selected.availability?.hotelName || 'Not specified'}</p>
              <p className="mt-1 text-xs text-slate-400"><strong>Transport:</strong> {selected.availability?.transport || selected.availability?.startingLocation || 'Not specified'}</p>
              <p className="mt-1 text-xs text-slate-400"><strong>Exclusions:</strong> {selected.availability?.exclusions?.join(', ') || 'Not specified'}</p>
            </div>
            <p className="mt-4 text-xs text-slate-500"><strong>Cancellation policy:</strong> {selected.availability?.cancellationPolicy || 'Not specified by the package provider.'}</p>
            <p className="mt-4 text-xs text-slate-500">Availability: {availabilityText(selected)}. No reservation is confirmed until the existing booking and payment workflow succeeds.</p>
            <div className="mt-6 rounded-2xl border border-slate-800 p-5">
              <h3 className="font-bold">Visitor reviews</h3>
              <p className="mt-2 text-xs text-slate-400">
                {reviews?.summary?.totalReviews ? `★ ${reviews.summary.averageRating}/5 from ${reviews.summary.totalReviews} eligible reviews` : 'Not yet rated — no eligible visitor reviews available.'}
              </p>
              <div className="mt-3 space-y-3">
                {(reviews?.reviews || []).slice(0, 3).map((review) => (
                  <div key={review.id} className="rounded-xl bg-slate-950/60 p-3 text-xs">
                    <strong>{review.user_name || 'Tourist'} · {'★'.repeat(Number(review.rating))}</strong>
                    <p className="mt-1 text-slate-400">{review.review_text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <input type="date" aria-label="Package start date" value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} min={new Date().toISOString().slice(0, 10)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs text-slate-200" />
              <button type="button" onClick={bookPackage} disabled={bookingLoading} className="rounded-xl bg-emerald-400 px-5 py-3 text-xs font-bold text-slate-950 disabled:opacity-50">{bookingLoading ? 'Opening checkout…' : 'Book & pay'}</button>
              <Link to={`/services/${selected.id}`} className="rounded-xl border border-slate-700 px-5 py-3 text-center text-xs font-bold text-slate-300">Full details</Link>
              <Link to="/ai-planner" state={{ packageServiceId: selected.id }} className="rounded-xl border border-amber-400 px-5 py-3 text-center text-xs font-bold text-amber-300">Plan with package</Link>
            </div>
            {bookingMessage && <p role="status" className="mt-3 text-xs text-amber-300">{bookingMessage}</p>}
          </div>
        </div>
      )}
    </main>
  );
}
