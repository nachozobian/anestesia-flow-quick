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

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioMessagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');

    if (!twilioAccountSid || !twilioAuthToken || !twilioMessagingServiceSid) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({ error: 'Configuración de Twilio incompleta' }),
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

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: cleanPhoneNumber,
        MessagingServiceSid: twilioMessagingServiceSid,
        Body: message
      }).toString(),
    });

    const twilioData = await twilioResponse.json();

    console.log('Twilio response status:', twilioResponse.status);
    console.log('Twilio response data:', JSON.stringify(twilioData, null, 2));

    if (!twilioResponse.ok || twilioData.error_code) {
      console.error('Twilio error:', twilioData);
      return new Response(
        JSON.stringify({ error: 'Error enviando SMS de validación', details: twilioData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validation SMS sent successfully - MessageSid:', twilioData.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: twilioData.sid,
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