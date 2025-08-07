-- Create default users and assign roles for internal medical tool
-- First, let's create a function to handle user creation with roles

-- Insert default users (these will be created manually in Supabase Auth)
-- We'll create the role assignments for the emails we'll use

-- Clean up any existing test data
DELETE FROM public.user_roles WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN ('admin@clinica.com', 'nurse@clinica.com')
);

-- Note: We cannot directly insert into auth.users table via migration
-- These users must be created through Supabase Auth Dashboard or API
-- We'll prepare the role assignments for when they are created

-- The users will need to be created manually with these credentials:
-- admin@clinica.com (Owner role)
-- nurse@clinica.com (Nurse role)

-- Create a function to auto-assign roles when users with specific emails are created
CREATE OR REPLACE FUNCTION public.auto_assign_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Assign Owner role to admin email
  IF NEW.email = 'admin@clinica.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'Owner'::app_role);
  END IF;
  
  -- Assign Nurse role to nurse email
  IF NEW.email = 'nurse@clinica.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'Nurse'::app_role);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically assign roles when users are created
DROP TRIGGER IF EXISTS on_auth_user_created_assign_roles ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_roles
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_roles();