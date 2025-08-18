-- Actualizar la función para que realmente valide el código de seguridad
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
  AND p.security_code IS NOT NULL
  LIMIT 1;
$function$;