
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { MercadoPagoConfig, Preference } from 'npm:mercadopago'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { planId, type, amount, currency, userId } = await req.json()

    if (!planId && !type) {
      throw new Error('Plan ID or type is required')
    }

    const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!accessToken) {
      console.error("MP_ACCESS_TOKEN is missing")
      throw new Error('Server configuration error: Missing MP credentials')
    }

    // Configure SDK
    const client = new MercadoPagoConfig({ accessToken: accessToken });
    const preference = new Preference(client);

    let title = "Argon Fit Subscription"
    let unit_price = 100
    let currency_id = 'ARS'

    if (type === 'donation') {
      if (!amount || !currency) {
        throw new Error('Amount and currency are required for donations')
      }
      if (amount <= 0) {
        throw new Error('Amount must be greater than 0')
      }
      title = "Donación a Argon Fit"
      unit_price = Number(amount)
      currency_id = currency
    } else {
      // Existing plan logic
      switch (planId) {
        case 'pro':
          title = "Argon Fit - Pro Athlete Plan (Monthly)";
          unit_price = 9900;
          break;
        case 'elite':
          title = "Argon Fit - Elite Protocol Plan (Monthly)";
          unit_price = 18900;
          break;
        default:
          throw new Error(`Invalid plan: ${planId}`)
      }
    }

    // STRICT URL HARDCODING (Fixes "back_url.success must be defined")
    const backUrls = {
      success: "https://argonfit.pro/?payment=success",
      failure: "https://argonfit.pro/subscription?payment=cancelled",
      pending: "https://argonfit.pro/subscription?payment=pending"
    };

    console.log("Creating Preference with URLs:", backUrls);

    // Create Preference using SDK
    const result = await preference.create({
      body: {
        items: [
          {
            id: type === 'donation' ? 'donation' : planId,
            title: title,
            quantity: 1,
            unit_price: unit_price,
            currency_id: currency_id,
          }
        ],
        back_urls: backUrls,
        auto_return: 'approved',
        external_reference: userId,
        metadata: type === 'donation' ? { type: 'donation' } : { plan_id: planId }
      }
    })

    if (!result.init_point) {
      throw new Error('Failed to create preference')
    }

    return new Response(
      JSON.stringify({ url: result.init_point, id: result.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  }
})
