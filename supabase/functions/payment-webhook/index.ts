
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle Webhook Health Check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Mercado Pago sends topic/id in query params or body depending on version. We handle both query params.
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    const id = url.searchParams.get('id') || url.searchParams.get('data.id');

    // Return 200 OK immediately for non-payment topics to avoid retries
    if (topic !== 'payment' && topic !== 'merchant_order') {
      return new Response('Ignored', { status: 200 });
    }

    if (!id) {
      return new Response('Missing ID', { status: 200 });
    }

    // 1. Initialize Supabase Admin (Service Role)
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // @ts-ignore
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');

    // 2. Verify Payment Status with Mercado Pago (Anti-Fraud)
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${mpAccessToken}` }
    });

    if (!mpRes.ok) {
      // If we can't fetch it, it might be too early or invalid. Return 200 to stop retries if it's 404.
      // throw new Error(`Failed to fetch payment ${id}`);
      return new Response(`Failed to fetch payment ${id}`, { status: 200 });
    }

    const payment = await mpRes.json();

    // 3. Process Only Approved Payments
    if (payment.status === 'approved') {
      const metadata = payment.metadata || {};
      const type = metadata.type || 'subscription';
      // Fallback logic for planId
      const planId = metadata.plan_id || metadata.planId || (type === 'donation' ? 'donation' : 'pro');
      const userId = payment.external_reference || metadata.user_id || metadata.userId;

      console.log(`[WEBHOOK] Processing ${type} for ID: ${id}`);

      // ==========================================
      // SEGMENT A: DONATION (LOG-ONLY, TERMINAL)
      // ==========================================
      if (type === 'donation' || metadata.mode === 'donation') {
        console.log(`[DONATION] Received: ${payment.transaction_amount} ${payment.currency_id}`);

        // Log to subscriptions table for audit (as "log-only" event)
        // We use 'completed' status and same start/end date for one-off
        const { error: logError } = await supabaseAdmin.from('subscriptions').insert({
          user_id: userId || 'anonymous_donation', // Donations might be anonymous
          provider: 'mercadopago',
          external_id: String(payment.id),
          plan_id: 'donation',
          status: 'completed',
          amount: payment.transaction_amount,
          currency: payment.currency_id,
          period_start: new Date().toISOString(),
          period_end: new Date().toISOString() // Terminal event
        });

        if (logError) console.error("Donation Log Error", logError);

        return new Response(JSON.stringify({ received: true, type: 'donation' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // ==========================================
      // SEGMENT B: SUBSCRIPTION (SIDE EFFECTS)
      // ==========================================
      if (!userId) {
        // If it's a subscription, we MUST have a user ID.
        console.error("User ID is required for subscriptions");
        // We return 200 to stop MP from retrying forever on a broken payload
        return new Response("Missing User ID for subscription", { status: 200 });
      }

      console.log(`[SUBSCRIPTION] User ${userId} - Plan ${planId}`);

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // 30 Days Subscription

      // 1. Insert/Update Subscription Record
      const { error: subError } = await supabaseAdmin.from('subscriptions').insert({
        user_id: userId,
        provider: 'mercadopago',
        external_id: String(payment.id),
        plan_id: planId,
        status: 'active',
        amount: payment.transaction_amount,
        currency: payment.currency_id,
        period_start: startDate.toISOString(),
        period_end: endDate.toISOString()
      });

      if (subError) console.error("Sub Insert Error", subError);

      // 2. Update Profile with Premium Status
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('data')
        .eq('id', userId)
        .single();

      if (profile) {
        const updatedData = {
          ...profile.data,
          profile: {
            ...profile.data?.profile,
            subscription: {
              plan: planId,
              status: 'active',
              startDate: startDate.toISOString(),
              validUntil: endDate.toISOString(),
              autoRenew: true
            }
          }
        };

        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            data: updatedData,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          console.error("Failed to update profile", updateError);
          throw updateError;
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("[WEBHOOK ERROR]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
