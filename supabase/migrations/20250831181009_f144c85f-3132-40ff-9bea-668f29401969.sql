-- Add infection detection field to patients table
ALTER TABLE public.patients 
ADD COLUMN has_infection boolean DEFAULT false,
ADD COLUMN infection_detected_at timestamp with time zone DEFAULT NULL,
ADD COLUMN infection_keywords text DEFAULT NULL;