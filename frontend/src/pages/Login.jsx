import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  UserCheck,
  Compass,
  Lock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Mail,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Phone,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

const nationalityOptions = ['Indian', 'American', 'Australian', 'British', 'Canadian', 'German', 'Japanese', 'Singaporean', 'Other'];
const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal'
];
const countryCodes = [
  ['+91', 'India'],
  ['+1', 'United States / Canada'],
  ['+44', 'United Kingdom'],
  ['+61', 'Australia'],
  ['+65', 'Singapore'],
  ['+971', 'United Arab Emirates'],
  ['+81', 'Japan'],
  ['+49', 'Germany']
];

export default function Login() {
  const { login, register, verifyEmailOTP, resendOTP, requestLoginOTP, isAuthenticated, user, role: currentRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [authStep, setAuthStep] = useState('form'); // 'form' | 'registration-otp' | 'login-otp' | 'forgot-request' | 'forgot-reset'
  const [loginMethod, setLoginMethod] = useState('password');
  const [otp, setOtp] = useState('');
  const [selectedRole, setSelectedRole] = useState('tourist');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const [nationality, setNationality] = useState('Indian');
  const [customNationality, setCustomNationality] = useState('');
  const [state, setState] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [providerAddress, setProviderAddress] = useState('');
  const [providerState, setProviderState] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      redirectBasedOnRole(user.role || currentRole);
    }
  }, [isAuthenticated, user]);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/health');
      if (res.ok) setBackendOnline(true);
      else setBackendOnline(false);
    } catch {
      setBackendOnline(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  const redirectBasedOnRole = (r) => {
    if (r === 'admin') navigate('/admin');
    else if (r === 'vendor' || r === 'guide') navigate('/vendor');
    else navigate('/tourist');
  };

  const handleEmailChange = (val) => setEmail(val);

  const resetAuthState = (nextMode = 'login') => {
    setMode(nextMode);
    setAuthStep('form');
    setOtp('');
    setError('');
    setInfoMessage('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);

    try {
      if (loginMethod === 'otp') {
        await requestLoginOTP(email.trim());
        setAuthStep('login-otp');
        setInfoMessage(`A one-time code was sent to ${email.trim()}.`);
        return;
      }
      const loggedInUser = await login(email.trim(), password);
      setInfoMessage(`Welcome back, ${loggedInUser.name || 'User'}! Redirecting...`);
      setTimeout(() => {
        redirectBasedOnRole(loggedInUser.role || selectedRole);
      }, 500);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e, type) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const verifiedUser = await verifyEmailOTP(email.trim(), otp, type === 'login' ? 'login_verify' : type);
      setInfoMessage('Verified successfully. Redirecting...');
      setTimeout(() => redirectBasedOnRole(verifiedUser.role || selectedRole), 500);
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.auth.forgotPassword({ email: email.trim() });
      setAuthStep('forgot-reset');
      setInfoMessage(res.message);
    } catch (err) {
      setError(err.message || 'Unable to request a password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}/.test(password)) {
      setError('New password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.resetPassword({ email: email.trim(), otp, newPassword: password });
      setInfoMessage(res.message);
      resetAuthState('login');
      setInfoMessage('Password updated. You can now sign in.');
    } catch (err) {
      setError(err.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}/.test(password)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone && normalizedPhone.length !== 10) {
      setError('Phone number is optional, but if provided it must contain exactly 10 digits.');
      return;
    }

    setLoading(true);
    try {
      const newUser = await register({
        name: name.trim(),
        email: email.trim(),
        phone: normalizedPhone ? `${phoneCountryCode}${normalizedPhone}` : null,
        nationality: (nationality === 'Other' ? customNationality : nationality).trim(),
        state: nationality === 'Indian' ? state : null,
        dateOfBirth: dateOfBirth || null,
        address: ['guide', 'vendor'].includes(selectedRole) ? providerAddress.trim() : null,
        providerState: ['guide', 'vendor'].includes(selectedRole) ? providerState : null,
        password,
        confirmPassword,
        role: selectedRole
      });

      setAuthStep('registration-otp');
      setInfoMessage(newUser.message || 'Check your email for a verification code.');
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pt-32 pb-24 px-6 md:px-16 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center max-w-xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-amber-400/20 bg-amber-400/5 text-amber-400 text-xs font-semibold uppercase tracking-widest">
            <Lock size={13} />
            Official Government Tourism Gateway
          </div>
          <h1 className="text-3xl md:text-4xl font-serif text-white">Jharkhand Sovereign Tourism</h1>
          <p className="text-slate-400 text-sm">
            Sign in with your email and password to access personalized itineraries, verified handicraft escrow, or administrative governance.
          </p>

          {/* Backend Status Indicator */}
          <div className="flex items-center justify-center gap-2 pt-1 text-xs">
            {backendOnline === true && (
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Backend Online (Port 5000)
              </span>
            )}
            {backendOnline === false && (
              <button
                type="button"
                onClick={checkBackendHealth}
                className="inline-flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 hover:bg-amber-500/20 transition cursor-pointer"
              >
                <RefreshCw size={12} className="animate-spin" />
                Backend Connecting... (Click to Refresh)
              </button>
            )}
          </div>
        </div>

        {/* Main Authentication Card */}
        <div className="max-w-lg mx-auto bg-[#0b1326] border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          
          {/* Top Toggle: Sign In vs Create Account */}
          <div className="grid grid-cols-2 p-1 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => resetAuthState('login')}
              className={`py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setSelectedRole('tourist'); resetAuthState('register'); }}
              className={`py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Registration role selection */}
          {mode === 'register' && <div>
            <label className="block text-[11px] uppercase tracking-widest text-slate-400 mb-2">
              Select Portal Access Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(mode === 'register' ? [
                { id: 'tourist', label: 'Tourist', icon: Compass },
                { id: 'guide', label: 'Guide', icon: UserCheck },
                { id: 'vendor', label: 'Vendor', icon: UserCheck }
              ] : [
                { id: 'tourist', label: 'Tourist', icon: Compass },
                { id: 'vendor', label: 'Guide/Vendor', icon: UserCheck },
                { id: 'admin', label: 'Admin', icon: ShieldCheck }
              ]).map((roleItem) => (
                <button
                  key={roleItem.id}
                  type="button"
                  onClick={() => setSelectedRole(roleItem.id)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    selectedRole === roleItem.id
                      ? 'bg-amber-400/10 border-amber-400 text-amber-400 shadow-sm'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <roleItem.icon size={14} />
                  <span>{roleItem.label}</span>
                </button>
              ))}
            </div>
            {mode === 'login' && selectedRole === 'admin' && (
              <p className="mt-2 text-[11px] text-amber-400/80 bg-amber-400/5 border border-amber-400/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <ShieldCheck size={13} className="shrink-0 text-amber-400" />
                <span>Authorized Admin Email: <strong className="text-amber-300">uhsna16@gmail.com</strong></span>
              </p>
            )}
          </div>}

          {/* Feedback Messages */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {infoMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* MODE: SIGN IN */}
          {mode === 'login' && authStep === 'form' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="grid grid-cols-2 p-1 bg-slate-900/60 border border-slate-800 rounded-xl">
                <button type="button" onClick={() => setLoginMethod('password')} className={`py-2 text-xs font-semibold rounded-lg ${loginMethod === 'password' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Password</button>
                <button type="button" onClick={() => setLoginMethod('otp')} className={`py-2 text-xs font-semibold rounded-lg ${loginMethod === 'otp' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Email OTP</button>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder={selectedRole === 'admin' ? 'uhsna16@gmail.com' : 'your.email@example.com'}
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400 transition"
                  />
                </div>
              </div>

              {loginMethod === 'password' && <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-linear-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
              {loginMethod === 'password' && (
                <button type="button" onClick={() => { setAuthStep('forgot-request'); setError(''); setInfoMessage(''); }} className="w-full text-xs text-amber-400 hover:text-amber-300">Forgot password?</button>
              )}
            </form>
          )}

          {mode === 'login' && authStep === 'login-otp' && (
            <form onSubmit={(e) => handleVerifyOTP(e, 'login')} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Enter your email OTP</h2>
              <p className="text-xs text-slate-400">We sent a 6-digit code to {email}.</p>
              <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} required placeholder="6-digit code" className="w-full px-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm tracking-[0.35em] text-center focus:outline-none focus:border-amber-400" />
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider disabled:opacity-50">{loading ? 'Verifying...' : 'Verify & Sign In'}</button>
              <button type="button" onClick={() => resendOTP(email.trim(), 'login_verify').then((res) => setInfoMessage(res.message)).catch((err) => setError(err.message))} className="w-full text-xs text-amber-400 hover:text-amber-300">Resend code</button>
            </form>
          )}

          {mode === 'login' && authStep === 'forgot-request' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Reset your password</h2>
              <p className="text-xs text-slate-400">We will email a one-time reset code if an account exists.</p>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="your.email@example.com" className="w-full px-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400" />
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider disabled:opacity-50">{loading ? 'Sending...' : 'Send reset code'}</button>
              <button type="button" onClick={() => resetAuthState('login')} className="w-full text-xs text-slate-400 hover:text-white">Back to sign in</button>
            </form>
          )}

          {mode === 'login' && authStep === 'forgot-reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Choose a new password</h2>
              <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} required placeholder="Reset code" className="w-full px-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm tracking-[0.35em] text-center focus:outline-none focus:border-amber-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required placeholder="8+ chars, upper/lower/number/symbol" className="w-full px-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400" />
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider disabled:opacity-50">{loading ? 'Updating...' : 'Update password'}</button>
            </form>
          )}

          {/* MODE: REGISTER */}
          {mode === 'register' && authStep === 'form' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Hansda"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">Mobile Number <span className="normal-case tracking-normal text-slate-500">(Optional)</span></label>
                <div className="flex gap-2">
                  <select
                    aria-label="Country calling code"
                    value={phoneCountryCode}
                    onChange={(e) => setPhoneCountryCode(e.target.value)}
                    className="w-[8.5rem] rounded-xl bg-[#070b14] border border-slate-700 px-3 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400 transition"
                  >
                    {countryCodes.map(([code, country]) => <option key={code} value={code}>{code} · {country}</option>)}
                  </select>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    placeholder="9876543210"
                    className="min-w-0 flex-1 rounded-xl bg-[#070b14] border border-slate-700 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400 transition"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-slate-500">Enter 10 digits only. The selected country code will be saved with your number.</p>
              </div>

              {selectedRole === 'tourist' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">Nationality</label>
                    <select value={nationality} onChange={(e) => setNationality(e.target.value)} required className="w-full px-3.5 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400 transition">
                      {nationalityOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </div>
                  {nationality === 'Other' && (
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">Enter Nationality</label>
                      <input type="text" value={customNationality} onChange={(e) => setCustomNationality(e.target.value)} placeholder="Your nationality" required className="w-full px-3.5 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400 transition" />
                    </div>
                  )}
                  {nationality === 'Indian' && (
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">State</label>
                      <select value={state} onChange={(e) => setState(e.target.value)} required className="w-full px-3.5 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400 transition">
                        <option value="">Select your state</option>
                        {indianStates.map((stateName) => <option key={stateName}>{stateName}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">Date of Birth</label>
                    <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} max={new Date().toISOString().slice(0, 10)} required className="w-full px-3.5 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400 transition" />
                  </div>
                </div>
              )}

              {['guide', 'vendor'].includes(selectedRole) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">Business / Service Address</label>
                    <textarea value={providerAddress} onChange={(e) => setProviderAddress(e.target.value)} placeholder="Full address of your business or service location" required rows={3} className="w-full px-3.5 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400 transition resize-y" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">State</label>
                    <select value={providerState} onChange={(e) => setProviderState(e.target.value)} required className="w-full px-3.5 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400 transition">
                      <option value="">Select your state</option>
                      {indianStates.map((stateName) => <option key={stateName}>{stateName}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8+ chars, upper/lower/number/symbol"
                    required
                    className="w-full px-3.5 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    className="w-full px-3.5 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-400 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-linear-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Creating Account & Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account & Verify Email</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}

          {mode === 'register' && authStep === 'registration-otp' && (
            <form onSubmit={(e) => handleVerifyOTP(e, 'registration')} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Verify your email</h2>
              <p className="text-xs text-slate-400">A 6-digit verification code was sent to {email}.</p>
              <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} required placeholder="6-digit code" className="w-full px-4 py-3 rounded-xl bg-[#070b14] border border-slate-700 text-slate-100 text-sm tracking-[0.35em] text-center focus:outline-none focus:border-amber-400" />
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider disabled:opacity-50">{loading ? 'Verifying...' : 'Verify email & enter'}</button>
              <button type="button" onClick={() => resendOTP(email.trim(), 'registration').then((res) => setInfoMessage(res.message)).catch((err) => setError(err.message))} className="w-full text-xs text-amber-400 hover:text-amber-300">Resend code</button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
