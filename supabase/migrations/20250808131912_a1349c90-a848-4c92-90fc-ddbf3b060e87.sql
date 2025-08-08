-- Add status field to patients table
ALTER TABLE public.patients 
ADD COLUMN status TEXT DEFAULT 'Pendientes' CHECK (status IN ('Pendientes', 'En progreso', 'Completado'));

-- Add index for better performance on status queries
CREATE INDEX idx_patients_status ON public.patients(status);

-- Add index for date filtering
CREATE INDEX idx_patients_procedure_date ON public.patients(procedure_date);

-- Update RLS policy to allow status updates
CREATE POLICY "Admin can update patient status" 
ON public.patients 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('Owner', 'Nurse')
  )
);