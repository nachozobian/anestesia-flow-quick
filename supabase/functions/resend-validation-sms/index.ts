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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientId, validatorName }: ValidationSmsData = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    if (!patient.phone) {
      console.error('Patient has no phone number');
      return new Response(
        JSON.stringify({ error: 'El paciente no tiene número de teléfono registrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const twilioSMSURL = Deno.env.get('TWILIO_SMS_URL');
    const twilioAuthToken = Deno.env.get('TWILIO_PASSWORD_SMS');
    const accountSid = "AC90b1898da1a5d34101f0807f2d5a7b8f";

    if (!twilioSMSURL || !twilioAuthToken) {
      console.error('Missing Twilio configuration (TWILIO_SMS_URL or TWILIO_PASSWORD_SMS)');
      return new Response(
        JSON.stringify({ error: 'Configuración de Twilio incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Mensaje para reenvío de código
    const message = `¡Hola ${patient.name}!

Has solicitado un nuevo código para acceder a tu evaluación pre-anestésica de ${patient.procedure || 'tu procedimiento'}.${procedureDateText}

Si tienes dudas, contáctanos. Este SMS es un reenvío automático por tu solicitud.

Equipo Médico`;

    const cleanPhoneNumber = patient.phone.replace(/\s+/g, '');

    console.log('Resending validation SMS to:', cleanPhoneNumber);
    console.log('Message content:', message);

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
        JSON.stringify({ error: 'Error reenviando SMS de validación', details: twilioData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Resend validation SMS sent successfully - MessageSid:', twilioData.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: twilioData.sid,
        patientName: patient.name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in resend-validation-sms function:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
