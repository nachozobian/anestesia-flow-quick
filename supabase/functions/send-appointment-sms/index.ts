import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppointmentData {
  patientId: string;
  appointmentDate: string;
  procedure: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientId, appointmentDate, procedure }: AppointmentData = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get patient data
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('name, phone, procedure')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      console.error('Error fetching patient:', patientError);
      return new Response(
        JSON.stringify({ error: 'Paciente no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    console.log('Twilio credentials check:', {
      hasAccountSid: !!accountSid,
      hasTwilioPhoneNumber: !!twilioPhoneNumber,
      hasAuthToken: !!authToken,
      accountSidStart: accountSid ? accountSid.substring(0, 5) + '...' : 'missing'
    });

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({ error: 'Configuración de Twilio incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format appointment date
    const formattedDate = new Date(appointmentDate).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Create SMS message
    const message = `Hola ${patient.name}, 

Su cita médica ha sido programada:

📅 Fecha: ${formattedDate}
🏥 Procedimiento: ${patient.procedure || procedure}

Por favor, llegue 30 minutos antes de la hora programada.

Si necesita reprogramar, contacte con nosotros.

Clínica Médica`;

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    // Remove spaces from phone number to match Twilio verification format
    const cleanPhoneNumber = patient.phone.replace(/\s+/g, '');

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: cleanPhoneNumber,
        From: twilioPhoneNumber,
        Body: message,
      }),
    });

    const twilioData = await twilioResponse.json();

    console.log('Twilio request details:', {
      to: cleanPhoneNumber,
      from: twilioPhoneNumber,
      messageLength: message.length
    });
    
    console.log('Twilio response status:', twilioResponse.status);
    console.log('Twilio response data:', JSON.stringify(twilioData, null, 2));

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioData);
      return new Response(
        JSON.stringify({ error: 'Error enviando SMS', details: twilioData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('SMS sent successfully - SID:', twilioData.sid);
    console.log('SMS status:', twilioData.status);

    // Update patient status to reflect appointment has been scheduled
    const { error: updateError } = await supabase
      .from('patients')
      .update({ 
        status: 'Cita Programada',
        procedure_date: appointmentDate
      })
      .eq('id', patientId);

    if (updateError) {
      console.error('Error updating patient status:', updateError);
    }

    console.log('SMS sent successfully:', twilioData.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: twilioData.sid,
        appointmentDate: formattedDate
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-appointment-sms function:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});