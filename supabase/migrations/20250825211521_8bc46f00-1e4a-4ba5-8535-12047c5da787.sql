-- Update the check constraint to allow the "Validado" status
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_status_check;

ALTER TABLE public.patients ADD CONSTRAINT patients_status_check 
CHECK (status IN ('Pendientes', 'En progreso', 'Completado', 'Validado'));