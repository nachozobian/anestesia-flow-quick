import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationSmsData {
  patientId: string;
  validatorName?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientId, validatorName }: ValidationSmsData = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get patient data
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('name, phone, procedure, procedure_date')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      console.error('Error fetching patient:', patientError);
      return new Response(
        JSON.stringify({ error: 'Paciente no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if patient has phone number
    if (!patient.phone) {
      console.error('Patient has no phone number');
      return new Response(
        JSON.stringify({ error: 'El paciente no tiene número de teléfono registrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get AWS Lambda URL
    const lambdaSmsUrl = Deno.env.get('AWS_LAMBDA_SMS_URL');

    if (!lambdaSmsUrl) {
      console.error('Missing AWS Lambda SMS URL');
      return new Response(
        JSON.stringify({ error: 'Configuración de Lambda incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format procedure date if available
    let procedureDateText = '';
    if (patient.procedure_date) {
      const formattedDate = new Date(patient.procedure_date).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      procedureDateText = `\nCirugía programada: ${formattedDate}`;
    }

    // Create SMS message for validation
    const message = `¡Hola ${patient.name}!

Su evaluación pre-anestésica para ${patient.procedure || 'su procedimiento'} ha sido VALIDADA por nuestro equipo médico.${procedureDateText}

Todo está en orden para su cirugía. Si tiene alguna consulta, no dude en contactarnos.

Equipo Médico`;

    // Remove spaces from phone number
    const cleanPhoneNumber = patient.phone.replace(/\s+/g, '');

    console.log('Sending validation SMS to:', cleanPhoneNumber);
    console.log('Message length:', message.length);

    // Send SMS via AWS Lambda
    const lambdaResponse = await fetch(lambdaSmsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: cleanPhoneNumber,
        message: message,
        patientName: patient.name
      }),
    });

    const lambdaData = await lambdaResponse.json();

    console.log('Lambda response status:', lambdaResponse.status);
    console.log('Lambda response data:', JSON.stringify(lambdaData, null, 2));

    if (!lambdaResponse.ok || !lambdaData.success) {
      console.error('Lambda error:', lambdaData);
      return new Response(
        JSON.stringify({ error: 'Error enviando SMS de validación', details: lambdaData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validation SMS sent successfully - MessageId:', lambdaData.messageId || 'sent');

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: lambdaData.messageId || 'lambda-sent',
        patientName: patient.name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-validation-sms function:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});