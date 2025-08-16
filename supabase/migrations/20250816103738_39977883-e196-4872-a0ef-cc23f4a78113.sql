-- Borrar todos los registros creados desde ayer (2025-08-16) para volver al estado anterior
DELETE FROM patients 
WHERE created_at >= '2025-08-16 00:00:00+00';

-- Verificar que solo queden los registros originales
SELECT COUNT(*) as total_patients, 
       MIN(created_at) as oldest_record, 
       MAX(created_at) as newest_record 
FROM patients;