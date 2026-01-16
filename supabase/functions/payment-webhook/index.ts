
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
        throw new Error(`Failed to fetch payment ${id}`);
    }
    
    const payment = await mpRes.json();

    // 3. Process Only Approved Payments
    if (payment.status === 'approved') {
        const userId = payment.external_reference;
        // Fallback to metadata if external_reference is missing
        const targetUserId = userId || payment.metadata?.user_id;
        const planId = payment.metadata?.plan_id || 'pro'; 
        const isDonation = payment.metadata?.type === 'donation';

        if (targetUserId) {
            if (isDonation) {
                console.log(`Processing donation for User ${targetUserId} - Amount ${payment.transaction_amount} ${payment.currency_id}`);

                // Insert Donation
                await supabaseAdmin.from('donations').insert({
                    user_id: targetUserId,
                    provider: 'mercadopago',
                    external_id: String(payment.id),
                    amount: payment.transaction_amount,
                    currency: payment.currency_id,
                    status: payment.status
                });
            } else {
                console.log(`Processing subscription for User ${targetUserId} - Plan ${planId}`);

                const startDate = new Date();
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + 30); // 30 Days Subscription

                // A. Insert Audit Log
                await supabaseAdmin.from('subscriptions').insert({
                    user_id: targetUserId,
                    provider: 'mercadopago',
                    external_id: String(payment.id),
                    plan_id: planId,
                    status: 'active',
                    amount: payment.transaction_amount,
                    currency: payment.currency_id,
                    period_start: startDate.toISOString(),
                    period_end: endDate.toISOString()
                });

                // B. Update User Profile (JSONB Data)
                // This is critical for the Frontend to react immediately upon hydration
                const { data: currentProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('data')
                    .eq('id', targetUserId)
                    .single();

                if (currentProfile && currentProfile.data) {
                    const updatedData = {
                        ...currentProfile.data,
                        profile: {
                            ...currentProfile.data.profile,
                            subscription: {
                                plan: planId,
                                status: 'active',
                                startDate: startDate.toISOString(),
                                validUntil: endDate.toISOString(),
                                autoRenew: true
                            }
                        }
                    };

                    await supabaseAdmin
                        .from('profiles')
                        .update({ 
                            data: updatedData,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', targetUserId);
                }
            }
        }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 // Always return 200 to MP to confirm receipt
    });

  } catch (error) {
    console.error("Webhook Error:", error);
    // Return 500 so MP retries later if it was a server error
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
