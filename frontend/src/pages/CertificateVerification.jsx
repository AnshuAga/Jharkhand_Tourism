import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { CheckCircle2, Copy, ExternalLink, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react';

const explorerUrl = (hash) => hash ? `https://amoy.polygonscan.com/tx/${encodeURIComponent(hash)}` : '';
const blockExplorerUrl = (block) => block ? `https://amoy.polygonscan.com/block/${encodeURIComponent(block)}` : '';
const shorten = (value) => value ? `${value.slice(0, 10)}...${value.slice(-8)}` : '--';

export default function CertificateVerification() {
  const [identifier, setIdentifier] = useState('');
  const [mode, setMode] = useState('provider');
  const [result, setResult] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLedgerLoading(true);
    setError('');
    try {
      const [ledgerResponse, certificateResponse] = await Promise.all([
        api.blockchain.getLedger(),
        api.blockchain.getCertificates()
      ]);
      setLedger(ledgerResponse.ledger || ledgerResponse.transactions || []);
      setCertificates(certificateResponse.certificates || []);
    } catch (err) {
      setError(err.message || 'Unable to load blockchain records.');
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleVerify = async (event) => {
    event.preventDefault();
    setVerificationLoading(true);
    setResult(null);
    try {
      const response = mode === 'provider'
        ? await api.blockchain.verifyProvider(identifier.trim())
        : await api.blockchain.verify(identifier.trim());
      setResult(response);
    } catch (err) {
      setResult({ status: 'Invalid', valid: false, message: err.message });
    } finally {
      setVerificationLoading(false);
    }
  };

  const filteredLedger = useMemo(() => ledger.filter((transaction) => {
    const action = String(transaction.action || '').toLowerCase();
    const matchesFilter = filter === 'All' || action.includes(filter.toLowerCase().replace(' ', '_'));
    const haystack = JSON.stringify(transaction).toLowerCase();
    return matchesFilter && haystack.includes(search.toLowerCase());
  }), [ledger, filter, search]);

  const contractAddress = ledger.find((item) => item.contract_address)?.contract_address;
  const copyHash = (hash) => hash && navigator.clipboard?.writeText(hash);
  const network = result?.network || ledger.find((item) => item.network)?.network || 'Polygon Amoy';

  return (
    <div className="min-h-screen bg-[#070b14] px-6 pb-24 pt-32 font-sans text-slate-100 md:px-16">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-amber-400/20 bg-[#0b1326] p-7 md:p-10">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Immutable ledger verification</span>
          <h1 className="mt-3 text-3xl font-serif font-bold md:text-5xl">Blockchain Verification &amp; Audit Center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">Verify tourism credentials, booking transactions, vendor registrations and service records using blockchain-backed verification.</p>
          <div className="mt-6 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider">
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-300">● Contract connection required</span>
            <span className="rounded-full border border-slate-700 px-3 py-2 text-slate-300">⌁ On-chain verification</span>
            <span className="rounded-full border border-slate-700 px-3 py-2 text-slate-300">◆ Tamper-resistant records</span>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Smart contract', contractAddress ? 'Connected' : '--'],
            ['Total records', ledger.length || '--'],
            ['Network', network]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-[#0b1326] p-5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
              <strong className="mt-2 block text-lg text-white">{value}</strong>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-[#0b1326] p-6 md:p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Main verification tool</span>
              <h2 className="mt-2 text-2xl font-serif font-bold">Verify Tourism Credential</h2>
              <p className="mt-1 text-sm text-slate-400">Search only records returned by the connected backend registry.</p>
            </div>
            <ShieldCheck className="text-emerald-400" />
          </div>
          <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-3 md:flex-row">
            <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1 text-[10px] font-bold uppercase">
              {[
                ['provider', 'Provider ID'],
                ['transaction', 'Transaction Hash']
              ].map(([value, label]) => <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-lg px-3 py-2 ${mode === value ? 'bg-amber-400 text-slate-950' : 'text-slate-400'}`}>{label}</button>)}
            </div>
            <input required value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={mode === 'provider' ? 'e.g. usr-guide-161da569' : '0x transaction hash'} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-amber-400" />
            <button disabled={verificationLoading} className="rounded-xl bg-amber-400 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-300 disabled:opacity-50">{verificationLoading ? 'Verifying...' : 'Verify on blockchain'}</button>
          </form>
          {result && (
            <div className={`mt-5 rounded-2xl border p-5 ${result.valid ? 'border-emerald-800 bg-emerald-950/20' : 'border-red-800 bg-red-950/20'}`}>
              <div className="flex items-center gap-2 text-sm font-bold">{result.valid ? <CheckCircle2 className="text-emerald-400" /> : <XCircle className="text-red-400" />}{result.valid ? (mode === 'provider' ? 'Verified on blockchain' : 'Verified transaction') : 'Verification failed'}</div>
              <p className="mt-2 text-sm text-slate-300">{result.valid ? `${result.certificate?.name || result.providerId} · ${result.certificate?.category || 'Provider'} · ${result.certificate?.district || '--'}` : (result.message || 'The supplied identifier could not be matched to a blockchain record.')}</p>
              {result.valid && <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-3"><span>Provider: <b className="text-white">{result.providerId}</b></span><span>Status: <b className="text-emerald-300">{result.status}</b></span><span>Issued: <b className="text-white">{result.issuedAt || result.certificate?.issue_date ? new Date(result.issuedAt || result.certificate.issue_date).toLocaleDateString() : '--'}</b></span><span>Transaction: <b className="font-mono text-white">{shorten(result.transactionHash || result.certificate?.blockchain_tx_hash)}</b></span><span>Valid until: <b className="text-white">{result.validUntil || result.certificate?.valid_until ? new Date(result.validUntil || result.certificate.valid_until).toLocaleDateString() : '--'}</b></span></div>}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-[#0b1326] p-6 md:p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div><h2 className="text-2xl font-serif font-bold">Public Blockchain Audit Ledger</h2><p className="mt-1 text-sm text-slate-400">Review blockchain-backed booking, escrow, registration and verification events.</p></div>
            <button onClick={loadData} disabled={ledgerLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold uppercase text-slate-300 hover:border-emerald-400"><RefreshCw size={14} className={ledgerLoading ? 'animate-spin' : ''} /> Refresh ledger</button>
          </div>
          <div className="mt-6 flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search hash, certificate ID or wallet address" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-emerald-400" /></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"><option>All</option><option>Bookings</option><option>Escrow</option><option>Refunds</option><option>Certificates</option></select></div>
          {error && <p className="mt-5 rounded-xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">{error}</p>}
          {!ledgerLoading && !filteredLedger.length && <div className="mt-5 rounded-2xl border border-dashed border-slate-700 p-8 text-center"><p className="text-sm text-slate-300">No blockchain transactions have been recorded yet.</p><p className="mt-1 text-xs text-slate-500">Transactions will appear here after a successful blockchain operation.</p></div>}
          <div className="mt-5 space-y-3">{filteredLedger.map((transaction) => <article key={transaction.id || transaction.tx_hash} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300">{transaction.action || 'Transaction'}</span><p className="mt-2 font-mono text-xs text-slate-300">{shorten(transaction.tx_hash)}</p></div><div className="flex flex-wrap items-center gap-3 text-xs"><span className="text-emerald-300">{transaction.status || 'confirmed'}</span>{transaction.block_number ? <a href={blockExplorerUrl(transaction.block_number)} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-amber-300">Block {transaction.block_number}</a> : <span className="text-slate-500">Block --</span>}<button type="button" onClick={() => copyHash(transaction.tx_hash)} title="Copy transaction hash" aria-label="Copy transaction hash" className="text-slate-400 hover:text-white"><Copy size={14} /></button>{transaction.tx_hash && <a href={explorerUrl(transaction.tx_hash)} target="_blank" rel="noreferrer" title="Open transaction on Polygon Amoy" className="text-amber-300 hover:text-amber-200"><ExternalLink size={14} /></a>}</div></div></article>)}</div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-[#0b1326] p-6 md:p-8">
          <div className="flex items-center justify-between"><div><h2 className="text-2xl font-serif font-bold">Verified Tourism Providers</h2><p className="mt-1 text-sm text-slate-400">Only certificates returned by the official registry are shown.</p></div></div>
          {!certificates.length ? <p className="mt-5 rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-500">No verified tourism providers are currently available.</p> : <div className="mt-5 grid gap-3 md:grid-cols-2">{certificates.map((certificate) => <div key={certificate.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex items-center justify-between"><b className="text-white">{certificate.name}</b><span className="text-[10px] uppercase text-emerald-300">{certificate.status}</span></div><p className="mt-2 text-xs text-slate-400">{certificate.certificate_id} · {certificate.category} · {certificate.district}</p></div>)}</div>}
        </section>
      </div>
    </div>
  );
}
