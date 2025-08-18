-- Add security_code column to patients table
ALTER TABLE public.patients 
ADD COLUMN security_code TEXT;

-- Update the verify_dni_and_get_token function to also check security code
CREATE OR REPLACE FUNCTION public.verify_dni_and_security_code(patient_dni text, security_code text)
RETURNS TABLE(token text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.token
  FROM public.patients p
  WHERE p.dni = patient_dni 
  AND p.security_code = security_code
  LIMIT 1;
$function$;