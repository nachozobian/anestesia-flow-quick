import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, patientData, conversationHistory = [] } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get patient medical responses for additional context
    let patientResponses = null;
    if (patientData?.id) {
      const { data } = await supabase
        .from('patient_responses')
        .select('*')
        .eq('patient_id', patientData.id)
        .single();
      
      patientResponses = data;
    }

    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Prepare context for medical consultation
    const systemPrompt = `Eres un asistente médico especializado en evaluaciones preanestésicas. Tu rol es:

1. Realizar preguntas relevantes sobre el historial médico del paciente
2. Evaluar factores de riesgo anestésico
3. Identificar contraindicaciones o precauciones
4. Generar recomendaciones basadas en las respuestas del paciente

Información del paciente:
- Nombre: ${patientData?.name || 'No disponible'}
- Procedimiento: ${patientData?.procedure || 'No especificado'}
- Fecha del procedimiento: ${patientData?.procedure_date || 'No especificada'}
- DNI: ${patientData?.dni || 'No disponible'}

${patientResponses ? `
Información médica previa del formulario:
- Alergias: ${patientResponses.has_allergies ? (patientResponses.allergies || 'Sí, pero no especificadas') : 'No'}
- Medicamentos actuales: ${patientResponses.current_medications || 'No especificados'}
- Historia médica: ${patientResponses.medical_history || 'No especificada'}
- Cirugías previas: ${patientResponses.previous_surgeries || 'No especificadas'}
- Historia familiar: ${patientResponses.family_history || 'No especificada'}
- Fumador: ${patientResponses.smoking ? 'Sí' : 'No'}
- Consumo de alcohol: ${patientResponses.alcohol ? 'Sí' : 'No'}
- Ejercicio: ${patientResponses.exercise || 'No especificado'}
- Dieta: ${patientResponses.diet || 'No especificada'}
- Horas de sueño: ${patientResponses.sleep_hours || 'No especificado'}
- Nivel de estrés (1-10): ${patientResponses.stress_level || 'No especificado'}
- Preocupaciones adicionales: ${patientResponses.additional_concerns || 'Ninguna'}
- Contacto de emergencia: ${patientResponses.emergency_contact_name || 'No especificado'}
` : ''}

Mantén un tono profesional pero empático. Basándote en la información del formulario, haz preguntas específicas y relevantes para completar la evaluación preanestésica. Si identificas factores de riesgo, profundiza en esos temas.

IMPORTANTE: Al final de la conversación, si consideras que tienes suficiente información, puedes generar recomendaciones médicas específicas usando la función 'generate_recommendations'.`;

    // Build conversation messages
    const messages = [
      { 
        role: 'system', 
        content: systemPrompt 
      },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { 
        role: 'user', 
        content: message 
      }
    ];

    console.log('Calling OpenAI with patient context:', { 
      patientId: patientData?.id, 
      hasResponses: !!patientResponses 
    });

    // Make the request to OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_recommendations',
              description: 'Genera recomendaciones médicas específicas basadas en la evaluación preanestésica del paciente',
              parameters: {
                type: 'object',
                properties: {
                  recommendations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: 'Título de la recomendación' },
                        description: { type: 'string', description: 'Descripción detallada de la recomendación' },
                        category: { 
                          type: 'string', 
                          enum: ['preoperatorio', 'anestesia', 'medicamentos', 'riesgo', 'seguimiento'],
                          description: 'Categoría de la recomendación' 
                        },
                        priority: { 
                          type: 'string', 
                          enum: ['alta', 'media', 'baja'],
                          description: 'Prioridad de la recomendación' 
                        }
                      },
                      required: ['title', 'description', 'category', 'priority']
                    }
                  }
                },
                required: ['recommendations']
              }
            }
          }
        ],
        tool_choice: 'auto'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('OpenAI response:', result);

    // Check if the AI wants to call the function to generate recommendations
    const choice = result.choices[0];
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      if (toolCall.function.name === 'generate_recommendations') {
        try {
          const recommendationsData = JSON.parse(toolCall.function.arguments);
          
          // Save recommendations to database
          if (patientData?.id && recommendationsData.recommendations) {
            const recommendationsToInsert = recommendationsData.recommendations.map((rec: any) => ({
              patient_id: patientData.id,
              title: rec.title,
              description: rec.description,
              category: rec.category,
              priority: rec.priority
            }));

            const { error: insertError } = await supabase
              .from('patient_recommendations')
              .insert(recommendationsToInsert);

            if (insertError) {
              console.error('Error saving recommendations:', insertError);
            } else {
              console.log('Recommendations saved successfully');
            }
          }

          return new Response(
            JSON.stringify({ 
              response: "He generado las recomendaciones médicas basadas en nuestra evaluación. Puede revisarlas en la siguiente sección. ¿Tiene alguna pregunta adicional sobre el procedimiento o las recomendaciones?",
              success: true,
              recommendations_generated: true
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        } catch (parseError) {
          console.error('Error parsing recommendations:', parseError);
        }
      }
    }

    // Extract the regular response content
    const aiResponse = choice.message.content || 'No se pudo generar una respuesta';

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in openai-chat function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});