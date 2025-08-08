-- Insertar dos pacientes adicionales con datos realistas
INSERT INTO public.patients (name, dni, email, phone, birth_date, procedure, procedure_date, token, status) VALUES
('María González Rodríguez', '12345678B', 'maria.gonzalez@email.com', '+34 600 123 456', '1985-03-15', 'Cirugía de vesícula biliar', '2025-01-15', 'patient-token-maria-001', 'Pendientes'),
('Carlos Fernández López', '87654321C', 'carlos.fernandez@email.com', '+34 655 987 654', '1978-11-22', 'Artroscopia de rodilla', '2025-01-20', 'patient-token-carlos-002', 'Pendientes');