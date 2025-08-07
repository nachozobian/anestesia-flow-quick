-- Temporarily disable the problematic trigger to allow user creation
DROP TRIGGER IF EXISTS on_auth_user_created_assign_roles ON auth.users;

-- Drop the function that was causing issues
DROP FUNCTION IF EXISTS public.auto_assign_roles();

-- Create a simpler function to manually assign roles after users are created
CREATE OR REPLACE FUNCTION public.assign_admin_roles()
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;