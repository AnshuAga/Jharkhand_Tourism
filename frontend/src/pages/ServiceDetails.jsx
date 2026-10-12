import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarDays, Check, Clock3, Coffee, DoorOpen, ImageOff,
  MapPin, Star, Utensils, Wallet
} from 'lucide-react';
import { api } from '../services/api';

const today = new Date().toISOString().slice(0, 10);

function listValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function ReviewSummary({ reviews }) {
  const total = Number(reviews?.summary?.totalReviews || 0);
  const average = reviews?.summary?.averageRating;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Published guest reviews</h2>
        {total > 0 && Number.isFinite(Number(average)) ? (
          <span className="text-sm text-amber-300"><Star size={14} className="mr-1 inline" />{Number(average).toFixed(1)}/5 · {total} review{total === 1 ? '' : 's'}</span>
        ) : <span className="text-sm text-slate-500">Not yet rated</span>}
      </div>
      {total === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No eligible published reviews are available yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {(reviews.reviews || []).map((review) => (
            <article key={review.id} className="rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between gap-3 text-xs">
                <strong>{review.user_name || 'Verified traveller'}</strong>
                <span className="text-amber-300">{'★'.repeat(Math.max(1, Math.min(5, Number(review.rating) || 0)))}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{review.review_text}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailList({ title, values, empty = 'Not provided by the provider.' }) {
  const items = listValue(values);
  return (
    <section className="rounded-2xl border border-slate-800 p-5">
      <h2 className="font-bold">{title}</h2>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-slate-400">
          {items.map((item, index) => <li key={`${item}-${index}`}><Check size={14} className="mr-2 inline text-emerald-400" />{item}</li>)}
        </ul>
      ) : <p className="mt-3 text-sm text-slate-500">{empty}</p>}
    </section>
  );
}

function ServicePhoto({ source, alt, className }) {
  const [failed, setFailed] = useState(false);
  if (failed || !source) return <div className={`flex items-center justify-center bg-slate-950 text-slate-600 ${className}`}><ImageOff size={40} /></div>;
  return <img src={source} alt={alt} className={className} onError={() => setFailed(true)} />;
}

export default function ServiceDetails() {
  const { id } = useParams();
  const [service, setService] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [error, setError] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.marketplace.getData()
      .then((response) => {
        const found = (response.services || []).find((item) => item.id === id);
        if (!found) throw new Error('This approved listing could not be found.');
        if (!cancelled) setService(found);
        return api.sentiment.getServiceReviews(id);
      })
      .then((response) => { if (!cancelled) setReviews(response); })
      .catch((loadError) => {
        if (cancelled) return;
        if (loadError.message.includes('review')) setReviewError('Published reviews are temporarily unavailable.');
        else setError(loadError.message);
      });
    return () => { cancelled = true; };
  }, [id]);

  const metadata = service?.availability || {};
  const category = service?.category;
  const isHotel = category === 'homestay';
  const isRestaurant = category === 'restaurant';
  const isPackage = category === 'package';
  const photos = useMemo(() => listValue(metadata.photos || metadata.images || service?.image), [metadata, service]);
  const roomTypes = listValue(metadata.roomTypes);
  const itinerary = listValue(metadata.itinerary || metadata.dayByDay || metadata.days);
  const destinations = listValue(metadata.destinations || metadata.intermediateStops);
  const bookingConditions = metadata.bookingConditions || metadata.bookingNotice;
  const availabilityText = metadata.availableFrom || metadata.startDate || metadata.availableTo || metadata.endDate
    ? `${metadata.availableFrom || metadata.startDate || 'Available now'}${metadata.availableTo || metadata.endDate ? ` to ${metadata.availableTo || metadata.endDate}` : ''}`
    : metadata.availableRooms !== undefined ? `${metadata.availableRooms} room(s) currently recorded` : 'Availability requires confirmation';

  if (error) return <main className="min-h-screen bg-[#070b14] px-6 pb-24 pt-32 text-red-300"><p>{error}</p></main>;
  if (!service) return <main className="min-h-screen bg-[#070b14] px-6 pb-24 pt-32 text-slate-400"><p>Loading listing details…</p></main>;

  return (
    <main className="min-h-screen bg-[#070b14] px-6 pb-24 pt-32 text-slate-100 md:px-16">
      <div className="mx-auto max-w-6xl">
        <Link to="/packages" className="inline-flex items-center gap-2 text-xs text-amber-300"><ArrowLeft size={14} /> Back to listings</Link>
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1326]">
          <div className="grid gap-1 bg-slate-950 md:grid-cols-2">
            {photos.length ? photos.slice(0, 2).map((photo, index) => (
              <ServicePhoto key={`${photo}-${index}`} source={photo} alt={`${service.title} photograph ${index + 1}`} className={`h-64 w-full object-cover ${index === 1 ? 'hidden md:block' : ''}`} />
            )) : <div className="flex h-64 items-center justify-center text-slate-600"><ImageOff size={40} /></div>}
          </div>
          <div className="space-y-7 p-7">
            <div>
              <span className="text-xs uppercase tracking-widest text-amber-400">{isHotel ? 'Hotel / homestay' : isRestaurant ? 'Restaurant' : isPackage ? 'Tour package' : category}</span>
              <h1 className="mt-2 text-4xl font-serif font-bold">{service.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{service.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 p-4 text-xs"><MapPin className="mb-2 text-amber-400" size={16} />{service.district || 'Location not provided'}</div>
              <div className="rounded-xl border border-slate-800 p-4 text-xs"><CalendarDays className="mb-2 text-amber-400" size={16} />{service.duration_days || 1} day(s)</div>
              <div className="rounded-xl border border-slate-800 p-4 text-xs"><Wallet className="mb-2 text-amber-400" size={16} />₹{Number(service.price || 0).toLocaleString('en-IN')} {isHotel ? 'per night' : isRestaurant ? 'listed price' : 'total listed price'}</div>
              <div className="rounded-xl border border-slate-800 p-4 text-xs"><Clock3 className="mb-2 text-amber-400" size={16} />{availabilityText}</div>
            </div>

            {isHotel && (
              <>
                <DetailList title="Amenities" values={service.amenities} />
                <section className="rounded-2xl border border-slate-800 p-5">
                  <h2 className="font-bold">Available room types</h2>
                  {roomTypes.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{roomTypes.map((room, index) => (
                    <div key={`${room.type || room.name || 'room'}-${index}`} className="rounded-xl bg-slate-950/50 p-4 text-sm">
                      <strong>{room.type || room.name || 'Room type'}</strong>
                      <p className="mt-1 text-slate-400">{room.pricePerNight || room.pricePerPerson ? `₹${Number(room.pricePerNight || room.pricePerPerson).toLocaleString('en-IN')} per night` : 'Price not specified'}</p>
                      {room.availableRooms !== undefined && <p className="mt-1 text-xs text-slate-500">{room.availableRooms} room(s) recorded</p>}
                    </div>
                  ))}</div> : <p className="mt-3 text-sm text-slate-500">Room types have not been provided.</p>}
                </section>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 p-4 text-sm"><DoorOpen className="mb-2 text-amber-400" size={16} />Check-in: {metadata.checkIn || 'Not specified'}</div>
                  <div className="rounded-xl border border-slate-800 p-4 text-sm"><DoorOpen className="mb-2 text-amber-400" size={16} />Check-out: {metadata.checkOut || 'Not specified'}</div>
                </div>
              </>
            )}

            {isRestaurant && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 p-4 text-sm"><Utensils className="mb-2 text-amber-400" size={16} />Cuisine: {metadata.cuisine || metadata.restaurantCuisine || 'Not specified'}</div>
                  <div className="rounded-xl border border-slate-800 p-4 text-sm"><Wallet className="mb-2 text-amber-400" size={16} />Price range: {metadata.priceRange || 'Not specified'}</div>
                  <div className="rounded-xl border border-slate-800 p-4 text-sm"><Clock3 className="mb-2 text-amber-400" size={16} />Hours: {metadata.openingHours || metadata.hours || 'Not verified'}</div>
                </div>
                <DetailList title="Facilities" values={metadata.facilities || service.amenities} />
              </>
            )}

            {isPackage && (
              <>
                <DetailList title="Destinations covered" values={destinations} />
                <section className="rounded-2xl border border-slate-800 p-5">
                  <h2 className="font-bold">Day-by-day itinerary</h2>
                  {itinerary.length ? <ol className="mt-3 space-y-3 text-sm text-slate-400">{itinerary.map((day, index) => <li key={`${day}-${index}`}><strong className="mr-2 text-amber-300">Day {index + 1}</strong>{typeof day === 'object' ? (day.description || day.title || JSON.stringify(day)) : day}</li>)}</ol> : <p className="mt-3 text-sm text-slate-500">A day-by-day itinerary has not been provided.</p>}
                </section>
                <div className="grid gap-5 md:grid-cols-2">
                  <DetailList title="Inclusions" values={metadata.inclusions || service.amenities} />
                  <DetailList title="Exclusions" values={metadata.exclusions} />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 p-4 text-sm"><DoorOpen className="mb-2 text-amber-400" size={16} />Accommodation: {metadata.accommodation || metadata.hotelName || 'Not specified'}</div>
                  <div className="rounded-xl border border-slate-800 p-4 text-sm"><MapPin className="mb-2 text-amber-400" size={16} />Transport: {metadata.transport || metadata.startingLocation || 'Not specified'}</div>
                  <div className="rounded-xl border border-slate-800 p-4 text-sm"><Wallet className="mb-2 text-amber-400" size={16} />Pricing: {metadata.pricingConditions || 'Listed price; confirm conditions before booking.'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 p-4 text-sm"><strong>Cancellation policy:</strong> <span className="text-slate-400">{metadata.cancellationPolicy || 'Not specified by the package provider.'}</span></div>
              </>
            )}

            {!isPackage && !isRestaurant && !isHotel && <DetailList title="Available information" values={service.amenities} />}
            {reviewError && <p className="text-sm text-amber-300">{reviewError}</p>}
            <ReviewSummary reviews={reviews} />

            <div className="flex flex-wrap gap-3">
              {(isHotel || isPackage) && (
                <Link to="/ai-planner" state={{ packageServiceId: service.id, ...(isHotel ? { hotelServiceIds: [service.id] } : {}) }} className="rounded-xl bg-amber-400 px-5 py-3 text-xs font-bold text-slate-950">
                  {isHotel ? 'Select hotel' : 'View package in planner'}
                </Link>
              )}
              {isHotel && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-xs text-slate-400">
                  <CalendarDays size={14} /> Check availability in planner
                  <input type="date" min={today} value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="bg-transparent text-slate-200" aria-label="Hotel check-in date" />
                  <input type="date" min={checkIn || today} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className="bg-transparent text-slate-200" aria-label="Hotel check-out date" />
                </div>
              )}
              {isRestaurant && <span className="rounded-xl border border-slate-700 px-5 py-3 text-xs text-slate-400"><Coffee size={14} className="mr-2 inline" />Booking is not available in the current workflow.</span>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
