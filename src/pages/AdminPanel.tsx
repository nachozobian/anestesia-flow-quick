import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Download, Users, Link, Copy, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { AuthGuard } from '@/components/AuthGuard';
import { SystemPromptManager } from '@/components/SystemPromptManager';
import { AppointmentsCalendar } from '@/components/AppointmentsCalendar';
import PatientStatusManager from '@/components/PatientStatusManager';
import * as XLSX from 'xlsx';

interface PatientData {
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  procedure: string;
  procedureDate: string;
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setUploadStatus('uploading');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let data: ArrayBuffer;
        
        // Handle CSV files with proper UTF-8 encoding
        if (file.name.toLowerCase().endsWith('.csv')) {
          const text = new TextDecoder('utf-8').decode(e.target?.result as ArrayBuffer);
          
          // Parse CSV manually to preserve UTF-8 encoding
          const lines = text.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const rows = lines.slice(1).map(line => {
            // Simple CSV parser that handles quoted values
            const values = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            values.push(current.trim()); // Add the last value
            
            return values;
          });

          console.log('Headers detected:', headers);
          console.log('Sample row:', rows[0]);

          // Process the data
          const processedData = processPatientData(headers, rows);
          
          if (processedData.length === 0) {
            throw new Error('No se encontraron datos válidos de pacientes. Asegúrate de que el archivo tenga las columnas: nombre, email y DNI');
          }

          // Save patients to database
          const savedPatients = await savePatientsToDB(processedData);
          
          setPatients(savedPatients);
          setUploadStatus('success');
          toast({
            title: "Archivo procesado exitosamente",
            description: `Se guardaron ${savedPatients.length} pacientes en la base de datos.`,
          });
        } else {
          // Handle Excel files
          data = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Parse with headers to get proper column mapping
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1);

          console.log('Headers detected:', headers);
          console.log('Sample row:', rows[0]);

          // Process the data
          const processedData = processPatientData(headers, rows);
          
          if (processedData.length === 0) {
            throw new Error('No se encontraron datos válidos de pacientes. Asegúrate de que el archivo tenga las columnas: nombre, email y DNI');
          }

          // Save patients to database
          const savedPatients = await savePatientsToDB(processedData);
          
