import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, role, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs uppercase tracking-widest text-slate-400">Verifying Credentials...</span>
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
