
import { PlanTier, UserProfile } from "../types";
import { supabase, isSupabaseConfigured } from "./supabase";

export type PaymentProvider = 'mercadopago' | 'naranjax' | 'uala' | 'card';

export interface PlanConfig {
    id: PlanTier;
    name: string;
    price: number;
    yearlyPrice?: number;
    currency: string;
    description: string;
    features: string[];
    highlight?: boolean;
    color: string;
}

export const PLANS: Record<PlanTier, PlanConfig> = {
    free: {
        id: 'free',
        name: 'Initiate',
        price: 0,
        currency: 'ARS',
        description: 'Acceso básico al sistema.',
        color: '#71717a',
        features: [
            'Registro de historial básico',
            '3 Rutinas estándar',
            'Calculadora de discos',
            'Modo Offline'
        ]
    },
    trial: {
        id: 'trial',
        name: 'Trial Access',
        price: 0,
        currency: 'ARS',
        description: 'Prueba de potencia total.',
        color: '#F59E0B',
        features: [
            'Acceso TOTAL por 7 días',
            'Argon AI Coach ilimitado',
            'Todas las funciones Elite'
        ],
        highlight: true
    },
    pro: {
        id: 'pro',
        name: 'Pro Athlete',
        price: 9900,
        yearlyPrice: 99000,
        currency: 'ARS',
        description: 'Para quienes buscan resultados.',
        color: '#10B981',
        features: [
            'Rutinas AI Ilimitadas',
            'Nutrición Adaptativa',
            'Analíticas de Progreso',
            'Sin anuncios'
        ],
        highlight: true
    },
    elite: {
        id: 'elite',
        name: 'Elite Protocol',
        price: 18900,
        yearlyPrice: 189000,
        currency: 'ARS',
        description: 'Máximo rendimiento cognitivo y físico.',
        color: '#3B82F6',
        features: [
            'Todo lo incluido en Pro',
            'AI Coach con Memoria (GPT-4 Turbo)',
            'Análisis Biomecánico (Beta)',
            'Soporte Prioritario 24/7'
        ]
    }
};

export const paymentService = {
    hasAccess: (profile: UserProfile | null, feature: 'ai' | 'nutrition' | 'premium_routines' | 'advanced_stats'): boolean => {
        if (!profile || !profile.subscription) return false;

        const { plan, status, validUntil } = profile.subscription;

        // 1. Universal Status Check
        if (status !== 'active') return false;

        // 2. Expiry Check (Safety Net)
        if (validUntil) {
            const now = new Date();
            const expiry = new Date(validUntil);
            if (now > expiry) return false;
        }

        // 3. Plan Logic
        if (plan === 'free') return false;

        if (plan === 'elite' || plan === 'trial') return true;

        if (plan === 'pro') {
            // Pro has all access except advanced_stats (which is Elite only)
            if (feature === 'advanced_stats') return false;
            return true;
        }

        return false;
    },

    startFree: (): { plan: PlanTier, validUntil: string, startDate: string, status: 'active', autoRenew: boolean } => {
        const now = new Date();
        // Free tier technically "never" expires, but we set a long date for type compliance
        const nextYear = new Date();
        nextYear.setFullYear(now.getFullYear() + 100);

        return {
            plan: 'free',
            status: 'active',
            startDate: now.toISOString(),
            validUntil: nextYear.toISOString(),
            autoRenew: false
        };
    },

    startTrial: (): { plan: PlanTier, validUntil: string, startDate: string, status: 'active' } => {
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);

        return {
            plan: 'trial',
            status: 'active',
            startDate: now.toISOString(),
            validUntil: nextWeek.toISOString()
        };
    },

    initiateCheckout: async (planId: PlanTier, profileId: string, provider: PaymentProvider): Promise<{ url: string, status: 'redirecting' | 'manual' | 'success' }> => {
        // 1. Force backend usage - No offline/manual mode allowed for Premium
        if (!isSupabaseConfigured) {
            throw new Error("Payment System Offline: Supabase not configured.");
        }

        try {
            // We use the passed profileId or fetch from auth as backup
            let targetUserId = profileId;
            if (!targetUserId) {
                const { data: user } = await supabase.auth.getUser();
                if (user.user) targetUserId = user.user.id;
            }

            if (!targetUserId) throw new Error("Usuario no autenticado.");

            const plan = PLANS[planId];
            const amount = plan.price;

            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: {
                    planId,
                    provider,
                    userId: targetUserId,
                    amount,
                    // Back URLs are handled in the Edge Function now, but we can pass them if needed. 
                    // The EF enforces hardcoded ones for security, so we omit them here to reduce payload.
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            if (data?.url) {
                return { url: data.url, status: 'redirecting' };
            }

            throw new Error("Invalid response from Payment Gateway");
        } catch (e: any) {
            console.error("Payment Gateway Error:", e);
            return { url: '', status: 'manual' };
        }
    },

    createDonationCheckout: async (amount: number, provider: PaymentProvider = 'mercadopago'): Promise<{ url: string, status: 'redirecting' | 'success' }> => {
        if (!isSupabaseConfigured) {
            throw new Error("Payment System Offline: Supabase not configured.");
        }

        if (!amount || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
            throw new Error("Monto de donación inválido.");
        }

        try {
            // Optional: attach user ID if signed in, but allow anonymous too (EF handles null userId)
            const { data: user } = await supabase.auth.getUser();
            const userId = user?.user?.id;

            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: {
                    mode: 'donation', // REQUIRED
                    type: 'donation', // REQUIRED
                    amount,
                    provider,
                    userId, // Optional
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            if (data?.url) {
                return { url: data.url, status: 'redirecting' };
            }

            throw new Error("Invalid response from Payment Gateway");
        } catch (e: any) {
            console.error("Donation Error:", e);
            throw new Error(e.message || "Could not initiate donation.");
        }
    },

    getUserStatus: async (): Promise<{ premium: boolean }> => {
        try {
            const { data: user } = await supabase.auth.getUser();
            if (!user.user) {
                throw new Error("Usuario no autenticado.");
            }

            const { data, error } = await supabase.functions.invoke('user-status', {
                body: { userId: user.user.id }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            return data;
        } catch (e: any) {
            console.error("Status Error:", e);
            return { premium: false };
        }
    },

    getDaysLeft: (profile: UserProfile): number => {
        if (!profile.subscription) return 0;
        const now = new Date().getTime();
        const end = new Date(profile.subscription.validUntil).getTime();
        const diff = Math.ceil((end - now) / (1000 * 3600 * 24));
        return Math.max(0, diff);
    }
};
