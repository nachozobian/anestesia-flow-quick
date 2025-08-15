-- Fix patient_responses RLS policies to restrict access properly
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Patients can create their own responses" ON public.patient_responses;
DROP POLICY IF EXISTS "Patients can update their own responses" ON public.patient_responses;
DROP POLICY IF EXISTS "Patients can view their own responses" ON public.patient_responses;

-- Create secure policies for staff access
CREATE POLICY "Authenticated staff can view all patient responses" 
ON public.patient_responses 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() 
  AND role = ANY(ARRAY['Owner'::app_role, 'Nurse'::app_role])
));

CREATE POLICY "Authenticated staff can create patient responses" 
ON public.patient_responses 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() 
  AND role = ANY(ARRAY['Owner'::app_role, 'Nurse'::app_role])
));

CREATE POLICY "Authenticated staff can update patient responses" 
ON public.patient_responses 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() 
  AND role = ANY(ARRAY['Owner'::app_role, 'Nurse'::app_role])
));

-- Create function for patients to access their own responses via token
CREATE OR REPLACE FUNCTION public.get_patient_responses_by_token(patient_token text)
RETURNS TABLE(
  id uuid,
  patient_id uuid,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  has_allergies boolean,
  allergies text,
  current_medications text,
  medical_history text,
  previous_surgeries text,
  family_history text,
  smoking boolean,
  alcohol boolean,
  exercise text,
  diet text,
  sleep_hours integer,
  stress_level integer,
  additional_concerns text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT 
    pr.id,
    pr.patient_id,
    pr.emergency_contact_name,
    pr.emergency_contact_phone,
    pr.emergency_contact_relationship,
    pr.has_allergies,
    pr.allergies,
    pr.current_medications,
    pr.medical_history,
    pr.previous_surgeries,
    pr.family_history,
    pr.smoking,
    pr.alcohol,
    pr.exercise,
    pr.diet,
    pr.sleep_hours,
    pr.stress_level,
    pr.additional_concerns,
    pr.created_at,
    pr.updated_at
  FROM public.patient_responses pr
  JOIN public.patients p ON pr.patient_id = p.id
  WHERE p.token = patient_token;
$function$;