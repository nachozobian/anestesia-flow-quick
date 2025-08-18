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

    // Get AWS Lambda URL
    const lambdaSmsUrl = Deno.env.get('AWS_LAMBDA_SMS_URL');

    if (!lambdaSmsUrl) {
      console.error('Missing AWS Lambda SMS URL');
      return new Response(
        JSON.stringify({ error: 'Configuración de Lambda incompleta' }),
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

    console.log('Lambda request details:', {
      to: cleanPhoneNumber,
      messageLength: message.length
    });
    
    console.log('Lambda response status:', lambdaResponse.status);
    console.log('Lambda response data:', JSON.stringify(lambdaData, null, 2));

    if (!lambdaResponse.ok || !lambdaData.success) {
      console.error('Lambda error:', lambdaData);
      return new Response(
        JSON.stringify({ error: 'Error enviando SMS', details: lambdaData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('SMS sent successfully - MessageId:', lambdaData.messageId || 'sent');

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
        messageSid: lambdaData.messageId || 'lambda-sent',
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