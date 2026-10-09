import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AIChatbot from './components/AIChatbot';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

import JharkhandTourismHome from './pages/Home';
import AboutUs from './pages/About';
import Destinations from './pages/Destinations';
import AIPlanner, { PlannerErrorBoundary } from './pages/AI_planner';
import Testimonials from './pages/Testimonials';
import Contact from './pages/Contact';
import MarketPlace from './pages/market_place';
import CertificateVerification from './pages/CertificateVerification';
import PublicGuideVerification from './pages/PublicGuideVerification';

import Login from './pages/Login';
import TouristDashboard from './pages/TouristDashboard';
import VendorDashboard from './pages/VendorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ARVRExperience from './pages/ARVRExperience';
import TransportTracking from './pages/TransportTracking';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 relative">
          <Navbar />
          <Routes>
            {/* Core Preserved Pages */}
            <Route path="/" element={<JharkhandTourismHome />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/destinations" element={<Destinations />} />
            <Route path="/ai-planner" element={<ProtectedRoute><PlannerErrorBoundary><AIPlanner /></PlannerErrorBoundary></ProtectedRoute>} />
            <Route path="/planner" element={<ProtectedRoute><PlannerErrorBoundary><AIPlanner /></PlannerErrorBoundary></ProtectedRoute>} />
            <Route path="/testimonials" element={<ProtectedRoute><Testimonials /></ProtectedRoute>} />
            <Route path="/marketplace" element={<ProtectedRoute><MarketPlace /></ProtectedRoute>} />
            <Route path="/contact" element={<ProtectedRoute><Contact /></ProtectedRoute>} />
            <Route path="/verify" element={<ProtectedRoute allowedRoles={['admin']}><CertificateVerification /></ProtectedRoute>} />
            <Route path="/verify/guide/:providerId" element={<PublicGuideVerification />} />

            {/* Public Authentication Portal */}
            <Route path="/login" element={<Login />} />

            {/* Protected Role-Based Portals */}
            <Route
              path="/tourist"
              element={
                <ProtectedRoute allowedRoles={['tourist']}>
                  <TouristDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendor"
              element={
                <ProtectedRoute allowedRoles={['vendor', 'guide', 'admin']}>
                  <VendorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Immersive AR/VR & Live Transport Telemetry */}
            <Route path="/arvr" element={<ProtectedRoute><ARVRExperience /></ProtectedRoute>} />
            <Route path="/transport" element={<ProtectedRoute><TransportTracking /></ProtectedRoute>} />
          </Routes>

          {/* Floating Chatbot Widget Fixed Across All Pages */}
          <AIChatbot />
        </div>
      </Router>
    </AuthProvider>
  );
}