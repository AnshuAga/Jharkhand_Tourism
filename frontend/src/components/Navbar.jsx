import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Shield, User, LogOut, Compass, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, role, isAuthenticated, logout } = useAuth();
  const cartKey = `jharkhand_cart_${user?.id || user?.email || 'guest'}`;
  const [cartCount, setCartCount] = useState(0);
  const navigate = useNavigate();

  React.useEffect(() => {
    const syncCart = () => {
      try {
        setCartCount(JSON.parse(localStorage.getItem(cartKey) || '[]').length);
      } catch {
        setCartCount(0);
      }
    };
    syncCart();
    window.addEventListener('jharkhand-cart-updated', syncCart);
    return () => window.removeEventListener('jharkhand-cart-updated', syncCart);
  }, [cartKey]);

  const getDashboardPath = () => {
    if (role === 'admin') return '/admin';
    if (role === 'vendor') return '/vendor';
    return '/tourist';
  };

  const getRoleLabel = () => {
    if (role === 'admin') return 'Admin Hub';
    if (role === 'vendor') return 'Vendor Portal';
    return 'My Dashboard';
  };

  return (
    <nav className="fixed top-6 left-0 right-0 z-50 px-6 font-sans">
      <div className="max-w-7xl mx-auto backdrop-blur-xl bg-[#0b1326]/80 border border-slate-700/50 rounded-full px-7 h-20 flex items-center justify-between shadow-2xl shadow-black/50">
        
        <div className="flex items-center space-x-3">
          <Link to="/" className="text-xl font-serif tracking-widest text-white uppercase font-bold">
            Explore <span className="text-amber-400 font-sans font-light text-sm">Jharkhand</span>
          </Link>
        </div>

        <div className="hidden xl:flex items-center space-x-6 text-[11px] font-semibold tracking-widest uppercase text-slate-300">
          <Link to="/about" className="hover:text-amber-400 transition-colors">
            About Us
          </Link>

          <Link to="/destinations" className="hover:text-amber-400 transition-colors">
            Destinations
          </Link>

          {isAuthenticated && <>
            <Link to="/marketplace" className="hover:text-amber-400 transition-colors">Marketplace</Link>
            <Link to="/arvr" className="hover:text-amber-400 transition-colors">AR/VR Tours</Link>
            <Link to="/transport" className="hover:text-amber-400 transition-colors">Live Transport</Link>
            {role === 'admin' && <Link to="/verify" className="hover:text-amber-400 transition-colors">Audit Ledger</Link>}
            <Link to="/contact" className="hover:text-amber-400 transition-colors">Contact</Link>
          </>}
        </div>

        {/* Right side role / login CTA */}
        <div className="hidden lg:flex items-center space-x-3">
          {isAuthenticated && role !== 'guide' && role !== 'vendor' && <Link to="/marketplace?cart=1" title="Open cart" className="relative p-2 text-slate-300 hover:text-amber-400 transition">
            <ShoppingBag size={18} />
            {cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-slate-950">{cartCount}</span>}
          </Link>}
          {isAuthenticated ? (
            <div className="flex items-center space-x-2">
              <Link
                to={getDashboardPath()}
                className="px-4 py-2 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 font-bold text-xs uppercase tracking-wider hover:bg-amber-400 hover:text-slate-950 transition flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{getRoleLabel()}</span>
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                title="Sign Out"
                className="p-2 rounded-full bg-slate-900 border border-slate-700 text-slate-400 hover:text-red-400 transition"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 transition shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <User size={13} />
              <span>Portal Login</span>
            </Link>
          )}
        </div>

        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="xl:hidden text-slate-300 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="xl:hidden mt-4 mx-auto max-w-md bg-[#0b1326] border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl text-xs uppercase tracking-widest">
          <Link to="/destinations" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 hover:text-amber-400">Destinations</Link>
          <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 hover:text-amber-400">About Us</Link>
          {isAuthenticated && <>
            {role !== 'guide' && role !== 'vendor' && <Link to="/marketplace?cart=1" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-slate-300 hover:text-amber-400">
              <ShoppingBag size={14} /> Cart {cartCount > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[9px] font-bold text-slate-950">{cartCount}</span>}
            </Link>}
            <Link to="/arvr" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 hover:text-amber-400">AR/VR Experiences</Link>
            <Link to="/transport" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 hover:text-amber-400">Live Transport</Link>
            {role === 'admin' && <Link to="/verify" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 hover:text-amber-400">Blockchain Audit</Link>}
            <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 hover:text-amber-400">Contact</Link>
          </>}
          <div className="pt-2 border-t border-slate-800">
            {isAuthenticated ? (
              <div className="flex items-center justify-between">
                <Link to={getDashboardPath()} onClick={() => setMobileMenuOpen(false)} className="text-amber-400 font-bold">{getRoleLabel()}</Link>
                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="text-red-400">Logout</button>
              </div>
            ) : (
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-amber-400 font-bold">Sign In to Roles</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}