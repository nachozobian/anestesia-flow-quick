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
    // Force cache refresh - v2
    const { patientId, appointmentDate, procedure }: AppointmentData = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get patient data
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('name, phone, procedure, security_code, token')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      console.error('Error fetching patient:', patientError);
      return new Response(
        JSON.stringify({ error: 'Paciente no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Generate a 6-digit security code if not already present
    let securityCode = patient.security_code;
    if (!securityCode) {
      securityCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Update patient with security code
      const { error: updateError } = await supabase
        .from('patients')
        .update({ security_code: securityCode })
        .eq('id', patientId);
        
      if (updateError) {
        console.error('Error updating patient security code:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to generate security code' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
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

    // Create consultation link
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://fxolgklxzibbakbrokcn.lovable.app';
    const consultationLink = `${frontendUrl}/verify`;

    // Create SMS message with security code and link
    const message = `Cita: ${formattedDate}
Procedimiento: ${patient.procedure || procedure}
Código: ${securityCode}
Evaluación: ${consultationLink}
Llegue 30min antes.`;

    // Remove spaces from phone number
    const cleanPhoneNumber = patient.phone.replace(/\s+/g, '');

    console.log('Sending appointment SMS to:', cleanPhoneNumber);
    console.log('Message length:', message.length);

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
        JSON.stringify({ error: 'Error enviando SMS de cita', details: twilioData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Appointment SMS sent successfully - MessageSid:', twilioData.sid);

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

    console.log('Patient status updated successfully');

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