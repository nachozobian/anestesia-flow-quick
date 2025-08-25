-- Fix security issue with function search path
-- Update the validation function to have proper security settings
CREATE OR REPLACE FUNCTION public.validate_patient_report(patient_id UUID, validator_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_has_permission BOOLEAN;
BEGIN
  -- Check if user has permission (Owner or Nurse role)
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = validator_user_id
      AND role IN ('Owner', 'Nurse')
  ) INTO user_has_permission;
  
  IF NOT user_has_permission THEN
    RAISE EXCEPTION 'User does not have permission to validate reports';
  END IF;
  
  -- Update patient status to Validado and set validation info
  UPDATE public.patients 
  SET 
    status = 'Validado',
    validated_by = validator_user_id,
    validated_at = now(),
    updated_at = now()
  WHERE id = patient_id
    AND status = 'Completado';
  
  RETURN FOUND;
END;
$$;

-- Also fix the trigger function to have proper search path
CREATE OR REPLACE FUNCTION public.update_patient_validation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- When status changes to 'Validado', set validation timestamp and user
  IF NEW.status = 'Validado' AND OLD.status != 'Validado' THEN
    NEW.validated_at = now();
    -- The validated_by will be set by the application
  END IF;
  
  -- If status changes away from 'Validado', clear validation fields
  IF NEW.status != 'Validado' AND OLD.status = 'Validado' THEN
    NEW.validated_at = NULL;
    NEW.validated_by = NULL;
  END IF;
  
  RETURN NEW;
END;
$$;