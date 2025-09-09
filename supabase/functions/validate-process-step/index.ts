import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { patient_token, target_step, action } = await req.json();

    console.log(`Process validation request: ${action} for step ${target_step} with token ${patient_token}`);

    if (action === 'validate') {
      // Validate step access
      const { data: validation, error } = await supabaseClient
        .rpc('validate_step_access', { 
          patient_token, 
          target_step 
        });

      if (error) {
        console.error('Error validating step access:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          validation 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );

    } else if (action === 'complete') {
      // Mark step as completed
      const { data: success, error } = await supabaseClient
        .rpc('mark_step_completed', { 
          patient_token, 
          step_name: target_step 
        });

      if (error) {
        console.error('Error marking step completed:', error);
        throw error;
      }

      console.log(`Step ${target_step} completed successfully: ${success}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          completed: success 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );

    } else if (action === 'get_current_step') {
      // Get current step for patient
      const { data: currentStep, error } = await supabaseClient
        .rpc('get_current_step_by_token', { 
          patient_token 
        });

      if (error) {
        console.error('Error getting current step:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          current_step: currentStep 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );

    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid action' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

  } catch (error) {
    console.error('Error in validate-process-step function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});