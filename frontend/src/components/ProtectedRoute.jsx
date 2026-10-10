import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { role, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="auth-state min-h-screen flex items-center justify-center px-6">
        <div className="flex max-w-xs flex-col items-center gap-4 text-center">
          <div className="auth-state-mark">
            <span className="h-3 w-3 animate-ping rounded-full bg-[var(--jh-gold)]" />
          </div>
          <div>
            <p className="font-serif text-lg text-[var(--jh-forest)]">Preparing your travel desk</p>
            <span className="mt-1 block text-xs text-[var(--jh-muted)]">Verifying your secure session…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if role is allowed
  const isAllowed = allowedRoles.length === 0 || allowedRoles.includes(role) || (allowedRoles.includes('vendor') && role === 'guide');

  if (!isAllowed) {
    return <Navigate to={role === 'admin' ? '/admin' : role === 'vendor' || role === 'guide' ? '/vendor' : '/tourist'} replace />;
    /*
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 pt-36 pb-24 px-6 flex items-center justify-center font-sans">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#0b1326] border border-red-900/50 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-800 text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert size={32} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-red-400 bg-red-950/80 px-3 py-1 rounded-full border border-red-800">
              Access Restricted
            </span>
            <h2 className="text-2xl font-serif font-bold text-white mt-3">Role Authorization Required</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Your account is registered as <strong className="text-amber-400 capitalize">{role}</strong>. This portal requires <strong className="text-slate-200 capitalize">{allowedRoles.join(' or ')}</strong> privileges.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to={role === 'admin' ? '/admin' : role === 'vendor' || role === 'guide' ? '/vendor' : '/tourist'}
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition"
            >
              <ArrowLeft size={14} />
              <span>Return to My Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    ); */
  }

  return children;
}
