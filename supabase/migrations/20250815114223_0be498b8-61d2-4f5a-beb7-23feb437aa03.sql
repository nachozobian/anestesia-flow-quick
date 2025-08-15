-- Create a public function for DNI verification that only returns the token
CREATE OR REPLACE FUNCTION public.verify_dni_and_get_token(patient_dni text)
RETURNS TABLE(token text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT p.token
  FROM public.patients p
  WHERE p.dni = patient_dni
  LIMIT 1;
$function$;