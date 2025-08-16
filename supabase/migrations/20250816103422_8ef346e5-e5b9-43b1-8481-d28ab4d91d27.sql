-- Limpiar datos duplicados manteniendo solo el registro más reciente de cada DNI
DELETE FROM patients 
WHERE id NOT IN (
    SELECT DISTINCT ON (dni) id 
    FROM patients 
    ORDER BY dni, created_at DESC
);

-- Añadir constraint de DNI único
ALTER TABLE patients ADD CONSTRAINT patients_dni_unique UNIQUE (dni);

-- También hacer único el constraint de token si no lo está ya
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_token_key;
ALTER TABLE patients ADD CONSTRAINT patients_token_unique UNIQUE (token);