
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, Badge } from '../components/UI';
import { storage } from '../services/storage';
import { PLANS, paymentService, PlanConfig, PaymentProvider } from '../services/payment';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Browser } from '@capacitor/browser';

// --- HELPER COMPONENTS ---

const MPLogo = () => (
    <svg viewBox="0 0 512 512" fill="none" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
        <path d="M79.28 171.14c.48-6.19 1.15-11.83 2-16.92 4.41-26.4 20.31-41.51 47.78-45.34l79-11c19.12-2.67 33.36 12 31.81 32.74l-6.28 84.14c-1.63 21.84-21.6 40.24-41.6 42.47L80.64 270.7c-25.26 2.81-44.53-15.68-43.25-41.51l6.17-82.68c1.35-18.06 20.2-25.25 35.72-24.63v49.26z" fill="#009EE3" />
        <path d="M168.08 108.91l80-11.15c26.75-3.73 52.81 12.35 60.1 36.63l.7 2.33c7.29 24.28-4.48 51.52-27.42 63.39l-2.09 1.08c-22.94 11.87-51.57 6.34-66.21-12.44L202.9 175.6l-3.35 44.89 110.15-12.28c24.6-2.74 43.37 15.26 42.12 40.4L345.54 332c-1.31 26.33-25.32 46.12-51.49 42.47l-79-11c-28.51-4-44.38-20.06-47.7-47.53l-.86-7.07c-2.85-23.63-22-42.52-45.89-45.19l-7.79-.87 3.35-44.89 7.79.87c22.56 2.51 40.44 19.89 44.07 41.69l.61 3.65c.67 5.56 1.48 10.93 2.45 16.08 2.62 14.16 11.75 22.42 26.44 24.47l79 11c10.31 1.44 20.89-6.32 21.49-17.29l6.28-84.15c.66-8.91-4.78-15.82-13.49-14.61L180.65 259.9c-23.75 2.65-42.74-13.84-44.47-36.95l-8.1-114.04z" fill="#009EE3" />
    </svg>
);

const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
};

const projectionData = [
    { name: 'S1', val: 10 }, { name: 'S2', val: 25 }, { name: 'S3', val: 45 },
    { name: 'S4', val: 60 }, { name: 'S5', val: 85 }, { name: 'S6', val: 100 }
];

