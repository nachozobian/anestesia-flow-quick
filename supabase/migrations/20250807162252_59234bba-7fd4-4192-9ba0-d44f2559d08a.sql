-- Create internal users for medical administration panel
-- We need to use Supabase's admin API to create auth users

-- First, let's create a function that can be called to set up the users
CREATE OR REPLACE FUNCTION setup_admin_users()
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function
SELECT setup_admin_users();