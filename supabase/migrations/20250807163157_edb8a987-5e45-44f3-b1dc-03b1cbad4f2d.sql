-- Check current role assignments and fix them
SELECT u.email, ur.role 
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email IN ('admin@clinica.com', 'nurse@clinica.com');

-- Delete existing role assignments to fix them
DELETE FROM public.user_roles 
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email IN ('admin@clinica.com', 'nurse@clinica.com')
);

-- Correctly assign Owner role to admin@clinica.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'Owner'::app_role
FROM auth.users 
WHERE email = 'admin@clinica.com';

-- Correctly assign Nurse role to nurse@clinica.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'Nurse'::app_role
FROM auth.users 
WHERE email = 'nurse@clinica.com';

-- Verify the assignments
SELECT u.email, ur.role 
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email IN ('admin@clinica.com', 'nurse@clinica.com');