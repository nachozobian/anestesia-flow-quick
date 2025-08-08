-- Insertar dos pacientes adicionales para verificar el flujo
INSERT INTO public.patients (name, dni, email, phone, birth_date, procedure, procedure_date, token, status) VALUES
('Ana Martínez Silva', '56789012D', 'ana.martinez@email.com', '+34 622 345 789', '1990-07-10', 'Cirugía de cataratas', '2025-01-25', 'patient-token-ana-003', 'Pendientes'),
('Roberto Jiménez Morales', '34567890E', 'roberto.jimenez@email.com', '+34 678 234 567', '1965-05-18', 'Reemplazo de cadera', '2025-01-30', 'patient-token-roberto-004', 'Pendientes');