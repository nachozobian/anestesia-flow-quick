-- Eliminar la función existente y recrearla para forzar la actualización
DROP FUNCTION IF EXISTS public.verify_dni_and_security_code(text, text);

-- Crear la función corregida que valida correctamente el código de seguridad
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
  AND p.dni IS NOT NULL
  LIMIT 1;
$function$;