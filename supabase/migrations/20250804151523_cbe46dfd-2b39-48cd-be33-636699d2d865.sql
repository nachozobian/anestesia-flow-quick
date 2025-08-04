-- Phase 1: Database Setup for Patient Flow

-- Create patients table
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dni VARCHAR(20) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  birth_date DATE,
  procedure TEXT,
  procedure_date DATE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create patient_responses table (enhanced from existing structure)
CREATE TABLE public.patient_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  has_allergies BOOLEAN,
  allergies TEXT,
  current_medications TEXT,
  medical_history TEXT,
  previous_surgeries TEXT,
  family_history TEXT,
  smoking BOOLEAN,
  alcohol BOOLEAN,
  exercise TEXT,
  diet TEXT,
  sleep_hours INTEGER,
  stress_level INTEGER,
  additional_concerns TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create patient_conversations table for AI chat
CREATE TABLE public.patient_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create patient_recommendations table
CREATE TABLE public.patient_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create informed_consents table
CREATE TABLE public.informed_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  consent_type TEXT NOT NULL,
  content TEXT NOT NULL,
  accepted BOOLEAN DEFAULT false,
  signature_data TEXT,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informed_consents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for patients table
CREATE POLICY "Public can view patients by token" 
ON public.patients 
FOR SELECT 
USING (true);

CREATE POLICY "Public can update patients by token" 
ON public.patients 
FOR UPDATE 
USING (true);

-- RLS Policies for patient_responses table
CREATE POLICY "Patients can view their own responses" 
ON public.patient_responses 
FOR SELECT 
USING (true);

CREATE POLICY "Patients can create their own responses" 
ON public.patient_responses 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Patients can update their own responses" 
ON public.patient_responses 
FOR UPDATE 
USING (true);

-- RLS Policies for patient_conversations table
CREATE POLICY "Patients can view their conversations" 
ON public.patient_conversations 
FOR SELECT 
USING (true);

CREATE POLICY "Patients can create conversation messages" 
ON public.patient_conversations 
FOR INSERT 
WITH CHECK (true);

-- RLS Policies for patient_recommendations table
CREATE POLICY "Patients can view their recommendations" 
ON public.patient_recommendations 
FOR SELECT 
USING (true);

CREATE POLICY "System can create recommendations" 
ON public.patient_recommendations 
FOR INSERT 
WITH CHECK (true);

-- RLS Policies for informed_consents table
CREATE POLICY "Patients can view their consents" 
ON public.informed_consents 
FOR SELECT 
USING (true);

CREATE POLICY "Patients can update their consents" 
ON public.informed_consents 
FOR UPDATE 
USING (true);

CREATE POLICY "System can create consents" 
ON public.informed_consents 
FOR INSERT 
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_responses_updated_at
  BEFORE UPDATE ON public.patient_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();