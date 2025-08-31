-- Create table for conversation summaries
CREATE TABLE public.conversation_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  summary TEXT NOT NULL,
  generated_by TEXT DEFAULT 'AI',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated staff can view conversation summaries" 
ON public.conversation_summaries 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['Owner'::app_role, 'Nurse'::app_role])))));

CREATE POLICY "Authenticated staff can create conversation summaries" 
ON public.conversation_summaries 
FOR INSERT 
WITH CHECK (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['Owner'::app_role, 'Nurse'::app_role])))));

CREATE POLICY "Authenticated staff can update conversation summaries" 
ON public.conversation_summaries 
FOR UPDATE 
USING (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['Owner'::app_role, 'Nurse'::app_role])))));

-- Create function to get conversation summary by token
CREATE OR REPLACE FUNCTION public.get_conversation_summary_by_token(patient_token text)
RETURNS TABLE(id uuid, patient_id uuid, summary text, generated_by text, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    cs.id,
    cs.patient_id,
    cs.summary,
    cs.generated_by,
    cs.created_at,
    cs.updated_at
  FROM public.conversation_summaries cs
  JOIN public.patients p ON cs.patient_id = p.id
  WHERE p.token = patient_token
  ORDER BY cs.created_at DESC
  LIMIT 1;
$function$;

-- Create updated_at trigger
CREATE TRIGGER update_conversation_summaries_updated_at
BEFORE UPDATE ON public.conversation_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();