import React, { useEffect, useState } from 'react';
import { AlertCircle, BarChart3, BrainCircuit, LoaderCircle } from 'lucide-react';
import { api } from '../services/api';

const SENTIMENT_STYLES = {
  Positive: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  Negative: 'bg-rose-400/15 text-rose-300 border-rose-400/30',
  Neutral: 'bg-slate-400/15 text-slate-300 border-slate-400/30',
  Mixed: 'bg-amber-400/15 text-amber-300 border-amber-400/30'
};

function SentimentBadge({ value }) {
  const label = value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : 'Unknown';
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${SENTIMENT_STYLES[label] || SENTIMENT_STYLES.Neutral}`}>{label}</span>;
}

export default function SentimentAnalysis({ embedded = false }) {
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzerError, setAnalyzerError] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [destinationId, setDestinationId] = useState('');
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');

  const loadAnalytics = async (filter = destinationId) => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      setAnalytics(await api.sentiment.getAnalytics(filter));
    } catch (error) {
      setAnalyticsError(error.message);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    api.destinations.getAll().then((response) => setDestinations(response.data || response.destinations || [])).catch(() => setDestinations([]));
    loadAnalytics('');
  }, []);

  const analyze = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    setAnalyzing(true);
    setAnalyzerError('');
    try {
      setAnalysis(await api.sentiment.analyze(text.trim()));
    } catch (error) {
      setAnalysis(null);
      setAnalyzerError(error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const counts = analytics?.sentimentDistribution?.rawCounts || {};
  const chart = [['Positive', counts.Positive || 0], ['Negative', counts.Negative || 0], ['Neutral', counts.Neutral || 0], ['Mixed', counts.Mixed || 0]];
  const chartMax = Math.max(1, ...chart.map(([, count]) => count));

  return (
    <main className={`${embedded ? 'px-0 pb-0 pt-0' : 'min-h-screen px-4 pb-16 pt-32 sm:px-6'} bg-[#070b14] text-slate-100`}>
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-amber-400/20 bg-[#0b1326] p-6 md:p-8">
          <div className="flex items-start gap-4">
            <BrainCircuit className="mt-1 text-amber-300" size={28} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">AI transparency centre</p>
              <h1 className="mt-2 text-3xl font-serif font-bold md:text-4xl">AI Sentiment Analysis</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">Analyze a review with the platform model and inspect genuine review analytics used by the tourism recommendation system.</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-[#0b1326] p-6">
            <h2 className="text-xl font-serif font-bold">Live sentiment analyzer</h2>
            <p className="mt-1 text-xs text-slate-500">The prediction below is returned by the backend model; no example prediction is hardcoded.</p>
            <form onSubmit={analyze} className="mt-5 space-y-3">
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} maxLength={5000} placeholder="Write a genuine tourist review..." className="w-full rounded-2xl border border-slate-700 bg-[#070b14] p-4 text-sm text-slate-100 outline-none focus:border-amber-400" />
              <button disabled={analyzing || !text.trim()} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
                {analyzing && <LoaderCircle size={14} className="animate-spin" />} {analyzing ? 'Analyzing...' : 'Analyze sentiment'}
              </button>
            </form>
            {analyzerError && <p className="mt-4 flex gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-200"><AlertCircle size={15} />{analyzerError}</p>}
            {analysis && <div className="mt-5 rounded-2xl border border-slate-800 bg-[#070b14] p-4">
              <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wider text-slate-500">Predicted sentiment</span><SentimentBadge value={analysis.sentiment} /></div>
              <p className="mt-3 text-xs text-slate-400">Emotion: <span className="text-slate-200">{analysis.emotion}</span> · Compound score: <span className="text-slate-200">{analysis.compoundScore}</span></p>
              {Object.keys(analysis.aspects || {}).length > 0 ? <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Detected aspects <span className="font-normal normal-case">(keyword-based sentiment labels)</span></p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(analysis.aspects).map(([aspect, sentiment]) => <span key={aspect} className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] capitalize text-slate-300">{aspect}: {typeof sentiment === 'number' ? (sentiment >= 3.5 ? 'positive' : sentiment <= 2.5 ? 'negative' : 'neutral') : sentiment.toLowerCase()}</span>)}</div></div> : <p className="mt-4 text-xs text-slate-500">No specific aspects detected.</p>}
            </div>}
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0b1326] p-6">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-serif font-bold">Genuine review analytics</h2><p className="mt-1 text-xs text-slate-500">Only reviews stored in the production database are counted.</p></div><BarChart3 className="text-amber-300" size={20} /></div>
            <select value={destinationId} onChange={(event) => { setDestinationId(event.target.value); loadAnalytics(event.target.value); }} className="mt-5 w-full rounded-xl border border-slate-700 bg-[#070b14] p-3 text-xs text-slate-200 outline-none">
              <option value="">All destinations</option>
              {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
            </select>
            {analyticsLoading ? <p className="mt-8 text-sm text-slate-500">Loading genuine review analytics...</p> : analyticsError ? <p className="mt-8 text-sm text-rose-300">{analyticsError}</p> : !analytics?.hasData ? <p className="mt-8 rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">No genuine tourist reviews have been analyzed yet.</p> : <><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-950/60 p-3"><span className="text-[10px] uppercase text-slate-500">Reviews analyzed</span><strong className="mt-1 block text-xl">{analytics.totalReviews}</strong></div><div className="rounded-xl bg-slate-950/60 p-3"><span className="text-[10px] uppercase text-slate-500">Filter</span><strong className="mt-1 block truncate text-sm">{destinationId ? destinations.find((item) => item.id === destinationId)?.name : 'All destinations'}</strong></div></div><div className="mt-5 space-y-3">{chart.map(([label, count]) => <div key={label}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-300">{label}</span><span className="text-slate-500">{count} reviews</span></div><div className="h-2 rounded-full bg-slate-800"><div className={`h-2 rounded-full ${label === 'Positive' ? 'bg-emerald-400' : label === 'Negative' ? 'bg-rose-400' : label === 'Mixed' ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ width: `${(count / chartMax) * 100}%` }} /></div></div>)}</div><p className="mt-4 text-[11px] text-slate-500">Bars show counts, not percentages. Percentages: {analytics.sentimentDistribution.positivePercent}% positive · {analytics.sentimentDistribution.negativePercent}% negative · {analytics.sentimentDistribution.neutralPercent}% neutral · {analytics.sentimentDistribution.mixedPercent || 0}% mixed.</p></>}
          </div>
        </section>

      </div>
    </main>
  );
}
