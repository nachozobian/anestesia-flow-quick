-- Fix critical security vulnerability in patients table RLS policies
-- Remove overly permissive public access policies and implement proper restrictions

-- Drop the overly permissive policies that allow unrestricted public access
DROP POLICY IF EXISTS "Public can view patients by token" ON public.patients;
DROP POLICY IF EXISTS "Public can update patients by token" ON public.patients;

-- Create secure RLS policies for patients table

-- Policy 1: Allow authenticated admins and nurses to view all patients
CREATE POLICY "Authenticated staff can view all patients" 
ON public.patients 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('Owner', 'Nurse')
  )
);

-- Policy 2: Allow authenticated admins and nurses to update patients
CREATE POLICY "Authenticated staff can update patients" 
ON public.patients 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('Owner', 'Nurse')
  )
);

-- Policy 3: Allow authenticated admins to insert patients
CREATE POLICY "Authenticated staff can insert patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('Owner', 'Nurse')
  )
);

-- Create a secure function for patient token-based access
-- This function will be used by the application to securely access patient data
CREATE OR REPLACE FUNCTION public.get_patient_by_token(patient_token text)
RETURNS TABLE(
  id uuid,
  dni character varying,
  name text,
  email text,
  phone text,
  birth_date date,
  procedure text,
  procedure_date date,
  token text,
  status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    p.dni,
    p.name,
    p.email,
    p.phone,
    p.birth_date,
    p.procedure,
    p.procedure_date,
    p.token,
    p.status,
    p.created_at,
    p.updated_at
  FROM public.patients p
  WHERE p.token = patient_token
  LIMIT 1;
$$;

-- Create a secure function for updating patient data by token
CREATE OR REPLACE FUNCTION public.update_patient_by_token(
  patient_token text,
  new_status text DEFAULT NULL,
  new_procedure_date date DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.patients 
  SET 
    status = COALESCE(new_status, status),
    procedure_date = COALESCE(new_procedure_date, procedure_date),
    updated_at = now()
  WHERE token = patient_token;
  
  RETURN FOUND;
END;
$$;