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
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Skip header row and convert to patient objects
        const patientData: PatientData[] = jsonData.slice(1).map((row: any) => ({
          name: row[0] || '',
          email: row[1] || '',
          phone: row[2] || '',
          birthDate: row[3] || '',
          procedure: row[4] || '',
          procedureDate: row[5] || ''
        })).filter(patient => patient.name && patient.email);

        // Save patients to database
        const savedPatients = await savePatientsToDB(patientData);
        
        setPatients(savedPatients);
        setUploadStatus('success');
        toast({
          title: "Archivo procesado exitosamente",
          description: `Se guardaron ${savedPatients.length} pacientes en la base de datos.`,
        });
      } catch (error) {
        console.error('Error reading file:', error);
        setUploadStatus('error');
        toast({
          title: "Error",
          description: "Error al procesar el archivo. Verifica el formato.",
          variant: "destructive",
        });
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const generateUniqueToken = (patient: PatientData, index: number): string => {
    const rawToken = `${patient.email}-${patient.name}-${index}-${Date.now()}`;
    return btoa(rawToken).replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
  };

  const generateUniqueDNI = (patient: PatientData, index: number): string => {
    // Generate a temporary DNI based on patient info if not provided
    const hash = btoa(`${patient.name}-${patient.email}-${index}`).replace(/[^0-9]/g, '');
    return hash.substring(0, 8).padStart(8, '0');
  };

  const savePatientsToDB = async (patientData: PatientData[]): Promise<PatientData[]> => {
    const patientsToInsert = patientData.map((patient, index) => ({
      dni: generateUniqueDNI(patient, index),
      name: patient.name,
      email: patient.email,
      phone: patient.phone || null,
      birth_date: patient.birthDate ? new Date(patient.birthDate).toISOString().split('T')[0] : null,
      procedure: patient.procedure || null,
      procedure_date: patient.procedureDate ? new Date(patient.procedureDate).toISOString().split('T')[0] : null,
      token: generateUniqueToken(patient, index),
      status: 'Pendientes'
    }));

    const { data, error } = await supabase
      .from('patients')
      .insert(patientsToInsert)
      .select();

    if (error) {
      console.error('Error saving patients:', error);
      throw new Error('Error al guardar pacientes en la base de datos');
    }

    return data.map(dbPatient => ({
      name: dbPatient.name,
      email: dbPatient.email,
      phone: dbPatient.phone || '',
      birthDate: dbPatient.birth_date || '',
      procedure: dbPatient.procedure || '',
      procedureDate: dbPatient.procedure_date || ''
    }));
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