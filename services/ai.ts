
import { AppState, Routine, UserProfile, NutritionPlan, Meal } from "../types";
import { storage } from "./storage";
import { supabase } from "./supabase";
import { paymentService } from "./payment";

// Helper para parsear la respuesta del backend
const parseAIResponse = (text: string) => {
    try {
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanJson);
    } catch (e) {
        console.error("AI Parsing Error:", e);
        return null;
    }
};

// Generador Local de Respaldo: Lógica de Nutricionista Clínico y Fisiólogo
const getFallbackNutritionPlan = (profile: UserProfile): NutritionPlan => {
    // 1. Cálculo de Tasa Metabólica Basal (Mifflin-St Jeor - Gold Standard Clínico)
    // Diferenciación estricta por sexo biológico
    let bmr = 0;
    if (profile.gender === 'Hombre') {
        bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age) + 5;
    } else {
        bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age) - 161;
    }

    // 2. Factor de Actividad (NEAT + EAT)
    const activityMap: Record<number, number> = { 2: 1.2, 3: 1.375, 4: 1.55, 5: 1.725, 6: 1.9, 7: 1.9 };
    const activityFactor = activityMap[profile.frequency] || 1.375;
    let tdee = Math.round(bmr * activityFactor);

    // 3. Ajuste por Objetivo y Sexo (Diferencias hormonales en déficit/superávit)
    // Las mujeres suelen defender más el tejido adiposo; déficits agresivos pueden afectar el ciclo hormonal.
    if (profile.goal === 'Pérdida de Peso') {
        tdee -= (profile.gender === 'Hombre' ? 500 : 350); // Déficit más moderado en mujeres para adherencia
    } else if (profile.goal === 'Hipertrofia' || profile.goal === 'Fuerza') {
        tdee += (profile.gender === 'Hombre' ? 400 : 250); // Superávit controlado en mujeres para minimizar ganancia grasa
    }

    // 4. Distribución de Macros por Somatotipo y Sensibilidad a la Insulina
    let pPct = 0.30, cPct = 0.40, fPct = 0.30; // Mesomorfo (Base)

    if (profile.somatotype === 'Ectomorfo') {
        // Alta tolerancia a carbohidratos, metabolismo rápido
        pPct = 0.25; cPct = 0.55; fPct = 0.20;
    } else if (profile.somatotype === 'Endomorfo') {
        // Menor sensibilidad a insulina, priorizar grasas saludables y proteínas
        pPct = 0.40; cPct = 0.25; fPct = 0.35;
    }

    // Ajuste fino por género en lípidos (Mujeres oxidan más grasas en reposo/ejercicio moderado)
    if (profile.gender === 'Mujer') {
        fPct += 0.05; // +5% Grasas saludables para soporte hormonal
        cPct -= 0.05;
    }

    // Variaciones de comidas REALES con instrucciones de preparación detalladas
    // MATRIZ DE 7 DÍAS SIN REPETICIÓN
    const mealOptions = {
        breakfast: [
            {
                name: 'Tortitas Proteicas de Avena y Plátano',
                ingredients: ['1 plátano maduro', 'Claras de huevo', 'Avena', 'Canela'],
                description: 'Desayuno anabólico de rápida digestión.',
                instructions: [
                    'Tritura el plátano con un tenedor hasta obtener un puré.',
                    'Mezcla en un bol el puré, las claras, la avena y la canela hasta que quede homogéneo.',
                    'Calienta una sartén antiadherente con una gota de aceite y cocina las tortitas 2 min por lado.'
                ]
            },
            {
                name: 'Huevos Revueltos con Tostada Integral',
                ingredients: ['Huevos enteros', 'Pan integral', 'Espinacas', 'Tomate'],
                description: 'Perfil completo de aminoácidos y grasas.',
                instructions: [
                    'Bate los huevos con una pizca de sal.',
                    'Saltea las espinacas en una sartén con un poco de aceite hasta que reduzcan.',
                    'Añade los huevos y remueve suavemente hasta que cuajen al gusto. Sirve sobre la tostada.'
                ]
            },
            {
                name: 'Porridge de Avena y Manzana',
                ingredients: ['Avena', 'Leche/Bebida vegetal', 'Manzana', 'Canela', 'Whey Protein'],
                description: 'Energía sostenida y fibra.',
                instructions: [
                    'Calienta la leche/bebida vegetal en un cazo y añade la avena.',
                    'Cocina a fuego medio removiendo durante 5-10 min hasta que espese.',
                    'Apaga el fuego, añade la manzana troceada y la proteína, mezclando bien.'
                ]
            },
            {
                name: 'Tostadas de Aguacate y Huevo Poché',
                ingredients: ['Pan de masa madre', 'Aguacate', 'Huevo', 'Semillas de sésamo'],
                description: 'Grasas saludables Omega-3.',
                instructions: [
                    'Tuesta el pan. Tritura el aguacate con sal y limón, y úntalo sobre la tostada.',
                    'Calienta agua en un cazo sin que llegue a hervir fuerte, haz un remolino y echa el huevo.',
                    'Cocina 3 minutos, retira con espumadera y coloca sobre la tostada.'
                ]
            },
            {
                name: 'Smoothie Bowl de Frutos Rojos',
                ingredients: ['Yogur griego', 'Frutos rojos congelados', 'Granola sin azúcar', 'Semillas de chía'],
                description: 'Antioxidantes y probióticos.',
                instructions: [
                    'Tritura el yogur con los frutos rojos (mejor si son congelados) hasta conseguir textura cremosa.',
                    'Vierte la mezcla en un bol.',
                    'Añade la granola y las semillas de chía por encima como topping.'
                ]
            },
            {
                name: 'Tortilla de Claras y Pavo',
                ingredients: ['Claras de huevo', 'Pechuga de pavo', 'Queso bajo en grasa', 'Orégano'],
                description: 'Proteína pura para construcción muscular.',
                instructions: [
                    'Bate las claras en un bol y añade el pavo picado y el orégano.',
                    'Calienta una sartén con una gota de aceite.',
                    'Vierte la mezcla y cocina a fuego medio hasta que la base esté firme, luego pliega o da la vuelta.'
                ]
            },
            {
                name: 'Galletas de Avena Caseras',
                ingredients: ['Avena', 'Plátano', 'Crema de cacahuete', 'Pepitas de chocolate negro'],
                description: 'Opción rápida para llevar.',
                instructions: [
                    'Precalienta el horno a 180°C.',
                    'Chafa el plátano y mézclalo con la avena, la crema de cacahuete y las pepitas.',
                    'Forma pequeñas bolas, aplástalas sobre papel de horno y hornea 12-15 minutos.'
                ]
            }
        ],
        lunch: [
            {
                name: 'Pollo al Limón con Quinoa',
                ingredients: ['Pechuga de pollo', 'Quinoa', 'Limón', 'Brócoli'],
                description: 'Almuerzo limpio y alcalino.',
                instructions: [
                    'Lava la quinoa y cuécela en agua hirviendo (1 parte quinoa por 2 de agua) durante 15 min.',
                    'Cocina la pechuga a la plancha con zumo de limón, sal y pimienta.',
                    'Cuece el brócoli al vapor o hiérvelo 4 min. Sirve todo junto.'
                ]
            },
            {
                name: 'Ternera Magra con Arroz Basmati',
                ingredients: ['Ternera magra', 'Arroz Basmati', 'Pimientos', 'Cebolla'],
                description: 'Fuente de creatina natural y zinc.',
                instructions: [
                    'Lava el arroz basmati para quitar almidón y cuécelo 12 min.',
                    'Corta la ternera y las verduras en tiras. Saltea a fuego fuerte en un wok o sartén.',
                    'Añade salsa de soja (opcional) y sirve junto al arroz.'
                ]
            },
            {
                name: 'Salmón al Horno con Batata',
                ingredients: ['Lomo de salmón', 'Batata/Boniato', 'Espárragos', 'Eneldo'],
                description: 'Ácidos grasos esenciales.',
                instructions: [
                    'Precalienta horno a 200°C. Corta la batata en rodajas finas o dados.',
                    'Hornea la batata con un poco de aceite y sal durante 20 min.',
                    'Añade el salmón y espárragos a la bandeja y hornea 10-12 min más.'
                ]
            },
            {
                name: 'Lentejas Estofadas con Verduras',
                ingredients: ['Lentejas cocidas', 'Zanahoria', 'Patata', 'Pimentón'],
                description: 'Hierro y fibra vegetal.',
                instructions: [
                    'Pica zanahoria, cebolla y patata. Sofríe en una olla con poco aceite.',
                    'Añade las lentejas cocidas (lavadas), pimentón y cubre con agua o caldo.',
                    'Cocina a fuego medio 15-20 min hasta que la patata esté tierna y el caldo espese.'
                ]
            },
            {
                name: 'Pasta Integral Boloñesa Fitness',
                ingredients: ['Pasta integral', 'Carne picada magra (3% grasa)', 'Tomate triturado natural', 'Orégano'],
                description: 'Carga de carbohidratos complejos.',
                instructions: [
                    'Cuece la pasta en agua con sal el tiempo que indique el paquete.',
                    'Dora la carne picada magra con cebolla picada.',
                    'Añade el tomate triturado y orégano, cocina 10 min a fuego lento y mezcla con la pasta.'
                ]
            },
            {
                name: 'Ensalada de Garbanzos y Atún',
                ingredients: ['Garbanzos', 'Lata de atún', 'Huevo duro', 'Pimiento rojo', 'Vinagreta'],
                description: 'Plato frío completo.',
                instructions: [
                    'Lava bien los garbanzos de bote bajo el grifo.',
                    'Mezcla en un bol con el atún escurrido, el huevo duro picado y el pimiento troceado.',
                    'Aliña con aceite de oliva, vinagre y una pizca de sal.'
                ]
            },
            {
                name: 'Fajitas de Pollo y Pimientos',
                ingredients: ['Tortillas integrales', 'Pechuga de pollo', 'Pimiento rojo/verde', 'Cebolla', 'Especias cajún'],
                description: 'Comida divertida y equilibrada.',
                instructions: [
                    'Corta el pollo y las verduras (pimientos y cebolla) en juliana (tiras).',
                    'Saltea las verduras a fuego fuerte 5 min, añade el pollo y las especias, cocina hasta dorar.',
                    'Calienta las tortillas y rellena con la mezcla.'
                ]
            }
        ],
        snack: [
            {
                name: 'Yogur Griego con Nueces',
                ingredients: ['Yogur Griego', 'Nueces', 'Miel'],
                description: 'Probióticos y grasas saludables.',
                instructions: ['Pon el yogur en un bol.', 'Añade las nueces troceadas y un hilo de miel por encima.']
            },
            {
                name: 'Batido de Recuperación',
                ingredients: ['Whey Protein', 'Agua/Leche', 'Plátano'],
                description: 'Rápida absorción post-entreno.',
                instructions: ['Añade el agua/leche, la proteína y el plátano en la batidora.', 'Bate a máxima potencia 30 segundos hasta que quede suave.']
            },
            {
                name: 'Tostada de Arroz y Crema de Cacahuete',
                ingredients: ['Tortitas de arroz', 'Crema de cacahuete 100%', 'Plátano en rodajas'],
                description: 'Energía rápida.',
                instructions: ['Unta la crema de cacahuete sobre las tortitas de arroz.', 'Corta el plátano en rodajas finas y colócalo encima.']
            },
            {
                name: 'Requesón con Piña',
                ingredients: ['Requesón/Queso batido', 'Piña natural', 'Canela'],
                description: 'Caseína de digestión lenta.',
                instructions: ['Sirve el requesón o queso batido en un tazón.', 'Corta la piña en dados pequeños y mézclala. Espolvorea canela al gusto.']
            },
            {
                name: 'Sándwich de Pavo y Queso',
                ingredients: ['Pan integral', 'Pechuga de pavo', 'Queso fresco', 'Lechuga'],
                description: 'Clásico equilibrado.',
                instructions: ['Coloca el pavo, el queso y la lechuga entre las rebanadas de pan.', 'Opcional: Tuesta el sándwich en una plancha para fundir el queso.']
            },
            {
                name: 'Frutos Secos y Chocolate Negro',
                ingredients: ['Almendras crudas', 'Chocolate 85%'],
                description: 'Minerales y antioxidantes.',
                instructions: ['Toma la ración de almendras y chocolate.', 'Alterna bocados para mezclar sabores.']
            },
            {
                name: 'Huevo Duro y Hummus',
                ingredients: ['Huevo cocido', 'Hummus de garbanzos', 'Bastones de zanahoria'],
                description: 'Snack salado saciante.',
                instructions: ['Cuece el huevo 10 min, enfría y pela.', 'Corta la zanahoria en bastones para dipear en el hummus y acompaña con el huevo.']
            }
        ],
        dinner: [
            {
                name: 'Merluza al Horno con Verduras',
                ingredients: ['Merluza', 'Cebolla', 'Calabacín', 'Patata'],
                description: 'Proteína blanca de fácil digestión.',
                instructions: [
                    'Corta calabacín, cebolla y patata en rodajas finas. Ponlas en una bandeja de horno con aceite y sal.',
                    'Hornea 20 min a 180°C.',
                    'Pon los lomos de merluza encima y hornea 10-12 min más.'
                ]
            },
            {
                name: 'Ensalada de Atún y Aguacate',
                ingredients: ['Atún al natural', 'Aguacate', 'Brotes verdes', 'Tomate Cherry'],
                description: 'Cena baja en carbohidratos.',
                instructions: [
                    'Lava los brotes verdes y ponlos en un bol.',
                    'Añade el atún escurrido, el aguacate en dados y los tomates cherry.',
                    'Aliña con zumo de limón, un poco de aceite y sal.'
                ]
            },
            {
                name: 'Revuelto de Setas y Gambas',
                ingredients: ['Huevos', 'Setas variadas', 'Gambas peladas', 'Ajo'],
                description: 'Alto valor biológico, bajas calorías.',
                instructions: [
                    'Lamina los ajos y dóralos en una sartén.',
                    'Añade las setas y gambas, saltea hasta que suelten el agua.',
                    'Incorpora los huevos batidos y remueve hasta que cuajen pero sigan jugosos.'
                ]
            },
            {
                name: 'Pechuga de Pavo y Ensalada Verde',
                ingredients: ['Filete de pavo', 'Rúcula', 'Canónigos', 'Pepino'],
                description: 'Cena ligera para dormir mejor.',
                instructions: [
                    'Salpimienta los filetes de pavo y cocínalos a la plancha hasta que doren.',
                    'Mezcla la rúcula, canónigos y pepino en un bol.',
                    'Sirve el pavo junto a la ensalada aliñada.'
                ]
            },
            {
                name: 'Crema de Calabacín y Huevo Poché',
                ingredients: ['Calabacín', 'Puerro', 'Quesito light', 'Huevo'],
                description: 'Volumen gástrico y saciedad.',
                instructions: [
                    'Rehoga puerro y calabacín troceados.',
                    'Cubre con agua, cuece 20 min y tritura con el quesito hasta obtener una crema fina.',
                    'Sirve caliente con un huevo poché o cocido encima.'
                ]
            },
            {
                name: 'Wok de Tofu y Verduras',
                ingredients: ['Tofu firme', 'Pimiento', 'Zanahoria', 'Salsa de soja'],
                description: 'Opción vegetal completa.',
                instructions: [
                    'Prensa el tofu para quitar agua y córtalo en dados.',
                    'Saltea el tofu hasta dorar, retira.',
                    'Saltea verduras en tiras al dente, reincorpora el tofu y añade salsa de soja.'
                ]
            },
            {
                name: 'Sepia a la Plancha con Ajo y Perejil',
                ingredients: ['Sepia limpia', 'Ajo', 'Perejil', 'Ensalada de tomate'],
                description: 'Proteína muy limpia.',
                instructions: [
                    'Prepara un majado con ajo, perejil y aceite.',
                    'Calienta la plancha muy fuerte. Cocina la sepia 2 min por lado (no más para que no se endurezca).',
                    'Añade el majado por encima al sacarla y sirve con tomate.'
                ]
            }
        ]
    };

    const createMeal = (type: keyof typeof mealOptions, dailyCals: number, index: number): Meal => {
        const options = mealOptions[type];
        // Asegura rotación de 7 días sin repetición
        const selectionIndex = (index) % options.length;
        const selected = options[selectionIndex];

        // Distribución Calórica Circadiana Inteligente
        let mealCals = 0;
        if (type === 'breakfast') mealCals = Math.round(dailyCals * 0.25);
        else if (type === 'lunch') mealCals = Math.round(dailyCals * 0.35); // Comida más fuerte
        else if (type === 'snack') mealCals = Math.round(dailyCals * 0.15);
        else mealCals = Math.round(dailyCals * 0.25); // Cena ligera

        return {
            name: selected.name,
            calories: mealCals,
            macros: {
                p: Math.round((mealCals * pPct) / 4),
                c: Math.round((mealCals * cPct) / 4),
                f: Math.round((mealCals * fPct) / 9)
            },
            ingredients: selected.ingredients,
            description: selected.description,
            instructions: (selected as any).instructions,
            tips: ['Masticar lento para saciedad', 'Beber agua 20min antes'],
            warnings: []
        };
    };

    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    // Ciclo de Carbohidratos (Carb Cycling) Simplificado para evitar estancamiento
    // Días altos: Entrenamientos duros. Días bajos: Descanso/Cardio.
    const calorieCycle = [1.0, 0.9, 1.1, 1.0, 0.9, 1.15, 0.95];

    const weekly = days.map((day, i) => {
        const dailyTarget = Math.round(tdee * calorieCycle[i]);

        return {
            day,
            dailyMacros: {
                protein: Math.round((dailyTarget * pPct) / 4),
                carbs: Math.round((dailyTarget * cPct) / 4),
                fats: Math.round((dailyTarget * fPct) / 9),
                calories: dailyTarget
            },
            meals: {
                breakfast: createMeal('breakfast', dailyTarget, i),
                lunch: createMeal('lunch', dailyTarget, i),
                snack: createMeal('snack', dailyTarget, i),
                dinner: createMeal('dinner', dailyTarget, i)
            }
        };
    });

    return {
        dietType: `Estrategia ${profile.somatotype} - ${profile.gender}`,
        description: `Plan clínico de 7 días ajustado para ${profile.gender} de ${profile.age} años. Enfoque en ${profile.goal} considerando perfil hormonal y tasa metabólica ${profile.somatotype}. Cada día cuenta con un menú variado para asegurar adherencia y cobertura de micronutrientes.`,
        dailyMacros: weekly[0].dailyMacros,
        hydrationGoal: Math.round(profile.weight * 0.04 * 10) / 10, // 40ml/kg es más preciso para activos
        supplements: ['Omega-3 (Salud hormonal)', 'Multivitamínico', 'Creatina (Rendimiento)', 'Whey Protein'],
        sources: ['Mifflin-St Jeor', 'Nutrición Deportiva Clínica', 'Argon Database v4'],
        lastUpdated: new Date().toISOString(),
        meals: weekly[0].meals,
        weekly
    };
};

