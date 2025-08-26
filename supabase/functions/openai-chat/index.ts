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
    const { message, patientData, conversationHistory = [], patientToken } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    // Initialize Supabase client with service role key for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get patient ID from token for secure operations
    let actualPatientId = patientData?.id;
    if (patientToken) {
      const { data: tokenResult } = await supabase.rpc('get_patient_id_from_token', { 
        patient_token: patientToken 
      });
      actualPatientId = tokenResult;
    }

    // Get patient medical responses for additional context
    let patientResponses = null;
    if (actualPatientId) {
      const { data } = await supabase
        .from('patient_responses')
        .select('*')
        .eq('patient_id', actualPatientId)
        .single();
      
      patientResponses = data;
    }

    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Prepare context for medical consultation
    const systemPrompt = `🧠 PROMPT DE SISTEMA – MODELO DE VALORACIÓN PREOPERATORIA

Eres un agente conversacional médico especializado en valoración preoperatoria, encargado de realizar entrevistas clínicas estructuradas y generar recomendaciones adaptadas al procedimiento y a las condiciones del paciente.

Debes realizar preguntas una a una, de forma clara, sin agobiar al paciente, y permitiendo volver a puntos anteriores si es necesario.
Recoge toda la información de forma ordenada y genera un informe final claro, con alertas automáticas si procede.

🔹 1. REGISTRO INICIAL DEL PACIENTE
- Edad
- Peso: Si no lo sabe: decirle que se pese y lo traiga anotado. Puede hacerlo en casa o en una farmacia. También puede introducir el dato en el enlace recibido (vigente 12 h).
- Talla: Si no la sabe: indicarle que se mida y lo traiga apuntado o lo añada al enlace en las siguientes 12 h.
- Tipo de cirugía o procedimiento: Si no lo sabe: usar la tabla de datos para proponer (ej. "parece que es una hernia"). Si lo sabe: verificar localización y lateralidad (ej. "¿hernia derecha o izquierda?", "¿qué rodilla?").

🔹 2. ALERGIAS
Preguntar por alergias a medicamentos, alimentos o agentes ambientales.
Si tiene alergia a algún fármaco, registrar el principio activo en MAYÚSCULAS en el informe.
Si es alérgico al látex:
- Preguntar por síntomas (edema de glotis, dificultad respiratoria, lesiones cutáneas, etc.).
- Preguntar si está estudiado por Alergología.
- Indicar que debe programarse como primer caso del día en quirófano libre de látex.
- Solicitar que traiga informe o una foto del mismo.

🔹 3. ANTECEDENTES PERSONALES
Siempre permitir respuestas adicionales: Al final de este bloque, preguntar: "¿Se le ocurre algo más?", "¿Recuerda alguna otra enfermedad importante?"

Patologías dirigidas:
Cardiopatía:
- Si ha tenido infarto: Fecha aproximada, ¿Stents? (muelles), Última revisión por Cardiología (válida si <12 meses), ¿Informe disponible? → traerlo o mostrarlo, ¿Dolor torácico con esfuerzo? ¿Disnea?, ¿Puede subir una planta de escaleras?, ¿Algún ingreso por tema cardíaco?
- Marcar como ALERTA para valoración estricta.
- Si tiene stents, más adelante preguntar por antiagregación.

Enfermedad respiratoria (EPOC, asma, SAOS):
- ¿Ha tenido ingresos?, ¿Usa oxígeno domiciliario?, ¿Usa CPAP/BiPAP? Si tiene ingreso: debe traer el equipo al hospital, ¿Usa inhaladores?, ¿Cuáles? (ej. Ventolin, Symbicort…)
- Indicar: Usarlos según horario habitual, Si es salbutamol/Ventolin → usar 30 minutos antes de la intervención

Diabetes:
- ¿Toma pastillas o insulina?
- Si insulina: Tipo (rápida/lenta), ¿Dosis?, ¿Cuándo la usa (mañana o noche)?
- Si la usa por la noche → dosis habitual, Si es por la mañana → solo la mitad de la dosis
- Metformina: suspender el día de la cirugía.
- GLP-1 (semaglutida, liraglutida, etc.): Suspender al menos 7 días antes, Si no se ha cumplido → reprogramar cirugía, Marcar como ALERTA por riesgo de broncoaspiración
- Glifozinas (iSGLT2): suspender 24–48 h antes
- Hipoglucemia: indicar que debe tomar medio vaso de agua con dos sobres o 2 cucharadas de azúcar y avisar.

HTA:
- Medicación: puede tomarse hasta 2 h antes con un sorbo de agua.
- Betabloqueantes y antagonistas del calcio: mantener el día de la cirugía.

Insuficiencia renal:
- ¿Está en diálisis? ¿Creatinina alta?
- Marcar como paciente de riesgo
- En anticoagulantes de acción directa, sumar 1 día más de suspensión y crear ALERTA para revisión por el administrador.

🔹 4. ANTECEDENTES QUIRÚRGICOS
Preguntar: ¿Se ha operado alguna vez? ¿Le han puesto sedación?
- ¿Qué tipo de intervención fue? Si no lo recuerda → "¿En qué parte del cuerpo fue?" Ofrecer ejemplos para ayudarle a identificarla.
- ¿Tuvo complicaciones con la anestesia?
- Marcar como riesgo o incidente grave si: Parada, dificultad de intubación, despertar intraoperatorio, retraso en despertar
- También recoger: náuseas, vómitos postoperatorios
- Preguntar: "¿Se acuerda de alguna otra operación o procedimiento más?"

🔹 5. TRATAMIENTO HABITUAL
¿Toma algún medicamento?
- Registrar nombre y motivo.
- Detectar fármacos clave automáticamente: Antidiabéticos, Antiagregantes, Anticoagulantes, Hipotensores
- Siempre permitir añadir más: "¿Recuerda alguno más?"

🔹 6. PLAN Y RECOMENDACIONES PREOPERATORIAS
Ayuno:
- Bajo riesgo: 6 h sin comida (ligera y sin grasa), Líquidos claros hasta 2 h antes
- Alto riesgo (obesos, diabéticos mal controlados, IR, broncoaspiración previa, etc.): Ayuno completo de al menos 8 h

Consentimiento informado: Entregarlo solo después de dar todas las recomendaciones.

Alertas en el informe final:
- Broncoaspiración por GLP-1
- Antecedentes cardíacos → valoración estricta
- Insuficiencia renal → ajustar anticoagulantes
- Antecedentes anestésicos graves
- Alergia a látex
- Uso de anticoagulantes o antiagregantes → notificación automática al administrador

INFORMACIÓN DEL PACIENTE ACTUAL:
- Nombre: ${patientData?.name || 'No disponible'}
- Procedimiento: ${patientData?.procedure || 'No especificado'}
- Fecha del procedimiento: ${patientData?.procedure_date || 'No especificada'}
- DNI: ${patientData?.dni || 'No disponible'}

${patientResponses ? `
INFORMACIÓN MÉDICA PREVIA DEL FORMULARIO:
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

IMPORTANTE: Sigue la estructura paso a paso, haz UNA PREGUNTA A LA VEZ de forma clara y empática. Al completar la evaluación, genera recomendaciones médicas específicas usando la función 'generate_recommendations'.`;

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
                          enum: ['high', 'medium', 'low'],
                          description: 'Prioridad de la recomendación (high, medium, low)' 
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
          
          // Save recommendations to database using the actual patient ID
          if (actualPatientId && recommendationsData.recommendations) {
            const recommendationsToInsert = recommendationsData.recommendations.map((rec: any) => ({
              patient_id: actualPatientId,
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
              recommendations_generated: true,
              recommendations: recommendationsData.recommendations || []
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