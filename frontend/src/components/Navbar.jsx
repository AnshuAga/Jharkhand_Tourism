import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, ShoppingBag, MapPinned } from 'lucide-react';
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

  const primaryLinks = [
    ['/destinations', 'Discover'],
    ['/about', 'Our story'],
    ...(isAuthenticated ? [['/marketplace', 'Crafts & stays'], ['/arvr', 'Immersive tours'], ['/transport', 'Live transit']] : [])
  ];

  return (
    <nav className="site-nav fixed left-0 right-0 top-0 z-50 px-4 py-4 sm:px-6 font-sans">
      <div className="site-nav-inner mx-auto flex h-[68px] max-w-7xl items-center justify-between rounded-2xl px-4 sm:px-6">
        
        <div className="flex items-center gap-3">
          <Link to="/" className="brand-mark flex items-center gap-2">
            <span className="brand-mark-icon"><MapPinned size={17} /></span>
            <span>Jharkhand <em>Tourism</em></span>
          </Link>
        </div>

        <div className="hidden items-center gap-7 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--jh-muted)] xl:flex">
          {primaryLinks.map(([path, label]) => <Link key={path} to={path} className="nav-link">{label}</Link>)}
          {isAuthenticated && role === 'admin' && <Link to="/verify" className="nav-link">Ledger</Link>}
          {isAuthenticated && <Link to="/contact" className="nav-link">Contact</Link>}
        </div>

        {/* Right side role / login CTA */}
        <div className="hidden items-center gap-3 lg:flex">
          {isAuthenticated && role === 'tourist' && <Link to="/marketplace?cart=1" title="Open cart" className="relative p-2 text-slate-300 hover:text-amber-400 transition">
            <ShoppingBag size={18} />
            {cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-slate-950">{cartCount}</span>}
          </Link>}
          {isAuthenticated ? (
            <div className="flex items-center space-x-2">
              <Link
                to={getDashboardPath()}
                className="nav-account"
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
                className="nav-icon-button"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="nav-cta"
            >
              <User size={13} />
              <span>Portal Login</span>
            </Link>
          )}
        </div>

        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="nav-menu-button xl:hidden"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="site-mobile-menu xl:hidden">
          {primaryLinks.map(([path, label]) => <Link key={path} to={path} onClick={() => setMobileMenuOpen(false)} className="nav-mobile-link">{label}</Link>)}
          {isAuthenticated && <>
            {role === 'tourist' &&             <Link to="/marketplace?cart=1" onClick={() => setMobileMenuOpen(false)} className="nav-mobile-link flex items-center gap-2">
              <ShoppingBag size={14} /> Cart {cartCount > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[9px] font-bold text-slate-950">{cartCount}</span>}
            </Link>}
            {role === 'admin' && <Link to="/verify" onClick={() => setMobileMenuOpen(false)} className="nav-mobile-link">Blockchain Audit</Link>}
            <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="nav-mobile-link">Contact</Link>
          </>}
          <div className="pt-2 border-t border-slate-800">
            {isAuthenticated ? (
              <div className="flex items-center justify-between">
                <Link to={getDashboardPath()} onClick={() => setMobileMenuOpen(false)} className="nav-mobile-account">{getRoleLabel()}</Link>
                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="nav-mobile-logout">Logout</button>
              </div>
            ) : (
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="nav-mobile-account">Sign In to roles</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}