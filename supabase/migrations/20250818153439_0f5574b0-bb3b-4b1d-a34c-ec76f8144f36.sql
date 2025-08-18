-- Eliminar la función existente primero
DROP FUNCTION IF EXISTS public.verify_dni_and_security_code(text, text);

-- Crear la función corregida con parámetros renombrados para evitar conflictos
CREATE OR REPLACE FUNCTION public.verify_dni_and_security_code(patient_dni text, input_security_code text)
 RETURNS TABLE(token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Return only if both DNI and security code match exactly
  RETURN QUERY
  SELECT p.token
  FROM public.patients p
  WHERE p.dni = patient_dni 
  AND p.security_code = input_security_code
  AND p.security_code IS NOT NULL
  AND p.dni IS NOT NULL
  LIMIT 1;
END;
$function$;