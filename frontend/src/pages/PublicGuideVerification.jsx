import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../services/api';

const polygonTransactionUrl = (hash) => hash
  ? `https://amoy.polygonscan.com/tx/${encodeURIComponent(hash)}`
  : '';

export default function PublicGuideVerification() {
  const { providerId } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.blockchain.verifyProvider(providerId)
      .then(setResult)
      .catch((requestError) => setError(requestError.message || 'Blockchain verification failed.'));
  }, [providerId]);

  const verified = result?.verified;
  return (
    <main className="min-h-screen bg-[#070b14] px-6 pb-24 pt-32 text-slate-100">
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-800 bg-[#0b1326] p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Jharkhand Tourism</p>
        <h1 className="mt-3 text-3xl font-serif font-bold">Guide Certificate Verification</h1>
        <p className="mt-2 text-sm text-slate-400">Provider ID: <span className="font-mono text-slate-200">{providerId}</span></p>
        {!result && !error && <p className="mt-8 text-sm text-slate-400">Checking Polygon Amoy...</p>}
        {error && <div className="mt-8 rounded-2xl border border-red-800 bg-red-950/20 p-5 text-red-300">{error}</div>}
        {result && (
          <div className={`mt-8 rounded-2xl border p-5 ${verified ? 'border-emerald-800 bg-emerald-950/20' : 'border-red-800 bg-red-950/20'}`}>
            <div className="flex items-center gap-2 font-bold">{verified ? <CheckCircle2 className="text-emerald-400" /> : <XCircle className="text-red-400" />}{verified ? 'Verified' : 'Certificate Invalid'}</div>
            <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
              <div><dt className="text-slate-500">Status</dt><dd>{result.status || 'Invalid'}</dd></div>
              <div><dt className="text-slate-500">Network</dt><dd>{result.network || 'Polygon Amoy'}</dd></div>
              <div><dt className="text-slate-500">Issued</dt><dd>{result.issuedAt ? new Date(result.issuedAt).toLocaleDateString() : '--'}</dd></div>
              <div><dt className="text-slate-500">Valid until</dt><dd>{result.validUntil ? new Date(result.validUntil).toLocaleDateString() : '--'}</dd></div>
              <div className="md:col-span-2"><dt className="text-slate-500">Certificate hash</dt><dd className="break-all font-mono text-xs">{result.certificateHash || '--'}</dd></div>
              <div className="md:col-span-2">
                <dt className="text-slate-500">Transaction</dt>
                <dd className="break-all font-mono text-xs">{result.transactionHash || '--'}</dd>
                {result.transactionHash && (
                  <a
                    href={polygonTransactionUrl(result.transactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 font-sans text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-400 hover:text-slate-950"
                  >
                    View on Polygon Amoy Explorer
                  </a>
                )}
              </div>
            </dl>
          </div>
        )}
      </section>
    </main>
  );
}
