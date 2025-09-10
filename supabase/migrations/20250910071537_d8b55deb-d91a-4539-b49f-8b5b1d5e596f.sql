-- Create secure function for patients to create their own consent records
CREATE OR REPLACE FUNCTION public.create_consent_by_token(
  patient_token text,
  consent_type_param text,
  content_param text
)
RETURNS TABLE(id uuid, patient_id uuid, consent_type text, content text, accepted boolean, signature_data text, accepted_at timestamp with time zone, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_patient_id uuid;
  new_consent_id uuid;
BEGIN
  -- Get patient ID from token
  SELECT p.id INTO target_patient_id 
  FROM public.patients p
  WHERE p.token = patient_token;
  
  IF target_patient_id IS NULL THEN
    RAISE EXCEPTION 'Invalid patient token';
  END IF;
  
  -- Insert new consent record
  INSERT INTO public.informed_consents (patient_id, consent_type, content, accepted)
  VALUES (target_patient_id, consent_type_param, content_param, false)
  RETURNING id INTO new_consent_id;
  
  -- Return the created consent
  RETURN QUERY
  SELECT 
    ic.id,
    ic.patient_id,
    ic.consent_type,
    ic.content,
    ic.accepted,
    ic.signature_data,
    ic.accepted_at,
    ic.created_at
  FROM public.informed_consents ic
  WHERE ic.id = new_consent_id;
END;
$function$;