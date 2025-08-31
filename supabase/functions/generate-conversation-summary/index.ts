import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    const { patientToken } = await req.json();

    if (!patientToken) {
      throw new Error('Patient token is required');
    }

    console.log('Generating conversation summary for patient token:', patientToken);

    // Create Supabase client with service key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get patient data
    const { data: patientData, error: patientError } = await supabase
      .rpc('get_patient_by_token', { patient_token: patientToken });

    if (patientError || !patientData?.length) {
      throw new Error('Patient not found');
    }

    const patient = patientData[0];

    // Get conversation history
    const { data: conversations, error: conversationError } = await supabase
      .rpc('get_patient_conversations_by_token', { patient_token: patientToken });

    if (conversationError) {
      throw new Error('Error fetching conversations');
    }

    if (!conversations?.length) {
      throw new Error('No conversations found');
    }

    // Get patient responses for additional context
    const { data: patientResponses, error: responsesError } = await supabase
      .rpc('get_patient_responses_by_token', { patient_token: patientToken });

    // Get recommendations for context
    const { data: recommendations, error: recError } = await supabase
      .rpc('get_patient_recommendations_by_token', { patient_token: patientToken });

    // Prepare conversation text for summary
    const conversationText = conversations.map(conv => 
      `${conv.role === 'user' ? 'Paciente' : 'IA Médica'}: ${conv.content}`
    ).join('\n\n');

    // Create context about patient
    let patientContext = `Paciente: ${patient.name}\nDNI: ${patient.dni}\nProcedimiento: ${patient.procedure || 'No especificado'}`;
    
    if (patient.procedure_date) {
      patientContext += `\nFecha del Procedimiento: ${patient.procedure_date}`;
    }

    // Add patient responses context if available
    if (patientResponses?.length) {
      const responses = patientResponses[0];
      patientContext += '\n\nInformación médica previa:';
      if (responses.has_allergies && responses.allergies) {
        patientContext += `\n- Alergias: ${responses.allergies}`;
      }
      if (responses.current_medications) {
        patientContext += `\n- Medicamentos actuales: ${responses.current_medications}`;
      }
      if (responses.medical_history) {
        patientContext += `\n- Historia médica: ${responses.medical_history}`;
      }
      if (responses.additional_concerns) {
        patientContext += `\n- Preocupaciones adicionales: ${responses.additional_concerns}`;
      }
    }

    // Add recommendations context if available
    if (recommendations?.length) {
      patientContext += '\n\nRecomendaciones generadas:';
      recommendations.forEach((rec, index) => {
        patientContext += `\n${index + 1}. ${rec.title} (${rec.category}) - ${rec.description}`;
      });
    }

    console.log('Sending request to OpenAI for summary generation...');

    // Generate summary using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente médico especializado en evaluaciones preanestésicas. Tu tarea es generar un resumen profesional y completo de la consulta médica virtual realizada entre el paciente y la IA médica.

El resumen debe:
- Ser claro, conciso y profesional
- Incluir los puntos más importantes de la conversación
- Destacar hallazgos relevantes para la anestesia
- Mencionar las recomendaciones principales
- Estar redactado en tercera persona
- Tener formato de informe médico
- No exceder los 500 palabras

Estructura del resumen:
1. Identificación del paciente y procedimiento
2. Evaluación preanestésica realizada
3. Hallazgos principales
4. Recomendaciones clave
5. Conclusión del estado del paciente`
          },
          {
            role: 'user',
            content: `Por favor genera un resumen médico completo basado en la siguiente información:

${patientContext}

CONVERSACIÓN COMPLETA:
${conversationText}

Genera un resumen profesional que capture la esencia de la evaluación preanestésica y la situación completa del paciente.`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content;

    if (!summary) {
      throw new Error('No summary generated');
    }

    console.log('Summary generated successfully, saving to database...');

    // Save summary to database
    const { error: saveError } = await supabase
      .from('conversation_summaries')
      .insert({
        patient_id: patient.id,
        summary: summary,
        generated_by: 'AI'
      });

    if (saveError) {
      console.error('Error saving summary:', saveError);
      throw new Error('Error saving summary to database');
    }

    console.log('Summary saved successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      summary: summary 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-conversation-summary function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});