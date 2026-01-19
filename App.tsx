
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './screens/Dashboard';
import { Routines } from './screens/Routines';
import { Workout } from './screens/Workout';
import { History } from './screens/History';
import { Profile } from './screens/Profile';
import { Onboarding } from './screens/Onboarding';
import { PlateCalculator } from './screens/PlateCalculator';
import { RoutineDetail } from './screens/RoutineDetail';
import { CalendarView } from './screens/CalendarView';
import { Nutrition } from './screens/Nutrition';
import { Subscription } from './screens/Subscription';
import { Terms, Privacy, Contact, License } from './screens/Legal';
import { HelpCenter, SystemStatus } from './screens/Support';
import { storage } from './services/storage';
import { supabase } from './services/supabase';
import { UserProfile } from './types';

// 0. Error Boundary for Production
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("APP CRASH:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0F0D] flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4">Sistema Fuera de Línea</h2>
          <p className="text-zinc-500 text-sm max-w-xs mb-8">Se ha producido un error crítico. Reinicia la aplicación para intentar recuperar el acceso.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-emerald-500 transition-colors"
          >
            REINICIAR MOTOR
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode, hasProfile: boolean }> = ({ children, hasProfile }) => {
  if (!hasProfile) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  const [appState, setAppState] = useState(storage.load());
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    // 1. Initial Cloud Hydration attempt
    const init = async () => {
      try {
        await storage.hydrateFromCloud(); // Try to update local storage from cloud
        setAppState(storage.load()); // Reload state into React
      } catch (e) {
        console.warn("Init hydration failed:", e);
      } finally {
        setIsAuthChecking(false);
      }
    };
    init();

    // 2. Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        setIsAuthChecking(true);
        await storage.hydrateFromCloud();
        setAppState(storage.load());
        setIsAuthChecking(false);
      } else if (event === 'SIGNED_OUT') {
        setAppState(storage.reset());
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthComplete = (profile: UserProfile) => {
    setAppState(storage.load());
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#0A0F0D] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05),transparent_70%)] animate-pulse" />
        <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-6" />
        <div className="text-emerald-500 font-bold tracking-[0.5em] animate-pulse text-xs font-tech">ARGON SYSTEM LOADING...</div>
      </div>
    );
  }

  const hasProfile = !!appState.profile;

  return (
    <ErrorBoundary>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calculator" element={<PlateCalculator />} />

            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/license" element={<License />} />
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/status" element={<SystemStatus />} />

            <Route
              path="/auth"
              element={hasProfile ? <Navigate to="/" /> : <Onboarding onComplete={handleAuthComplete} />}
            />

            <Route path="/subscription" element={
              <ProtectedRoute hasProfile={hasProfile}>
                <Subscription />
              </ProtectedRoute>
            } />

            <Route path="/routines" element={
              <ProtectedRoute hasProfile={hasProfile}>
                <Routines />
              </ProtectedRoute>
            } />
            <Route path="/nutrition" element={
              <ProtectedRoute hasProfile={hasProfile}>
                <Nutrition />
              </ProtectedRoute>
            } />
            <Route path="/routine/:id" element={
              <ProtectedRoute hasProfile={hasProfile}>
                <RoutineDetail />
              </ProtectedRoute>
            } />
            <Route path="/workout" element={
              <ProtectedRoute hasProfile={hasProfile}>
                <Workout />
              </ProtectedRoute>
            } />
            <Route path="/history" element={
              <ProtectedRoute hasProfile={hasProfile}>
                <History />
              </ProtectedRoute>
            } />
            <Route path="/calendar" element={
              <ProtectedRoute hasProfile={hasProfile}>
                <CalendarView />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute hasProfile={hasProfile}>
                <Profile />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
