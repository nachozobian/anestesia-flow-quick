import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Users, Link as LinkIcon, Download, Copy } from "lucide-react";
import * as XLSX from 'xlsx';

interface PatientData {
  name: string;
  email: string;
  phone: string;
  birth_date: string;
  procedure: string;
  procedure_date: string;
}

const AdminPanel = () => {
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
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
          birth_date: row[3] || '',
          procedure: row[4] || '',
          procedure_date: row[5] || ''
        })).filter(patient => patient.name); // Filter out empty rows

        setPatients(patientData);
        toast({
          title: "Archivo cargado exitosamente",
          description: `Se han detectado ${patientData.length} pacientes.`,
        });
      } catch (error) {
        console.error('Error reading file:', error);
        toast({
          title: "Error al leer el archivo",
          description: "Asegúrate de que el archivo tenga el formato correcto.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const generatePatientLink = (patient: PatientData, index: number) => {
    // Generate a simple token based on patient info and index
    const token = btoa(`${patient.phone}-${index}-${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    return `${window.location.origin}/patient/${token}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Enlace copiado",
      description: "El enlace ha sido copiado al portapapeles.",
    });
  };

  const downloadTemplate = () => {
    const template = [
      ['Nombre', 'Email', 'Teléfono', 'Fecha Nacimiento', 'Procedimiento', 'Fecha Procedimiento'],
      ['Juan Pérez', 'juan@email.com', '+123456789', '1980-01-15', 'Cirugía General', '2024-02-15'],
      ['María García', 'maria@email.com', '+987654321', '1975-05-20', 'Cirugía Cardíaca', '2024-02-20']
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_pacientes.xlsx");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-xl font-bold text-gray-900">AnestesiaFlow</span>
              <Badge variant="outline" className="ml-2">Panel Médico</Badge>
            </div>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Volver al Inicio
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Archivos Cargados</p>
                  <p className="text-2xl font-bold text-gray-900">{uploadedFile ? 1 : 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pacientes</p>
                  <p className="text-2xl font-bold text-gray-900">{patients.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <LinkIcon className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Enlaces Generados</p>
                  <p className="text-2xl font-bold text-gray-900">{patients.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Cargar Archivo de Pacientes
            </CardTitle>
            <CardDescription>
              Sube un archivo CSV o XLSX con la información de tus pacientes. 
              <Button variant="link" className="p-0 h-auto ml-2" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />
                Descargar plantilla
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <Label htmlFor="file">Archivo CSV/XLSX</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  disabled={isUploading}
                />
              </div>
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploading}
                className="mt-6"
              >
                {isUploading ? "Cargando..." : "Seleccionar Archivo"}
              </Button>
            </div>
            {uploadedFile && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Archivo cargado:</strong> {uploadedFile.name} ({patients.length} pacientes detectados)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Patients Table */}
        {patients.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Vista Previa de Pacientes</CardTitle>
              <CardDescription>
                Revisa la información cargada y genera enlaces únicos para cada paciente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Procedimiento</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Enlace Paciente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patients.map((patient, index) => {
                      const patientLink = generatePatientLink(patient, index);
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{patient.name}</TableCell>
                          <TableCell>{patient.email}</TableCell>
                          <TableCell>{patient.phone}</TableCell>
                          <TableCell>{patient.procedure}</TableCell>
                          <TableCell>{patient.procedure_date}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(patientLink)}
                              className="flex items-center gap-1"
                            >
                              <Copy className="h-4 w-4" />
                              Copiar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {patients.length === 0 && uploadedFile && (
          <Card>
            <CardContent className="p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron datos</h3>
              <p className="text-gray-600">
                Asegúrate de que tu archivo tenga el formato correcto con las columnas: 
                Nombre, Email, Teléfono, Fecha Nacimiento, Procedimiento, Fecha Procedimiento
              </p>
            </CardContent>
          </Card>
        )}

        {patients.length === 0 && !uploadedFile && (
          <Card>
            <CardContent className="p-8 text-center">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Comenzar cargando un archivo</h3>
              <p className="text-gray-600 mb-4">
                Sube tu primer archivo CSV o XLSX para empezar a gestionar pacientes
              </p>
              <Button onClick={downloadTemplate} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Descargar Plantilla
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;