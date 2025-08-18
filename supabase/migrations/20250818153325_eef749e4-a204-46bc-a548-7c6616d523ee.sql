-- Eliminar todas las versiones de las funciones de verificación
DROP FUNCTION IF EXISTS public.verify_dni_and_security_code(text, text);
DROP FUNCTION IF EXISTS public.verify_dni_and_get_token(text);

-- Crear una nueva función con lógica simplificada y debug
CREATE OR REPLACE FUNCTION public.verify_dni_and_security_code(patient_dni text, security_code text)
 RETURNS TABLE(token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Debug: Log the parameters (remove this in production)
  RAISE NOTICE 'Verifying DNI: % with security code: %', patient_dni, security_code;
  
  -- Return only if both DNI and security code match exactly
  RETURN QUERY
  SELECT p.token
  FROM public.patients p
  WHERE p.dni = patient_dni 
  AND p.security_code = security_code
  AND p.security_code IS NOT NULL
  AND p.dni IS NOT NULL
  LIMIT 1;
  
  -- Debug: Check if we found any results
  IF NOT FOUND THEN
    RAISE NOTICE 'No matching patient found for DNI: % and security code: %', patient_dni, security_code;
  END IF;
END;
$function$;