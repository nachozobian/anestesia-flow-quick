-- Fix function search path security warnings
-- Update existing functions to have proper search_path settings

-- Fix has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Fix setup_admin_users function
CREATE OR REPLACE FUNCTION public.setup_admin_users()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_user_id UUID;
    nurse_user_id UUID;
BEGIN
    -- Note: This function needs to be executed manually or through Supabase dashboard
    -- as we cannot directly insert into auth.users table from migrations
    
    -- For now, we'll prepare the role assignments
    -- The actual user creation must be done through Supabase Dashboard
    
    -- Clean up any existing role assignments for these emails
    DELETE FROM public.user_roles 
    WHERE user_id IN (
        SELECT id FROM auth.users 
        WHERE email IN ('admin@clinica.com', 'nurse@clinica.com')
    );
    
    -- Check if admin user exists and assign role
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'admin@clinica.com' 
    LIMIT 1;
    
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (admin_user_id, 'Owner'::app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
    
    -- Check if nurse user exists and assign role
    SELECT id INTO nurse_user_id 
    FROM auth.users 
    WHERE email = 'nurse@clinica.com' 
    LIMIT 1;
    
    IF nurse_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (nurse_user_id, 'Nurse'::app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
    
    RETURN 'Role assignments completed. Users must be created manually in Supabase dashboard.';
END;
$$;

-- Fix assign_admin_roles function  
CREATE OR REPLACE FUNCTION public.assign_admin_roles()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_user_id UUID;
    nurse_user_id UUID;
    result_text TEXT := '';
BEGIN
    -- Find and assign role to admin user
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'admin@clinica.com' 
    LIMIT 1;
    
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (admin_user_id, 'Owner')
        ON CONFLICT (user_id, role) DO NOTHING;
        result_text := result_text || 'Admin role assigned. ';
    ELSE
        result_text := result_text || 'Admin user not found. ';
    END IF;
    
    -- Find and assign role to nurse user
    SELECT id INTO nurse_user_id 
    FROM auth.users 
    WHERE email = 'nurse@clinica.com' 
    LIMIT 1;
    
    IF nurse_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (nurse_user_id, 'Nurse')
        ON CONFLICT (user_id, role) DO NOTHING;
        result_text := result_text || 'Nurse role assigned. ';
    ELSE
        result_text := result_text || 'Nurse user not found. ';
    END IF;
    
    RETURN result_text;
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix the new get_patient_by_token function
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
SET search_path = public
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

-- Fix the new update_patient_by_token function
CREATE OR REPLACE FUNCTION public.update_patient_by_token(
  patient_token text,
  new_status text DEFAULT NULL,
  new_procedure_date date DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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