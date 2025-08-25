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

    // Twilio config
    const twilioSMSURL = Deno.env.get('TWILIO_SMS_URL'); // e.g. https://api.twilio.com/2010-04-01/Accounts/AC.../Messages.json
    const twilioAuthToken = Deno.env.get('TWILIO_PASSWORD_SMS'); // Auth Token
    const accountSid = "AC90b1898da1a5d34101f0807f2d5a7b8f"; // tu Account SID

    if (!twilioSMSURL || !twilioAuthToken) {
      console.error('Missing Twilio configuration (TWILIO_SMS_URL or TWILIO_PASSWORD_SMS)');
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
    console.log('Message content:', message);

    // Send SMS via Twilio
    const twilioResp = await fetch(twilioSMSURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': 'Basic ' + btoa(`${accountSid}:${twilioAuthToken}`)
      },
      body: new URLSearchParams({
        To: cleanPhoneNumber,
        MessagingServiceSid: "MG76ddbd9d37110bb6d3227ac63025b91e",
        Body: message
      }).toString()
    });

    // Read raw text first for robust logging
    const raw = await twilioResp.text();
    let twilioData = null;
    try {
      twilioData = JSON.parse(raw);
    } catch {
      console.error('Twilio non-JSON response:', {
        status: twilioResp.status,
        statusText: twilioResp.statusText,
        headers: Object.fromEntries(twilioResp.headers),
        body: raw.slice(0, 500)
      });
      return new Response(
        JSON.stringify({ error: `Respuesta no-JSON de Twilio (status ${twilioResp.status})` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Twilio response status:', twilioResp.status, twilioData);

    if (!twilioResp.ok) {
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