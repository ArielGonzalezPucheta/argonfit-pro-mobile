import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) throw new Error("Unauthorized");

        // Get latest active subscription from DB (Source of Truth)
        const { data: subscription, error: subError } = await supabaseClient
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (subError && subError.code !== 'PGRST116') {
            throw subError;
        }

        const status = {
            plan: subscription?.plan_id || 'free',
            status: subscription?.status || 'active',
            validUntil: subscription?.period_end || null,
            isPremium: subscription ? ['pro', 'elite', 'trial'].includes(subscription.plan_id) : false
        };

        return new Response(JSON.stringify(status), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200, // Soft error
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