export const aiService = {
    getRecommendation: async (state: AppState) => {
        try {
            const { data, error } = await supabase.functions.invoke('argon-ai', {
                body: {
                    action: 'get_recommendation',
                    profile: state.profile,
                    language: state.language
                }
            });
            if (error) throw error;
            return data.text || "Sigue empujando.";
        } catch (e) {
            console.warn("AI Service Error (Recommendation):", e);
            return "La consistencia es clave.";
        }
    },

    generatePersonalizedRoutines: async (profile: UserProfile, language: 'es' | 'en' = 'es'): Promise<Routine[]> => {
        // Check Permissions for Premium Routines
        if (!paymentService.hasAccess(profile, 'premium_routines')) {
            console.warn("User does not have premium routines access. Returning basic fallback.");
            return []; // Caller handles fallback to static
        }

        try {
            const { data, error } = await supabase.functions.invoke('argon-ai', {
                body: {
                    action: 'generate_routines',
                    profile,
                    language
                }
            });

            if (error || !data || !data.routines) throw new Error("AI Generation Failed");

            return data.routines.map((r: any, i: number) => ({
                ...r,
                id: `ai-rt-${Date.now()}-${i}`,
                imageUrl: storage.getRandomImage(r.tags?.[0] || 'General'),
                isAiGenerated: true,
                isPremium: true, // Mark as premium
                exercises: (r.exercises || []).map((ex: any) => {
                    // GUARANTEE: Ensure every generated exercise has valid media (Video/Image)
                    const media = storage.getExerciseMedia(ex.name);
                    return {
                        ...ex,
                        exerciseId: `ai-ex-${Math.random().toString(36).substr(2, 9)}`,
                        // Prefer AI data if valid, otherwise fallback to local DB match
                        videoUrl: (ex.videoUrl && ex.videoUrl.length > 5) ? ex.videoUrl : media.videoUrl,
                        imageUrl: (ex.imageUrl && ex.imageUrl.length > 5) ? ex.imageUrl : media.imageUrl,
                        howTo: ex.howTo || media.howTo
                    };
                })
            }));

        } catch (e) {
            console.warn("AI Routines failed, using static database fallback.", e);
            return [];
        }
    },

    generateNutritionPlan: async (profile: UserProfile, language: 'es' | 'en' = 'es'): Promise<NutritionPlan | null> => {
        // Check permissions
        if (!paymentService.hasAccess(profile, 'nutrition')) {
            return null; // UI should handle lock
        }

        try {
            const { data, error } = await supabase.functions.invoke('argon-ai', {
                body: {
                    action: 'generate_nutrition',
                    profile, // Profile contains all biometrics: Age, Weight, Height, Somatotype, Goal
                    language
                }
            });

            if (error || !data.plan) throw error;

            const plan = data.plan;
            if (plan.weekly && plan.weekly.length > 0) {
                plan.meals = plan.weekly[0].meals;
            }
            plan.lastUpdated = new Date().toISOString();

            return plan as NutritionPlan;
        } catch (e) {
            console.warn("AI Nutrition failed, using local specialized fallback.", e);
            return getFallbackNutritionPlan(profile);
        }
    },

    findExerciseVideo: async (exerciseName: string): Promise<string | null> => {
        try {
            const { data, error } = await supabase.functions.invoke('argon-ai', {
                body: { action: 'find_video', exerciseName }
            });
            if (error) return null;
            return data.url;
        } catch (e) {
            return null;
        }
    },

    chatWithCoach: async (message: string, state: AppState): Promise<{ text: string, routine?: any }> => {
        const isPremium = paymentService.hasAccess(state.profile, 'ai');

        try {
            const { data, error } = await supabase.functions.invoke('argon-ai', {
                body: {
                    action: 'chat',
                    message,
                    profile: state.profile,
                    language: state.language,
                    isPremium // Pass premium status to the AI
                }
            });

            if (error) throw error;
            return {
                text: data.text,
                routine: data.routine
            };
        } catch (e) {
            console.error("Chat Error:", e);
            return { text: state.language === 'es' ? "Error de conexión con el núcleo Argon." : "Connection error with Argon core." };
        }
    }
};
