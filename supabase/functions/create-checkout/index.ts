import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { MercadoPagoConfig, Preference } from "npm:mercadopago";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode, type, amount, planId, userId, currency } = body;

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
    const mpEnv = Deno.env.get("MP_ENV") || "prod"; // Default to prod

    if (!accessToken) throw new Error("Missing Mercado Pago credentials");

    const mp = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(mp);

    // Dominios autorizados exactos para evitar bloqueo de MP
    const backUrls = {
      success: "https://argonfit.pro/?payment=success",
      failure: "https://argonfit.pro/?payment=cancelled",
      pending: "https://argonfit.pro/?payment=pending",
    };

    console.log(`[CHECKOUT] Starting Flow: ${mpEnv.toUpperCase()} mode`);

    let preferenceData: any;

    if (mode === 'donation' || type === 'donation') {
      // --- DONATION FLOW ---
      const donationAmount = Math.round(Number(amount));
      const currencyId = currency || 'ARS';

      if (!Number.isInteger(donationAmount) || donationAmount <= 0) {
        throw new Error('Invalid donation amount. Must be a positive integer.');
      }

      preferenceData = {
        items: [
          {
            id: 'donation',
            title: 'Argon Fit - Donación voluntaria',
            description: 'Apoyo voluntario al desarrollo de Argon Fit',
            quantity: 1,
            unit_price: donationAmount,
            currency_id: currencyId,
          },
        ],
        payer: {
          name: 'Donante',
          email: 'donaciones@argonfit.pro', // Mandatory for prod compliance
        },
        back_urls: {
          success: 'https://argonfit.pro/?payment=success&type=donation',
          failure: 'https://argonfit.pro/?payment=cancelled&type=donation',
          pending: 'https://argonfit.pro/?payment=pending&type=donation',
        },
        auto_return: 'approved',
        external_reference: userId, // Can be existing user or null
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`,
        metadata: { type: 'donation', mode: 'donation' }
      };

    } else {
      // --- SUBSCRIPTION FLOW ---
      if (!planId) throw new Error("Plan ID is required for subscriptions");

      const plans: Record<string, { title: string, price: number }> = {
        "pro": { title: "Argon Fit - Pro Plan", price: 9900 },
        "elite": { title: "Argon Fit - Elite Plan", price: 18900 },
        "trial": { title: "Argon Fit - Trial Access", price: 100 }
      };

      const selectedPlan = plans[planId];
      if (!selectedPlan) throw new Error(`Invalid plan ID: ${planId}`);

      preferenceData = {
        items: [{
          id: planId,
          title: selectedPlan.title,
          quantity: 1,
          unit_price: selectedPlan.price,
          currency_id: "ARS",
        }],
        payer: {
          email: 'donaciones@argonfit.pro', // Fallback email to harden preference
        },
        back_urls: backUrls,
        auto_return: "approved",
        external_reference: userId,
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`,
        metadata: { type: "subscription", planId, user_id: userId },
      };
    }

    // AUDIT LOG
    console.log('[MP PREFERENCE PAYLOAD]', JSON.stringify(preferenceData, null, 2));

    const result = await preference.create({ body: preferenceData });

    // AUDIT TRACE (Critical for Grey Button Debugging)
    console.log(`[MP TRACE] Collector ID: ${result.collector_id}`);
    console.log(`[MP TRACE] Init Point (PROD): ${result.init_point}`);
    console.log(`[MP TRACE] Sandbox Init Point: ${result.sandbox_init_point}`);

    // Select URL based on environment
    const checkoutUrl = mpEnv === "sandbox" ? result.sandbox_init_point : result.init_point;

    return new Response(
      JSON.stringify({ url: checkoutUrl, id: result.id, env: mpEnv }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("[CHECKOUT ERROR]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Return 200 with error property for client handling
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
