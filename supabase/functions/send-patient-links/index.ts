import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PatientData {
  id: string;
  name: string;
  phone: string;
  procedure: string;
  procedure_date: string;
  dni: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientIds }: { patientIds: string[] } = await req.json();

    console.log('Processing SMS for patients:', patientIds);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get patients data
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, name, phone, procedure, procedure_date, dni')
      .in('id', patientIds);

    if (patientsError || !patients) {
      console.error('Error fetching patients:', patientsError);
      return new Response(
        JSON.stringify({ error: 'Pacientes no encontrados' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({ error: 'Configuración de Twilio incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    
    // Send SMS to each patient
    for (const patient of patients as PatientData[]) {
      try {
        // Skip if no phone number
        if (!patient.phone) {
          console.log(`Skipping patient ${patient.name} - no phone number`);
          results.push({ 
            patientId: patient.id, 
            success: false, 
            error: 'Sin teléfono' 
          });
          continue;
        }

        // Format procedure date
        const procedureDate = patient.procedure_date 
          ? new Date(patient.procedure_date).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })
          : 'Por confirmar';

        // Create consultation link - pointing to DNI verification page
        const consultationLink = `${Deno.env.get('SUPABASE_URL')?.replace('https://fxolgklxzibbakbrokcn.supabase.co', 'https://fxolgklxzibbakbrokcn.lovable.app') || 'https://fxolgklxzibbakbrokcn.lovable.app'}/dni-verification`;

        // Create SMS message (within 160 character limit)
        const message = `Hola ${patient.name.split(' ')[0]}! Tu ${patient.procedure || 'procedimiento'} es el ${procedureDate}. Accede con tu DNI: ${consultationLink}`;

        console.log(`SMS message for ${patient.name}: ${message} (${message.length} chars)`);

        // Send SMS via Twilio
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const auth = btoa(`${accountSid}:${authToken}`);

        // Clean phone number
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

        if (twilioResponse.ok) {
          console.log(`SMS sent successfully to ${patient.name}: ${twilioData.sid}`);
          results.push({ 
            patientId: patient.id, 
            success: true, 
            messageSid: twilioData.sid,
            phone: cleanPhoneNumber
          });
        } else {
          console.error(`Twilio error for ${patient.name}:`, twilioData);
          results.push({ 
            patientId: patient.id, 
            success: false, 
            error: twilioData.message || 'Error de Twilio'
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Error sending SMS to ${patient.name}:`, error);
        results.push({ 
          patientId: patient.id, 
          success: false, 
          error: error.message 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    console.log(`SMS batch complete: ${successCount}/${totalCount} sent successfully`);

    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        summary: {
          total: totalCount,
          sent: successCount,
          failed: totalCount - successCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-patient-links function:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});