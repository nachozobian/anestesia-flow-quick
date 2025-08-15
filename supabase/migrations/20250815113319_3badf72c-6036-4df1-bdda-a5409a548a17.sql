-- Fix critical security vulnerabilities in medical records tables
-- Remove overly permissive public access policies and implement proper patient authentication

-- Create helper function to verify patient token ownership
CREATE OR REPLACE FUNCTION public.verify_patient_token_access(patient_token text, target_patient_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.patients 
    WHERE token = patient_token 
    AND id = target_patient_id
  );
$$;

-- Create function to get current session patient ID from token (for edge functions)
CREATE OR REPLACE FUNCTION public.get_patient_id_from_token(patient_token text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id 
  FROM public.patients 
  WHERE token = patient_token 
  LIMIT 1;
$$;

-- =====================================
-- FIX INFORMED_CONSENTS TABLE SECURITY
-- =====================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Patients can update their consents" ON public.informed_consents;
DROP POLICY IF EXISTS "Patients can view their consents" ON public.informed_consents;
DROP POLICY IF EXISTS "System can create consents" ON public.informed_consents;

-- Create secure policies for informed_consents
CREATE POLICY "Authenticated staff can view all consents" 
ON public.informed_consents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('Owner', 'Nurse')
  )
);

CREATE POLICY "Authenticated staff can update consents" 
ON public.informed_consents 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('Owner', 'Nurse')
  )
);

CREATE POLICY "Authenticated staff can create consents" 
ON public.informed_consents 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('Owner', 'Nurse')
  )
);

-- =====================================
-- FIX PATIENT_CONVERSATIONS TABLE SECURITY
-- =====================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Patients can create conversation messages" ON public.patient_conversations;
DROP POLICY IF EXISTS "Patients can view their conversations" ON public.patient_conversations;

-- Create secure policies for patient_conversations
CREATE POLICY "Authenticated staff can view all conversations" 
ON public.patient_conversations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('Owner', 'Nurse')
  )
);

CREATE POLICY "Authenticated staff can create conversation messages" 
ON public.patient_conversations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('Owner', 'Nurse')
  )
);

-- =====================================
-- FIX PATIENT_RECOMMENDATIONS TABLE SECURITY
-- =====================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Patients can view their recommendations" ON public.patient_recommendations;
DROP POLICY IF EXISTS "System can create recommendations" ON public.patient_recommendations;

-- Create secure policies for patient_recommendations
CREATE POLICY "Authenticated staff can view all recommendations" 
ON public.patient_recommendations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('Owner', 'Nurse')
  )
);

CREATE POLICY "Authenticated staff can create recommendations" 
ON public.patient_recommendations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('Owner', 'Nurse')
  )
);

-- =====================================
-- SECURE PATIENT ACCESS FUNCTIONS
-- =====================================

-- Function to get patient conversations by token
CREATE OR REPLACE FUNCTION public.get_patient_conversations_by_token(patient_token text)
RETURNS TABLE(
  id uuid,
  patient_id uuid,
  role text,
  content text,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pc.id,
    pc.patient_id,
    pc.role,
    pc.content,
    pc.created_at
  FROM public.patient_conversations pc
  JOIN public.patients p ON pc.patient_id = p.id
  WHERE p.token = patient_token
  ORDER BY pc.created_at ASC;
$$;

-- Function to get patient recommendations by token
CREATE OR REPLACE FUNCTION public.get_patient_recommendations_by_token(patient_token text)
RETURNS TABLE(
  id uuid,
  patient_id uuid,
  category text,
  title text,
  description text,
  priority text,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pr.id,
    pr.patient_id,
    pr.category,
    pr.title,
    pr.description,
    pr.priority,
    pr.created_at
  FROM public.patient_recommendations pr
  JOIN public.patients p ON pr.patient_id = p.id
  WHERE p.token = patient_token
  ORDER BY pr.priority DESC, pr.created_at DESC;
$$;

-- Function to get patient consents by token
CREATE OR REPLACE FUNCTION public.get_patient_consents_by_token(patient_token text)
RETURNS TABLE(
  id uuid,
  patient_id uuid,
  consent_type text,
  content text,
  accepted boolean,
  signature_data text,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
  JOIN public.patients p ON ic.patient_id = p.id
  WHERE p.token = patient_token;
$$;

-- Function to add conversation message by token
CREATE OR REPLACE FUNCTION public.add_conversation_message_by_token(
  patient_token text,
  message_role text,
  message_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_patient_id uuid;
  new_message_id uuid;
BEGIN
  -- Get patient ID from token
  SELECT id INTO target_patient_id 
  FROM public.patients 
  WHERE token = patient_token;
  
  IF target_patient_id IS NULL THEN
    RAISE EXCEPTION 'Invalid patient token';
  END IF;
  
  -- Insert conversation message
  INSERT INTO public.patient_conversations (patient_id, role, content)
  VALUES (target_patient_id, message_role, message_content)
  RETURNING id INTO new_message_id;
  
  RETURN new_message_id;
END;
$$;

-- Function to update consent by token
CREATE OR REPLACE FUNCTION public.update_consent_by_token(
  patient_token text,
  consent_id uuid,
  is_accepted boolean,
  signature_data_param text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_patient_id uuid;
BEGIN
  -- Get patient ID from token
  SELECT id INTO target_patient_id 
  FROM public.patients 
  WHERE token = patient_token;
  
  IF target_patient_id IS NULL THEN
    RAISE EXCEPTION 'Invalid patient token';
  END IF;
  
  -- Update consent for this patient only
  UPDATE public.informed_consents 
  SET 
    accepted = is_accepted,
    signature_data = COALESCE(signature_data_param, signature_data),
    accepted_at = CASE WHEN is_accepted THEN now() ELSE accepted_at END
  WHERE id = consent_id 
  AND patient_id = target_patient_id;
  
  RETURN FOUND;
END;
$$;