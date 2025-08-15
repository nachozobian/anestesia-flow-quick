-- Añadir nuevo paciente Nacho Zobian
INSERT INTO public.patients (name, dni, email, phone, birth_date, procedure, procedure_date, token, status) VALUES
('Nacho Zobian', '12345678Z', 'nacho.zobian@email.com', '+34 671180086', '1985-03-15', 'Evaluación Pre-operatoria', '2025-02-05', 'patient-token-nacho-005', 'Pendientes');