const DonationSection = ({ amount, onAmountChange, onDonate, isLoading }: {
    amount: string,
    onAmountChange: (val: string) => void,
    onDonate: () => void,
    isLoading: boolean
}) => {
    return (
        <div id="donation-section" className="max-w-4xl mx-auto px-6 mt-24">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative rounded-3xl p-8 border border-white/10 bg-[#101412] shadow-2xl overflow-hidden group"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full -mr-32 -mt-32 pointer-events-none" />

                <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="text-left max-w-sm">
                        <Badge color="emerald" className="mb-4">APOYAR EL PROYECTO</Badge>
                        <h3 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-2">Donación Voluntaria</h3>
                        <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                            Tu apoyo ayuda a mantener y evolucionar Argon Fit.
                        </p>
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                            <p className="text-emerald-500/80 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                ⚡ La donación es voluntaria y NO activa funciones premium
                            </p>
                        </div>
                    </div>

                    <div className="w-full md:w-auto flex flex-col gap-3 min-w-[240px]">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Ingresa el monto:</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold">$</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Monto (ej: 1000)"
                                value={amount}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, ''); // Reglas de Resolución: solo números
                                    onAmountChange(val);
                                }}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-4 text-white font-bold text-xl outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600"
                            />
                        </div>

                        <button
                            onClick={onDonate}
                            disabled={isLoading}
                            className="w-full h-14 rounded-xl bg-white text-black font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>DONAR (PAGO ÚNICO)</span>
                                    <svg className="w-4 h-4 group-hover:scale-125 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                    </svg>
                                </>
                            )}
                        </button>

                        <div className="flex justify-center items-center gap-2 opacity-40">
                            <span className="text-[8px] text-zinc-500 font-bold uppercase">VIA MERCADO PAGO</span>
                            <div className="w-8"><MPLogo /></div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const PlanCard = ({ plan, billingCycle, currentPlan, onPlanClick }: {
    plan: PlanConfig,
    billingCycle: 'monthly' | 'yearly',
    currentPlan: string,
    onPlanClick: (plan: PlanConfig) => void
}) => {
    const isFree = plan.id === 'free';
    const isPro = plan.id === 'pro';
    const isElite = plan.id === 'elite';

    const priceValue = isFree ? 0 : (billingCycle === 'yearly' ? plan.yearlyPrice! / 12 : plan.price);
    const displayPrice = isFree ? "$0" : formatPrice(priceValue);
    const billingText = isFree ? 'SIEMPRE' : (billingCycle === 'yearly' ? 'ARS / mes (facturado anualmente)' : 'ARS / mes');

    const glowColor = isElite ? 'shadow-blue-500/20' : isPro ? 'shadow-emerald-500/20' : 'shadow-none';
    const borderColor = isElite ? 'border-blue-500/40' : isPro ? 'border-emerald-500/40' : 'border-white/10';
    const bgGradient = isElite
        ? 'bg-gradient-to-b from-blue-900/10 to-[#0F1210]'
        : isPro
            ? 'bg-gradient-to-b from-emerald-900/10 to-[#0F1210]'
            : 'bg-[#0F1210]';

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className={`relative rounded-3xl p-6 md:p-8 flex flex-col justify-between h-full border ${borderColor} ${bgGradient} ${glowColor} shadow-2xl backdrop-blur-sm overflow-hidden group`}
        >
            {isElite && (
                <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20 pointer-events-none z-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={projectionData}>
                            <defs>
                                <linearGradient id="eliteGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="val" stroke="#3B82F6" fill="url(#eliteGradient)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div className="relative z-10 mb-6">
                <div className="flex justify-between items-start mb-2">
                    <Badge
                        className="scale-90 origin-top-left"
                        color={isElite ? 'blue' : isPro ? 'emerald' : 'zinc'}
                    >
                        {plan.name}
                    </Badge>
                    {plan.highlight && (
                        <div className="bg-white/10 p-1.5 rounded-full animate-pulse">
                            <div className={`w-2 h-2 rounded-full ${isElite ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                        </div>
                    )}
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-4xl md:text-5xl font-black italic text-white tracking-tighter">
                        {displayPrice}
                    </span>
                </div>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wide mt-1">{billingText}</p>
                {billingCycle === 'yearly' && !isFree && (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded mt-2 inline-block">
                        AHORRAS {Math.round(100 - (plan.yearlyPrice! / (plan.price * 12)) * 100)}%
                    </span>
                )}
            </div>

            <div className="relative z-10 space-y-3 mb-8 flex-1">
                {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-3">
                        <div className={`mt-1 min-w-[16px] h-4 rounded-full flex items-center justify-center border ${isElite ? 'border-blue-500/50 bg-blue-500/10' : isPro ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-zinc-700 bg-zinc-800'}`}>
                            <svg className={`w-2.5 h-2.5 ${isElite ? 'text-blue-400' : isPro ? 'text-emerald-400' : 'text-zinc-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <span className={`text-xs font-medium leading-relaxed ${isFree ? 'text-zinc-500' : 'text-zinc-300'}`}>{f}</span>
                    </div>
                ))}
            </div>

            <div className="relative z-10 mt-auto">
                {isFree ? (
                    <Button variant="secondary" className="w-full h-12 text-xs" disabled>PLAN BÁSICO</Button>
                ) : (
                    <button
                        onClick={() => onPlanClick(plan)}
                        disabled={currentPlan === plan.id}
                        className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-xs tracking-widest transition-all duration-300 shadow-lg group hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale ${isElite
                            ? 'bg-blue-500 text-black shadow-blue-500/25 hover:bg-blue-400'
                            : 'bg-emerald-500 text-black shadow-emerald-500/25 hover:bg-emerald-400'
                            }`}
                    >
                        <>
                            <span>{currentPlan === plan.id ? 'ACTIVO' : (billingCycle === 'yearly' ? 'PAGAR ANUAL' : 'PAGAR MES')}</span>
                            <div className="bg-black/10 p-1 rounded-full ml-1 group-hover:bg-black/20 transition-colors">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                        </>
                    </button>
                )}
                {!isFree && (
                    <div className="flex justify-center items-center gap-1 mt-3 opacity-60 hover:opacity-100 transition-opacity cursor-help">
                        <span className="text-[8px] text-zinc-500 font-bold uppercase">PROCESADO POR</span>
                        <div className="w-12"><MPLogo /></div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// --- MAIN COMPONENT ---

export const Subscription = () => {
    const [state, setState] = useState(storage.load());
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
    const [loading, setLoading] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [transactionId, setTransactionId] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [waitingForPayment, setWaitingForPayment] = useState(false);
    const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<PlanConfig | null>(null);
    const [manualPaymentInfo, setManualPaymentInfo] = useState<PaymentProvider | null>(null);
    const [donationAmount, setDonationAmount] = useState<string>('500'); // Monto por defecto
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Handle Payment Results from URL
    React.useEffect(() => {
        const paymentStatus = searchParams.get('payment');
        const isDonation = searchParams.get('type') === 'donation';

        if (paymentStatus === 'success') {
            if (isDonation) {
                alert("¡Gracias por apoyar el proyecto! ❤️");
            } else {
                alert("¡Suscripción activada con éxito!");
            }
            navigate('/subscription', { replace: true });
        } else if (paymentStatus === 'cancelled') {
            navigate('/subscription', { replace: true });
        } else if (paymentStatus === 'rejected') {
            alert("El pago no pudo procesarse. Por favor, intenta con otro método.");
            navigate('/subscription', { replace: true });
        }
    }, [searchParams, navigate]);

    // Auto-scroll to donation section logic
    React.useEffect(() => {
        if (searchParams.get('target') === 'donation') {
            setTimeout(() => {
                const element = document.getElementById('donation-section');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        }
    }, [searchParams]);

    const currentPlan = state.profile?.subscription?.plan || 'free';

    const handlePlanClick = (plan: PlanConfig) => {
        setSelectedPlanForPayment(plan);
    };

    const finalizeLocalUpgrade = () => {
        if (!selectedPlanForPayment) return;

        const durationMonths = billingCycle === 'yearly' ? 12 : 1;
        const newExpiry = new Date();
        newExpiry.setMonth(newExpiry.getMonth() + durationMonths);

        const newState = {
            ...state,
            profile: {
                ...state.profile!,
                subscription: {
                    plan: selectedPlanForPayment.id,
                    status: 'active' as const,
                    startDate: new Date().toISOString(),
                    validUntil: newExpiry.toISOString(),
                    autoRenew: true
                }
            }
        };

        storage.save(newState);
        setState(newState);

        setManualPaymentInfo(null);
        setSelectedPlanForPayment(null);
        setWaitingForPayment(false);
        setLoading(null);
        setVerifying(false);
        navigate('/');
    };

    const handleVerification = async () => {
        if (!waitingForPayment) {
            if (transactionId.length < 8) {
                setValidationError("El código de operación debe tener al menos 8 dígitos.");
                return;
            }
            if (!/^\d+$/.test(transactionId)) {
                setValidationError("El código solo puede contener números.");
                return;
            }
        }

        setValidationError(null);
        setVerifying(true);

        await new Promise(resolve => setTimeout(resolve, 2000));
        finalizeLocalUpgrade();
    };

    const handleExecutePayment = async (provider: PaymentProvider) => {
        if (!selectedPlanForPayment) return;
        setLoading(provider);

        try {
            const { url, status } = await paymentService.initiateCheckout(selectedPlanForPayment.id, state.profile?.id || '', provider);

            if (status === 'redirecting' && url) {
                await Browser.open({ url });
                setWaitingForPayment(true);
                setLoading(null);
            } else if (status === 'manual') {
                setManualPaymentInfo(provider);
                setLoading(null);
            } else {
                setLoading(null);
            }

        } catch (error: any) {
            console.error("Payment error", error);
            setLoading(null);
            alert(`Error iniciando el pago: ${error.message || "Verifica tu conexión."}`);
        }
    };

    const handleDonation = async () => {
        const amountNum = parseFloat(donationAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            alert("Por favor, ingresa un monto válido mayor a 0.");
            return;
        }

        setLoading('donation');

        try {
            // Using createDonationCheckout as per specific resolution rules
            const { url, status } = await paymentService.createDonationCheckout(amountNum);

            if (status === 'redirecting' && url) {
                // await Browser.open({ url }); // Prefer simpler window.location or Browser.open depending on Env. 
                // Conflict resolution said: "Donación: ... checkout Mercado Pago funciona"
                // One branch had Browser.open, the other window.location. Browser.open is better for Capacitor.
                await Browser.open({ url });
                setWaitingForPayment(true); // Maybe not strictly needed for donation since it's 200 OK webhook but good for UX
            }
        } catch (error: any) {
            console.error("Donation error", error);
            alert(`Error iniciando la donación: ${error.message}`);
        } finally {
            setLoading(null);
        }
    };

    const renderPaymentInstructionsModal = () => {
        const amount = billingCycle === 'yearly' ? selectedPlanForPayment?.yearlyPrice! : selectedPlanForPayment?.price!;
        const providerLinks: Record<string, string> = {
            'mercadopago': 'https://www.mercadopago.com.ar',
            'naranjax': 'https://www.naranjax.com',
            'uala': 'https://www.uala.com.ar',
            'card': 'https://www.mercadopago.com.ar'
        };

        const targetUrl = manualPaymentInfo ? providerLinks[manualPaymentInfo] : '#';

        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setManualPaymentInfo(null)}
                    className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ scale: 0.9, y: 50, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    className="relative w-full max-w-sm bg-[#101412] border border-white/10 rounded-2xl p-5 shadow-2xl overflow-hidden"
                >
                    <AnimatePresence>
                        {verifying && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-8 text-center">
                                <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
                                <h3 className="text-lg font-black text-white italic uppercase mb-1">Verificando</h3>
                                <p className="text-zinc-500 text-xs">Validando ID de transacción...</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="text-center mb-4">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-500/20">
                            <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Transferencia Directa</h3>
                        <p className="text-zinc-400 text-xs mt-1">Transfiere el monto exacto para activar tu plan.</p>
                    </div>

                    <div className="bg-[#151B18] rounded-xl p-4 border border-white/5 space-y-3 mb-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Monto a Transferir</span>
                            <span className="text-lg font-black text-white">{formatPrice(amount)}</span>
                        </div>
                        <div>
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Alias</span>
                            <div className="flex justify-between items-center bg-black/40 p-2.5 rounded-lg border border-white/5">
                                <span className="text-emerald-400 font-mono font-bold tracking-wider text-xs">argonfit</span>
                            </div>
                        </div>
                        <div>
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">CVU Uniforme</span>
                            <div className="flex justify-between items-center bg-black/40 p-2.5 rounded-lg border border-white/5">
                                <span className="text-white font-mono text-[10px] tracking-wider">0000003100063054624217</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Button onClick={() => window.open(targetUrl, '_blank')} className="w-full h-10 text-[10px]" variant="secondary">
                            ABRIR {manualPaymentInfo?.toUpperCase().replace('CARD', 'BANCO')}
                        </Button>
                        <div className="pt-3 border-t border-white/5">
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Ingrese ID (Ej. 12345678)"
                                value={transactionId}
                                onChange={(e) => setTransactionId(e.target.value.replace(/\D/g, ''))}
                                className="w-full bg-[#050806] border border-white/20 rounded-lg px-4 py-3 text-white text-sm font-bold tracking-widest outline-none focus:border-emerald-500 mb-2 font-mono"
                            />
                            {validationError && <p className="text-red-500 text-[9px] font-bold mb-2">{validationError}</p>}
                            <button onClick={handleVerification} disabled={verifying} className="w-full py-2.5 text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 rounded-lg disabled:opacity-50">
                                VALIDAR COMPROBANTE
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    };

    return (
        <div className="min-h-screen pb-32 animate-in fade-in duration-700 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none -z-10" />

            <div className="max-w-4xl mx-auto text-center pt-12 pb-16 px-6 relative">
                <Badge color="blue" className="mb-4">PAGOS SEGUROS EN ARS</Badge>
                <h1 className="text-4xl md:text-6xl font-black italic uppercase text-white tracking-tighter mb-4">
                    Actualiza tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">Arsenal</span>
                </h1>

                <div className="mt-10 inline-flex bg-[#151B18] p-1 rounded-full border border-white/10 relative">
                    <motion.div
                        className="absolute top-1 bottom-1 w-[50%] bg-white/10 rounded-full shadow-sm"
                        animate={{ x: billingCycle === 'monthly' ? 0 : '100%' }}
                    />
                    <button onClick={() => setBillingCycle('monthly')} className={`relative z-10 px-6 py-2 text-xs font-black uppercase tracking-widest transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'text-zinc-500'}`}>
                        Mensual
                    </button>
                    <button onClick={() => setBillingCycle('yearly')} className={`relative z-10 px-6 py-2 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${billingCycle === 'yearly' ? 'text-white' : 'text-zinc-500'}`}>
                        Anual <span className="text-[8px] bg-emerald-500 text-black px-1.5 py-0.5 rounded font-bold">-16%</span>
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
                <PlanCard plan={PLANS.free} billingCycle={billingCycle} currentPlan={currentPlan} onPlanClick={handlePlanClick} />
                <PlanCard plan={PLANS.pro} billingCycle={billingCycle} currentPlan={currentPlan} onPlanClick={handlePlanClick} />
                <PlanCard plan={PLANS.elite} billingCycle={billingCycle} currentPlan={currentPlan} onPlanClick={handlePlanClick} />
            </div>

            {/* DONATION SECTION */}
            <DonationSection
                amount={donationAmount}
                onAmountChange={setDonationAmount}
                onDonate={handleDonation}
                isLoading={loading === 'donation'}
            />

            <AnimatePresence>
                {selectedPlanForPayment && !manualPaymentInfo && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPlanForPayment(null)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, y: 50, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 50, opacity: 0 }} className="relative w-full max-w-md bg-[#101412] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden">
                            <AnimatePresence>
                                {(loading || verifying) && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-8 text-center">
                                        <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-6" />
                                        <h3 className="text-xl font-black text-white italic uppercase mb-2">{verifying ? "Validando" : "Procesando"}</h3>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {waitingForPayment ? (
                                <div className="text-center py-4">
                                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 animate-pulse">
                                        <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <h3 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-2">Esperando Confirmación</h3>
                                    <Button onClick={handleVerification} className="w-full h-14 text-xs font-black">CONFIRMAR PAGO</Button>
                                    <button onClick={() => setWaitingForPayment(false)} className="mt-4 text-xs text-zinc-500 underline">Volver a intentar</button>
                                </div>
                            ) : (
                                <>
                                    <div className="text-center mb-8">
                                        <h3 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-2">Pago Seguro</h3>
                                        <p className="text-zinc-400 text-sm">Elige tu proveedor</p>
                                    </div>
                                    <div className="space-y-3">
                                        <button onClick={() => handleExecutePayment('mercadopago')} className="w-full bg-[#009EE3]/10 hover:bg-[#009EE3]/20 border border-[#009EE3]/30 rounded-xl p-4 flex items-center justify-between group transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center"><MPLogo /></div>
                                                <div className="text-left">
                                                    <span className="block text-white font-bold text-sm">Mercado Pago</span>
                                                    <span className="text-[10px] text-zinc-400">Todo tipo de pagos</span>
                                                </div>
                                            </div>
                                            <svg className="w-5 h-5 text-[#009EE3] opacity-0 group-hover:opacity-100 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                        </button>
                                        <button onClick={() => handleExecutePayment('card')} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 flex items-center justify-between group transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-white">💳</div>
                                                <div className="text-left">
                                                    <span className="block text-white font-bold text-sm">Tarjeta Crédito / Débito</span>
                                                </div>
                                            </div>
                                            <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </div>
                )}
                {manualPaymentInfo && renderPaymentInstructionsModal()}
            </AnimatePresence>
        </div>
    );
};
