-- Add process control fields to patients table
ALTER TABLE public.patients 
ADD COLUMN process_locked boolean DEFAULT false,
ADD COLUMN process_completed_at timestamp with time zone DEFAULT NULL,
ADD COLUMN data_consent_completed_at timestamp with time zone DEFAULT NULL,
ADD COLUMN chat_completed_at timestamp with time zone DEFAULT NULL,
ADD COLUMN recommendations_completed_at timestamp with time zone DEFAULT NULL,
ADD COLUMN consent_completed_at timestamp with time zone DEFAULT NULL;

-- Create function to validate process step access
CREATE OR REPLACE FUNCTION public.validate_step_access(
  patient_token text,
  target_step text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  patient_record patients%ROWTYPE;
  has_conversations boolean := false;
  has_recommendations boolean := false;
  has_consent boolean := false;
  validation_result jsonb;
BEGIN
  -- Get patient record
  SELECT * INTO patient_record
  FROM public.patients 
  WHERE token = patient_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Patient not found'
    );
  END IF;
  
  -- Check if process is locked
  IF patient_record.process_locked = true THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Process is completed and locked',
      'completed_at', patient_record.process_completed_at
    );
  END IF;
  
  -- Check existing progress
  SELECT EXISTS(
    SELECT 1 FROM public.patient_conversations 
    WHERE patient_id = patient_record.id
  ) INTO has_conversations;
  
  SELECT EXISTS(
    SELECT 1 FROM public.patient_recommendations 
    WHERE patient_id = patient_record.id
  ) INTO has_recommendations;
  
  SELECT EXISTS(
    SELECT 1 FROM public.informed_consents 
    WHERE patient_id = patient_record.id AND accepted = true
  ) INTO has_consent;
  
  -- Validate step access based on prerequisites
  CASE target_step
    WHEN 'data_consent' THEN
      -- Always allowed if not locked
      validation_result := jsonb_build_object('allowed', true);
      
    WHEN 'chat' THEN
      IF patient_record.data_consent_completed_at IS NULL THEN
        validation_result := jsonb_build_object(
          'allowed', false,
          'reason', 'Data consent must be completed first'
        );
      ELSE
        validation_result := jsonb_build_object('allowed', true);
      END IF;
      
    WHEN 'recommendations' THEN
      IF NOT has_conversations THEN
        validation_result := jsonb_build_object(
          'allowed', false,
          'reason', 'Chat conversation must be completed first'
        );
      ELSE
        validation_result := jsonb_build_object('allowed', true);
      END IF;
      
    WHEN 'consent' THEN
      IF NOT has_recommendations THEN
        validation_result := jsonb_build_object(
          'allowed', false,
          'reason', 'Recommendations must be generated first'
        );
      ELSE
        validation_result := jsonb_build_object('allowed', true);
      END IF;
      
    WHEN 'completed' THEN
      IF NOT has_consent THEN
        validation_result := jsonb_build_object(
          'allowed', false,
          'reason', 'Informed consent must be accepted first'
        );
      ELSE
        validation_result := jsonb_build_object('allowed', true);
      END IF;
      
    ELSE
      validation_result := jsonb_build_object(
        'allowed', false,
        'reason', 'Invalid step'
      );
  END CASE;
  
  RETURN validation_result;
END;
$$;

-- Create function to mark step as completed
CREATE OR REPLACE FUNCTION public.mark_step_completed(
  patient_token text,
  step_name text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  patient_id uuid;
  current_timestamp timestamp with time zone := now();
BEGIN
  -- Get patient ID
  SELECT id INTO patient_id
  FROM public.patients 
  WHERE token = patient_token AND process_locked = false;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update the appropriate timestamp based on step
  CASE step_name
    WHEN 'data_consent' THEN
      UPDATE public.patients 
      SET data_consent_completed_at = current_timestamp,
          updated_at = current_timestamp
      WHERE id = patient_id;
      
    WHEN 'chat' THEN
      UPDATE public.patients 
      SET chat_completed_at = current_timestamp,
          updated_at = current_timestamp
      WHERE id = patient_id;
      
    WHEN 'recommendations' THEN
      UPDATE public.patients 
      SET recommendations_completed_at = current_timestamp,
          updated_at = current_timestamp
      WHERE id = patient_id;
      
    WHEN 'consent' THEN
      UPDATE public.patients 
      SET consent_completed_at = current_timestamp,
          updated_at = current_timestamp
      WHERE id = patient_id;
      
    WHEN 'completed' THEN
      -- Lock the process permanently
      UPDATE public.patients 
      SET process_locked = true,
          process_completed_at = current_timestamp,
          status = 'Completado',
          updated_at = current_timestamp
      WHERE id = patient_id;
      
    ELSE
      RETURN false;
  END CASE;
  
  RETURN true;
END;
$$;

-- Create function to get current step for patient
CREATE OR REPLACE FUNCTION public.get_current_step_by_token(patient_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  patient_record patients%ROWTYPE;
  has_conversations boolean := false;
  has_recommendations boolean := false;
  has_consent boolean := false;
BEGIN
  -- Get patient record
  SELECT * INTO patient_record
  FROM public.patients 
  WHERE token = patient_token;
  
  IF NOT FOUND THEN
    RETURN 'invalid_token';
  END IF;
  
  -- If process is locked, return completed
  IF patient_record.process_locked = true THEN
    RETURN 'completed';
  END IF;
  
  -- Check existing progress
  SELECT EXISTS(
    SELECT 1 FROM public.patient_conversations 
    WHERE patient_id = patient_record.id
  ) INTO has_conversations;
  
  SELECT EXISTS(
    SELECT 1 FROM public.patient_recommendations 
    WHERE patient_id = patient_record.id
  ) INTO has_recommendations;
  
  SELECT EXISTS(
    SELECT 1 FROM public.informed_consents 
    WHERE patient_id = patient_record.id AND accepted = true
  ) INTO has_consent;
  
  -- Determine current step
  IF has_consent THEN
    RETURN 'completed';
  ELSIF has_recommendations THEN
    RETURN 'consent';
  ELSIF has_conversations THEN
    RETURN 'recommendations';
  ELSIF patient_record.data_consent_completed_at IS NOT NULL THEN
    RETURN 'chat';
  ELSE
    RETURN 'data_consent';
  END IF;
END;
$$;