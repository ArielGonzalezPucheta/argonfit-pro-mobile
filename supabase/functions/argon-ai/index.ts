// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.1";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Core Services Initialization
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    const { action, language, message, exerciseName } = await req.json();

    // 2. Access Logic (Server-Side Source of Truth)
    const userPlan = profile.subscription?.plan || 'free';
    const isActive = profile.subscription?.status === 'active';
    const isPremium = isActive && (['pro', 'elite', 'trial'].includes(userPlan));

    // 3. AI Intelligence Layer
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error("AI Core Offline: API Key missing.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const PERSONA = `
      IDENTITY: ARGON AI - Advanced Fitness Engine.
      TONE: Professional, technical, charismatic. Use science-based fitness terminology.
      USER: ${profile.name}, Goal: ${profile.goal}, Level: ${profile.experience}, Somatotype: ${profile.somatotype || 'Mesomorfo'}.
      LANGUAGE: ${language === 'en' ? 'English' : 'Spanish'}.
    `;

    let finalPrompt = "";
    let isJson = false;

    switch (action) {
      case 'get_recommendation':
        finalPrompt = `${PERSONA}\nProvide a short, punchy (max 120 chars) motivation/tip for this moment.`;
        break;

      case 'chat':
      case 'generate_routines':
      case 'generate_nutrition':
        isJson = true;
        finalPrompt = `${PERSONA}
          MODE: ${isPremium ? 'PREMIUM (UNRESTRICTED)' : 'COMPANION (RESTRICTED)'}
          ACTION: ${action}
          USER MESSAGE: "${message || 'Generate plan based on my profile'}"
          
          RULES FOR ${isPremium ? 'PREMIUM' : 'FREE'} USER:
          1. ${isPremium ? 'Fully generate the requested routine/nutrition JSON object.' : 'Do NOT generate the "routine" object. Return "routine": null.'}
          2. ${isPremium ? 'Explain the plan clearly.' : 'Explain the technical reasoning behind what the user should do in the "text" field, then politely explain that ARGON PRO/ELITE converts this logic into a clickable, full protocol in their library.'}
          3. Tone must remain professional and technical.
          
          OUTPUT JSON STRUCTURE: { "text": "...", "routine": null | object }
        `;
        break;

      case 'find_video':
        return new Response(JSON.stringify({
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(exerciseName + ' exercise technique')}`
        }), { headers: corsHeaders });

      default:
        throw new Error("Invalid action");
    }

    // 4. Execution & Parsing
    const result = await model.generateContent(finalPrompt);
    const responseText = result.response.text();
    let resultData: any;

    if (isJson) {
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      try {
        resultData = JSON.parse(cleanJson);
      } catch (e) {
        resultData = { text: responseText, routine: null };
      }
    } else {
      resultData = { text: responseText };
    }

    // 5. Final Safety Guard (REGLA LEAD: Force null for FREE)
    if (!isPremium && resultData.routine) {
      console.log("[AI] Safety Guard: Removing routine object from FREE user response.");
      resultData.routine = null;
    }

    return new Response(JSON.stringify(resultData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[AI ERROR]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Return 200 with error object for soft failure
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
