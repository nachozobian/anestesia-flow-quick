-- Add validation functionality to patients table
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id);

-- Update the status check to include the new 'Validado' status
-- Note: We're not using CHECK constraints as they must be immutable
-- The application will handle validation of allowed status values

-- Add trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_patient_validation()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for validation updates
DROP TRIGGER IF EXISTS update_patient_validation_trigger ON public.patients;
CREATE TRIGGER update_patient_validation_trigger
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_patient_validation();

-- Create function to validate patient report
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