
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { ICONS, COLORS } from '../constants';
import { ChatAssistant } from './ChatAssistant';
import { storage } from '../services/storage';
import { Routine } from '../types';
import { AnimatePresence, motion } from 'framer-motion';
import { paymentService } from '../services/payment';
import { supabase } from '../services/supabase';

const SidebarItem: React.FC<{ to: string; icon: React.ReactNode; label: string; onClick?: () => void }> = ({ to, icon, label, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      `flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group ${isActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'text-zinc-500 hover:text-white hover:bg-white/5'
      }`
    }
  >
    <span className="transition-transform group-hover:scale-110">{icon}</span>
    <span className="font-medium">{label}</span>
  </NavLink>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Routine[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Load state for user profile checking
  const [state, setState] = useState(storage.load());

  // Watch for local storage changes to update sidebar plan info
  useEffect(() => {
    const handleStorageChange = () => setState(storage.load());
    window.addEventListener('storage', handleStorageChange);
    // Interval fallback for SPA interactions not triggering 'storage' event
    const interval = setInterval(() => setState(storage.load()), 2000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    }
  }, []);

  // Filter logic
  useEffect(() => {
    if (searchTerm.trim().length > 0) {
      const lower = searchTerm.toLowerCase();
      const results = state.routines.filter(r =>
        r.name.toLowerCase().includes(lower) ||
        r.tags.some(t => t.toLowerCase().includes(lower))
      );
      setSearchResults(results.slice(0, 5)); // Limit to 5 results
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, state.routines]);

  // Click outside to close search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Payment Feedback Logic
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | null>(null);

  useEffect(() => {
    // Check both hash search (Router) AND main window search (Direct landing from MP)
    const params = new URLSearchParams(location.search || window.location.search);
    const payment = params.get('payment');
    const type = params.get('type');

    if (payment === 'success') {
      setPaymentStatus('success');

      // If we landed on the root from MP, we might want to navigate to the right hash route
      if (window.location.search.includes('payment=success')) {
        // Clean the main URL search part
        window.history.replaceState({}, '', window.location.origin + window.location.hash);

        if (type === 'donation') {
          alert("¡Gracias por apoyar el proyecto! ❤️");
          navigate('/subscription', { replace: true });
        } else {
          navigate('/subscription', { replace: true });
        }
      }

      storage.hydrateFromCloud().then(() => setState(storage.load()));
      setTimeout(() => setPaymentStatus(null), 5000);
    } else if (payment === 'cancelled') {
      setPaymentStatus('cancelled');
      if (window.location.search.includes('payment=cancelled')) {
        window.history.replaceState({}, '', window.location.origin + window.location.hash);
        navigate('/subscription', { replace: true });
      }
      setTimeout(() => setPaymentStatus(null), 5000);
    }
  }, [location, navigate]);

  const isAuthPage = location.pathname === '/auth';
  const plan = state.profile?.subscription?.plan || 'free';
  const isPremium = plan !== 'free';
  const daysLeft = state.profile ? paymentService.getDaysLeft(state.profile) : 0;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    storage.reset();
    navigate('/auth');
  };

  return (
    <div className="flex min-h-screen bg-[#0A0F0D]">

      {/* --- MOBILE MENU DRAWER --- */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 z-[60] backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-[#0A0F0D] border-r border-white/10 z-[70] p-6 flex flex-col gap-8 md:hidden shadow-2xl overflow-y-auto"
            >
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.57 14.86L22 13.43L20.57 12L17 15.57L8.43 7L12 3.43L10.57 2L9.14 3.43L7.71 2L5.57 4.14L4.14 2.71L2.71 4.14L4.14 5.57L2 7.71L3.43 9.14L2 10.57L3.43 12L7 8.43L15.57 17L12 20.57L13.43 22L14.86 20.57L16.29 22L18.43 19.86L19.86 21.29L21.29 19.86L19.86 18.43L22 16.29L20.57 14.86Z" />
                    </svg>
                  </div>
                  <span className="text-xl font-bold tracking-tighter italic text-white">ARGON<span className="text-emerald-500">FIT PRO</span></span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-zinc-500 hover:text-white p-2">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Mobile Plan Button - Updated Visibility */}
              <div
                onClick={() => { navigate('/subscription'); setIsMobileMenuOpen(false); }}
                className="mx-2 mt-4 p-4 rounded-2xl cursor-pointer bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] relative overflow-hidden group"
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/20 text-black font-bold">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-black text-black uppercase tracking-widest leading-none">{isPremium ? 'PLAN ACTIVO' : 'ACTUALIZAR PLAN'}</p>
                    <p className="text-[10px] text-black/70 font-bold mt-1 uppercase">Acceder a Elite</p>
                  </div>
                </div>
              </div>

              <nav className="flex-1 flex flex-col gap-2 mt-2">
                <SidebarItem to="/" icon={ICONS.Dashboard} label="Inicio" onClick={() => setIsMobileMenuOpen(false)} />
                <SidebarItem to="/routines" icon={ICONS.Routines} label="Rutinas" onClick={() => setIsMobileMenuOpen(false)} />
                <SidebarItem to="/nutrition" icon={ICONS.Nutrition} label="Nutrición" onClick={() => setIsMobileMenuOpen(false)} />
                <SidebarItem to="/calculator" icon={ICONS.Calculator} label="Discos" onClick={() => setIsMobileMenuOpen(false)} />
                <SidebarItem to="/history" icon={ICONS.History} label="Historial" onClick={() => setIsMobileMenuOpen(false)} />
                <SidebarItem to="/calendar" icon={ICONS.Calendar} label="Calendario" onClick={() => setIsMobileMenuOpen(false)} />
                <SidebarItem to="/profile" icon={ICONS.Profile} label="Perfil" onClick={() => setIsMobileMenuOpen(false)} />

                <div className="px-2 mt-2">
                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: "0 0 25px rgba(16, 185, 129, 0.3)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { navigate('/subscription?target=donation'); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-emerald-400 to-emerald-600 text-black py-4 rounded-2xl transition-all relative overflow-hidden group border border-emerald-400/50 shadow-[0_4px_15px_rgba(0,0,0,0.3)]"
                  >
                    {/* Animated Shine */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 translate-x-[-200%]"
                      animate={{ translateX: ["200%", "-200%"] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    />
                    <span className="font-black text-[11px] uppercase tracking-[0.2em] relative z-10 italic">Donar Ahora</span>
                    <span className="relative z-10 text-lg group-hover:scale-125 transition-transform duration-300">❤️</span>
                  </motion.button>
                </div>


                <div className="mt-auto pt-6 border-t border-white/5">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group text-zinc-500 hover:text-white hover:bg-white/5"
                  >
                    <span className="transition-transform group-hover:scale-110 text-red-500 group-hover:text-red-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </span>
                    <span className="font-medium">Cerrar Sesión</span>
                  </button>
                </div>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      {!isAuthPage && (
        <aside className="w-64 border-r border-white/5 p-6 flex flex-col gap-6 sticky top-0 h-screen hidden md:flex bg-[#0A0F0D]">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.57 14.86L22 13.43L20.57 12L17 15.57L8.43 7L12 3.43L10.57 2L9.14 3.43L7.71 2L5.57 4.14L4.14 2.71L2.71 4.14L4.14 5.57L2 7.71L3.43 9.14L2 10.57L3.43 12L7 8.43L15.57 17L12 20.57L13.43 22L14.86 20.57L16.29 22L18.43 19.86L19.86 21.29L21.29 19.86L19.86 18.43L22 16.29L20.57 14.86Z" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tighter italic">ARGON<span className="text-emerald-500">FIT PRO</span></span>
          </div>

          {/* Desktop Plan Button */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/subscription')}
            className="relative mt-2 cursor-pointer group"
          >
            {/* Glowing border effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl opacity-75 blur-sm group-hover:opacity-100 transition duration-200 animate-pulse"></div>

            {/* Button content */}
            <div className="relative flex items-center gap-4 p-4 bg-emerald-500 rounded-xl leading-none">
              <div className="w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm border border-black/10">
                <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
              </div>
              <div>
                <p className="text-xs font-black text-black uppercase tracking-widest mb-1">
                  {isPremium ? `${plan.toUpperCase()}` : 'MEJORAR PLAN'}
                </p>
                <p className="text-[10px] text-black/70 font-bold uppercase tracking-wider">
                  {isPremium ? 'Acceso Total' : 'Desbloquear Todo'}
                </p>
              </div>

              {/* Shine effect */}
              <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-40 group-hover:animate-shine" />
            </div>
          </motion.div>

          <nav className="flex-1 flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
            <SidebarItem to="/" icon={ICONS.Dashboard} label="Inicio" />
            <SidebarItem to="/routines" icon={ICONS.Routines} label="Rutinas" />
            <SidebarItem to="/nutrition" icon={ICONS.Nutrition} label="Nutrición" />
            <SidebarItem to="/calculator" icon={ICONS.Calculator} label="Discos" />
            <SidebarItem to="/history" icon={ICONS.History} label="Historial" />
            <SidebarItem to="/calendar" icon={ICONS.Calendar} label="Calendario" />
            <SidebarItem to="/profile" icon={ICONS.Profile} label="Perfil" />

            <div className="px-2 mt-2">
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(16, 185, 129, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/subscription?target=donation')}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-emerald-400 to-emerald-600 text-black py-4 rounded-2xl transition-all relative overflow-hidden group border border-emerald-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
              >
                {/* Advanced Shine Effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 translate-x-[-200%]"
                  animate={{ translateX: ["200%", "-200%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />

                {/* Subtle Radial Gradient Overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <span className="font-black text-[11px] uppercase tracking-[0.2em] relative z-10 italic">Donar Ahora</span>
                <span className="relative z-10 text-lg group-hover:scale-125 transition-transform duration-300">❤️</span>
              </motion.button>
            </div>
          </nav>

          <div className="mt-auto pt-4 border-t border-white/5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group text-zinc-500 hover:text-white hover:bg-white/5"
            >
              <span className="transition-transform group-hover:scale-110 text-red-500 group-hover:text-red-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </span>
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto relative">

        {/* Persistent Search Header */}
        {!isAuthPage && (
          <header className="sticky top-0 z-40 px-4 md:px-8 py-4 pointer-events-none flex items-start gap-4">
            {/* Mobile Menu Toggle */}
            <div className="md:hidden pointer-events-auto mt-1">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="w-10 h-10 flex items-center justify-center bg-[#151B18]/80 backdrop-blur-xl border border-white/10 rounded-xl text-zinc-400 hover:text-white hover:border-emerald-500/50 transition-all shadow-lg"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
              </button>
            </div>

            <div className="flex justify-center max-w-6xl mx-auto flex-1 md:flex-none md:w-auto">
              <div
                ref={searchRef}
                className={`pointer-events-auto bg-[#151B18]/80 backdrop-blur-xl border transition-all duration-300 rounded-2xl flex items-center gap-3 px-4 shadow-xl ${isSearchFocused ? 'w-full md:w-96 border-emerald-500 ring-1 ring-emerald-500/50' : 'w-12 md:w-64 border-white/10 hover:border-white/20'}`}
              >
                <svg className={`w-5 h-5 flex-shrink-0 transition-colors ${isSearchFocused ? 'text-emerald-500' : 'text-zinc-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar rutinas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  className={`bg-transparent border-none outline-none text-white text-sm h-12 w-full placeholder:text-zinc-600 font-medium ${!isSearchFocused ? 'hidden md:block' : 'block'}`}
                />
                {!isSearchFocused && (
                  <button
                    onClick={() => navigate('/subscription?target=donation')}
                    className="flex md:hidden items-center justify-center p-2 text-emerald-400 animate-bounce bg-emerald-500/10 rounded-xl border border-emerald-500/20"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                  </button>
                )}
                {isSearchFocused && searchTerm && (
                  <button onClick={() => { setSearchTerm(''); setSearchResults([]); }} className="text-zinc-500 hover:text-white">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}

                {/* Search Dropdown */}
                <AnimatePresence>
                  {isSearchFocused && searchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full right-0 left-0 mt-2 bg-[#151B18] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                    >
                      <div className="p-2">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 py-2 block">Resultados</span>
                        {searchResults.map(r => (
                          <div
                            key={r.id}
                            onClick={() => {
                              navigate(`/routine/${r.id}`);
                              setIsSearchFocused(false);
                              setSearchTerm('');
                            }}
                            className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer group"
                          >
                            <img src={r.imageUrl} className="w-10 h-10 rounded-md object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                            <div className="overflow-hidden">
                              <h4 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">{r.name}</h4>
                              <div className="flex gap-2">
                                {r.tags.slice(0, 2).map(t => <span key={t} className="text-[9px] text-zinc-500 uppercase">{t}</span>)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Header Donation Shortcut (Desktop) - Enhanced Visibility */}
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/subscription?target=donation')}
                className="hidden md:flex ml-4 pointer-events-auto items-center gap-2 bg-emerald-500 text-black px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all border-none relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <span className="relative z-10">Donar</span>
                <span className="relative z-10 animate-pulse">❤️</span>
              </motion.button>
            </div>
          </header>
        )}

        <div className={`flex-1 p-4 md:p-8 w-full max-w-6xl mx-auto ${!isAuthPage ? '-mt-20 pt-24' : ''}`}>
          {children}
        </div>

        {/* Footer */}
        {!isAuthPage && (
          <footer className="w-full border-t border-white/5 bg-[#050806] py-12 px-8 mt-auto">
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="col-span-1 md:col-span-2">
                <span className="text-xl font-bold tracking-tighter italic block mb-4">ARGON<span className="text-emerald-500">FIT PRO</span></span>
                <p className="text-zinc-500 text-sm leading-relaxed max-w-sm">
                  La plataforma definitiva de entrenamiento impulsada por inteligencia artificial.
                  Diseñada para atletas que buscan romper sus límites con precisión y datos.
                </p>
              </div>
              <div>
                <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-zinc-500">
                  <li><Link to="/terms" className="hover:text-emerald-500 transition-colors">Términos y Condiciones</Link></li>
                  <li><Link to="/privacy" className="hover:text-emerald-500 transition-colors">Política de Privacidad</Link></li>
                  <li><Link to="/license" className="hover:text-emerald-500 transition-colors">Licencia de Uso</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-4">Soporte</h4>
                <ul className="space-y-2 text-sm text-zinc-500">
                  <li><Link to="/contact" className="hover:text-emerald-500 transition-colors">Contacto</Link></li>
                  <li><Link to="/help" className="hover:text-emerald-500 transition-colors">Centro de Ayuda</Link></li>
                  <li><Link to="/status" className="hover:text-emerald-500 transition-colors">Estado del Sistema</Link></li>
                </ul>
              </div>
            </div>
            <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-white/5 text-center text-[10px] text-zinc-600 uppercase tracking-widest">
              © 2024 Argon Fit Technologies. Todos los derechos reservados.
            </div>
          </footer>
        )}
      </main>

      {/* AI Chatbot Overlay - Hidden on Auth */}
      {!isAuthPage && <ChatAssistant />}

      {/* Payment Notification Toast */}
      <AnimatePresence>
        {paymentStatus && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -50, x: 20 }}
            className={`fixed top-4 right-4 z-[100] px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-4 backdrop-blur-md ${paymentStatus === 'success'
              ? 'bg-emerald-900/90 border-emerald-500 text-white shadow-emerald-500/20'
              : 'bg-red-900/90 border-red-500 text-white shadow-red-500/20'
              }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner ${paymentStatus === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
              {paymentStatus === 'success' ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              )}
            </div>
            <div>
              <h4 className="font-bold text-lg leading-none mb-1">{paymentStatus === 'success' ? '¡Pago Exitoso!' : 'Pago Cancelado'}</h4>
              <p className="text-xs opacity-80 font-medium">{paymentStatus === 'success' ? 'Disfruta tu plan Premium.' : 'No se ha realizado ningún cargo.'}</p>
            </div>
            <button onClick={() => setPaymentStatus(null)} className="ml-2 hover:bg-white/20 p-2 rounded-full transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
};