          setPatients(savedPatients);
          setUploadStatus('success');
          toast({
            title: "Archivo procesado exitosamente",
            description: `Se guardaron ${savedPatients.length} pacientes en la base de datos.`,
          });
        }
      } catch (error) {
        console.error('Error reading file:', error);
        setUploadStatus('error');
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Error al procesar el archivo. Verifica el formato.",
          variant: "destructive",
        });
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const processPatientData = (headers: string[], rows: any[]): (PatientData & { dni?: string })[] => {
    // Detect column mapping
    const getColumnIndex = (possibleNames: string[]) => {
      return possibleNames.reduce((found, name) => {
        if (found !== -1) return found;
        return headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
      }, -1);
    };

    const nameIndex = getColumnIndex(['name', 'nombre']);
    const emailIndex = getColumnIndex(['email', 'correo']);
    const phoneIndex = getColumnIndex(['phone', 'telefono', 'teléfono']);
    const birthDateIndex = getColumnIndex(['birth_date', 'birthdate', 'fecha_nacimiento', 'nacimiento']);
    const procedureIndex = getColumnIndex(['procedure', 'procedimiento']);
    const procedureDateIndex = getColumnIndex(['procedure_date', 'proceduredate', 'fecha_procedimiento', 'fecha_cirugía']);
    const dniIndex = getColumnIndex(['dni', 'id_paciente', 'identificacion']);

    // Convert to patient objects
    const patientData: (PatientData & { dni?: string })[] = rows.map((row: any) => ({
      name: nameIndex !== -1 ? (row[nameIndex] || '').toString().trim() : '',
      email: emailIndex !== -1 ? (row[emailIndex] || '').toString().trim() : '',
      phone: phoneIndex !== -1 ? (row[phoneIndex] || '').toString().trim() : '',
      birthDate: birthDateIndex !== -1 ? (row[birthDateIndex] || '').toString().trim() : '',
      procedure: procedureIndex !== -1 ? (row[procedureIndex] || '').toString().trim() : '',
      procedureDate: procedureDateIndex !== -1 ? (row[procedureDateIndex] || '').toString().trim() : '',
      dni: dniIndex !== -1 ? (row[dniIndex] || '').toString().trim() : ''
    })).filter(patient => patient.name && patient.email && patient.dni);

    console.log('Processed patients:', patientData.length);
    return patientData;
  };

  const generateUniqueToken = (patient: PatientData, index: number): string => {
    const rawToken = `${patient.email}-${patient.name}-${index}-${Date.now()}-${Math.random()}`;
    return btoa(rawToken).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  };

  const checkAndGenerateUniqueToken = async (patient: PatientData, index: number): Promise<string> => {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const token = generateUniqueToken(patient, index + attempts);
      
      // Check if token already exists
      const { data } = await supabase
        .from('patients')
        .select('id')
        .eq('token', token)
        .single();
      
      if (!data) {
        return token; // Token is unique
      }
      
      attempts++;
    }
    
    throw new Error(`No se pudo generar un token único para ${patient.name}`);
  };

  const savePatientsToDB = async (patientData: (PatientData & { dni?: string })[]): Promise<PatientData[]> => {
    const processedPatients = [];
    const newPatientIds: string[] = [];
    
    for (let index = 0; index < patientData.length; index++) {
      const patient = patientData[index];
      try {
        // Check if patient with this DNI already exists
        const { data: existingPatient } = await supabase
          .from('patients')
          .select('id')
          .eq('dni', patient.dni)
          .single();
        
        if (existingPatient) {
          console.log(`Paciente con DNI ${patient.dni} ya existe, saltando...`);
          continue;
        }

        const uniqueToken = await checkAndGenerateUniqueToken(patient, index);
        
        const patientToInsert = {
          dni: patient.dni!,
          name: patient.name,
          email: patient.email,
          phone: patient.phone || null,
          birth_date: patient.birthDate ? new Date(patient.birthDate).toISOString().split('T')[0] : null,
          procedure: patient.procedure || null,
          procedure_date: patient.procedureDate ? new Date(patient.procedureDate).toISOString().split('T')[0] : null,
          token: uniqueToken,
          status: 'Pendientes'
        };

        const { data, error } = await supabase
          .from('patients')
          .insert([patientToInsert])
          .select()
          .single();

        if (error) {
          if (error.code === '23505') { // Unique constraint violation
            console.log(`Paciente ${patient.name} ya existe, saltando...`);
            continue;
          }
          console.error(`Error saving patient ${patient.name}:`, error);
          continue;
        }

        // Store the new patient ID for SMS sending
        newPatientIds.push(data.id);

        processedPatients.push({
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          birthDate: data.birth_date || '',
          procedure: data.procedure || '',
          procedureDate: data.procedure_date || ''
        });
      } catch (error) {
        console.error(`Error processing patient ${patient.name}:`, error);
        continue;
      }
    }

    // Send SMS to all newly created patients
    if (newPatientIds.length > 0) {
      try {
        console.log(`Enviando SMS a ${newPatientIds.length} pacientes nuevos...`);
        
        // Send patient links SMS
        const { data: smsResult, error: smsError } = await supabase.functions.invoke('send-patient-links', {
          body: { patientIds: newPatientIds }
        });

        if (smsError) {
          console.error('Error sending patient links SMS:', smsError);
        }

        // Send appointment SMS for patients with procedure dates
        const patientsWithDates = await supabase
          .from('patients')
          .select('id, name, procedure_date, procedure')
          .in('id', newPatientIds)
          .not('procedure_date', 'is', null);

        if (patientsWithDates.data && patientsWithDates.data.length > 0) {
          console.log(`Enviando SMS de citas a ${patientsWithDates.data.length} pacientes con fechas programadas...`);
          
          for (const patient of patientsWithDates.data) {
            try {
              const { error: appointmentSmsError } = await supabase.functions.invoke('send-appointment-sms', {
                body: {
                  patientId: patient.id,
                  appointmentDate: patient.procedure_date,
                  procedure: patient.procedure || 'Procedimiento programado'
                }
              });

              if (appointmentSmsError) {
                console.error(`Error sending appointment SMS to patient ${patient.name}:`, appointmentSmsError);
              }
            } catch (error) {
              console.error(`Error calling appointment SMS for patient ${patient.name}:`, error);
            }
          }
        }

        // Show completion message
        if (smsError) {
          toast({
            title: "Pacientes guardados",
            description: `Se guardaron ${processedPatients.length} pacientes, pero hubo errores enviando algunos SMS.`,
            variant: "destructive",
          });
        } else {
          const { summary } = smsResult;
          const appointmentCount = patientsWithDates.data?.length || 0;
          toast({
            title: "¡Proceso completado!",
            description: `${processedPatients.length} pacientes guardados. SMS enlaces: ${summary.sent}/${summary.total}. SMS citas: ${appointmentCount}`,
          });
        }
      } catch (error) {
        console.error('Error calling SMS functions:', error);
        toast({
          title: "Pacientes guardados",
          description: `Se guardaron ${processedPatients.length} pacientes, pero no se pudieron enviar los SMS.`,
          variant: "destructive",
        });
      }
    }

    return processedPatients;
  };

  const generatePatientLink = (patient: PatientData, index: number): string => {
    // Generate a unique token based on patient info
    const rawToken = `${patient.email}-${patient.name}-${index}-${Date.now()}`;
    const token = btoa(rawToken).replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
    return `${window.location.origin}/patient/${token}`;
  };

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text);
    toast({
      title: "¡Copiado!",
      description: "Enlace copiado al portapapeles",
    });
  };

  const downloadTemplate = (): void => {
    const templateData = [
      ['Nombre', 'Email', 'Teléfono', 'Fecha Nacimiento', 'Procedimiento', 'Fecha Procedimiento'],
      ['Juan Pérez', 'juan.perez@email.com', '+34123456789', '1985-03-15', 'Cirugía de vesícula', '2024-02-20'],
      ['María García', 'maria.garcia@email.com', '+34987654321', '1978-07-22', 'Apendicectomía', '2024-02-22']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pacientes');
    XLSX.writeFile(workbook, 'plantilla_pacientes.xlsx');
  };

  return (
    <AuthGuard requiredRoles={['Owner', 'Nurse']}>
      {(userRole) => (
        <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate('/')}
                className="h-10 w-10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Panel de Administración</h1>
                <p className="text-muted-foreground">Gestión de pacientes y datos médicos</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="patients" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="patients">Gestión de Pacientes</TabsTrigger>
              <TabsTrigger value="status">Estado de Pacientes</TabsTrigger>
              <TabsTrigger value="calendar">Calendario de Citas</TabsTrigger>
              <TabsTrigger value="system">Prompt del Sistema</TabsTrigger>
            </TabsList>

            <TabsContent value="patients" className="space-y-6">
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Archivos Subidos</CardTitle>
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{uploadedFile ? 1 : 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {uploadedFile ? 'Archivo cargado' : 'Sin archivos'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Pacientes</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{patients.length}</div>
                    <p className="text-xs text-muted-foreground">
                      Pacientes registrados
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Enlaces Generados</CardTitle>
                    <Link className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{patients.length}</div>
                    <p className="text-xs text-muted-foreground">
                      Enlaces únicos creados
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* File Upload Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Cargar Datos de Pacientes</CardTitle>
                  <CardDescription>
                    Subir archivo XLSX o CSV con información de pacientes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      accept=".xlsx,.csv"
                      onChange={handleFileUpload}
                      ref={fileInputRef}
                      className="flex-1"
                    />
                    <Button onClick={downloadTemplate} variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Plantilla
                    </Button>
                  </div>
                  
                  {uploadStatus === 'uploading' && (
                    <div className="text-sm text-muted-foreground">
                      Procesando archivo...
                    </div>
                  )}
                  
                  {uploadStatus === 'success' && uploadedFile && (
                    <div className="text-sm text-green-600">
                      ✓ Archivo "{uploadedFile.name}" procesado correctamente
                    </div>
                  )}
                  
                  {uploadStatus === 'error' && (
                    <div className="text-sm text-red-600">
                      ✗ Error al procesar el archivo
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Patients Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Lista de Pacientes</CardTitle>
                  <CardDescription>
                    Información detallada de cada paciente y enlaces únicos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {patients.length === 0 ? (
                    <div className="text-center py-8">
                      {uploadedFile ? (
                        <div className="text-muted-foreground">
                          No se encontraron datos de pacientes en el archivo.
                          <br />
                          Verifica que el formato del archivo sea correcto.
                        </div>
                      ) : (
                        <div className="text-muted-foreground">
                          Sube un archivo para ver los datos de pacientes aquí.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead>Nacimiento</TableHead>
                            <TableHead>Procedimiento</TableHead>
                            <TableHead>Fecha Cirugía</TableHead>
                            <TableHead>Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {patients.map((patient, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{patient.name}</TableCell>
                              <TableCell>{patient.email}</TableCell>
                              <TableCell>{patient.phone || '-'}</TableCell>
                              <TableCell>
                                {patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('es-ES') : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{patient.procedure || 'No especificado'}</Badge>
                              </TableCell>
                              <TableCell>
                                {patient.procedureDate ? new Date(patient.procedureDate).toLocaleDateString('es-ES') : '-'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyToClipboard(generatePatientLink(patient, index))}
                                  className="flex items-center gap-2"
                                >
                                  <Copy className="h-4 w-4" />
                                  Copiar enlace
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="status">
              <PatientStatusManager userRole={userRole} />
            </TabsContent>

            <TabsContent value="calendar">
              <AppointmentsCalendar />
            </TabsContent>

            <TabsContent value="system">
              <SystemPromptManager userRole={userRole} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      )}
    </AuthGuard>
  );
};

export default AdminPanel;