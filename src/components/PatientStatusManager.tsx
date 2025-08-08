import React, { useState, useEffect } from 'react';
import { CalendarIcon, Filter, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Patient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dni: string;
  procedure?: string;
  procedure_date?: string;
  status: string;
  created_at: string;
  birth_date?: string;
  token: string;
  updated_at: string;
}

interface PatientStatusManagerProps {
  userRole: string | null;
}

const PatientStatusManager: React.FC<PatientStatusManagerProps> = ({ userRole }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const canEditStatus = userRole === 'Owner' || userRole === 'Nurse';

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    filterPatients();
  }, [patients, statusFilter, startDate, endDate, searchTerm]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pacientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterPatients = () => {
    let filtered = [...patients];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(patient => patient.status === statusFilter);
    }

    // Filter by date range
    if (startDate || endDate) {
      filtered = filtered.filter(patient => {
        if (!patient.procedure_date) return false;
        const procedureDate = new Date(patient.procedure_date);
        
        if (startDate && procedureDate < startDate) return false;
        if (endDate && procedureDate > endDate) return false;
        
        return true;
      });
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(patient => 
        patient.name.toLowerCase().includes(term) ||
        patient.email.toLowerCase().includes(term) ||
        patient.dni.toLowerCase().includes(term) ||
        (patient.procedure && patient.procedure.toLowerCase().includes(term))
      );
    }

    setFilteredPatients(filtered);
  };

  const updatePatientStatus = async (patientId: string, newStatus: 'Pendientes' | 'En progreso' | 'Completado') => {
    if (!canEditStatus) {
      toast({
        title: "Sin permisos",
        description: "No tienes permisos para actualizar el estado de pacientes",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('patients')
        .update({ status: newStatus })
        .eq('id', patientId);

      if (error) throw error;

      setPatients(prev => prev.map(patient => 
        patient.id === patientId 
          ? { ...patient, status: newStatus }
          : patient
      ));

      toast({
        title: "Estado actualizado",
        description: `El estado del paciente se actualizó a "${newStatus}"`,
      });
    } catch (error) {
      console.error('Error updating patient status:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del paciente",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pendientes':
        return <AlertCircle className="h-4 w-4" />;
      case 'En progreso':
        return <Clock className="h-4 w-4" />;
      case 'Completado':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Pendientes':
        return 'destructive';
      case 'En progreso':
        return 'secondary';
      case 'Completado':
        return 'default';
      default:
        return 'outline';
    }
  };

  const getStatusCounts = () => {
    const counts = {
      total: filteredPatients.length,
      pendientes: filteredPatients.filter(p => p.status === 'Pendientes').length,
      enProgreso: filteredPatients.filter(p => p.status === 'En progreso').length,
      completado: filteredPatients.filter(p => p.status === 'Completado').length,
    };
    return counts;
  };

  const counts = getStatusCounts();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Cargando pacientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pacientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{counts.pendientes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <Clock className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary-foreground">{counts.enProgreso}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{counts.completado}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
          <CardDescription>
            Filtra pacientes por estado, fechas o términos de búsqueda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="Pendientes">Pendientes</SelectItem>
                  <SelectItem value="En progreso">En progreso</SelectItem>
                  <SelectItem value="Completado">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha inicio</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha fin</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Search Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <Input
                placeholder="Nombre, email, DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Clear Filters */}
          {(statusFilter !== 'all' || startDate || endDate || searchTerm) && (
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('all');
                  setStartDate(undefined);
                  setEndDate(undefined);
                  setSearchTerm('');
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Pacientes</CardTitle>
          <CardDescription>
            Gestiona el estado de los pacientes y sus tratamientos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPatients.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                No se encontraron pacientes con los filtros aplicados.
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Procedimiento</TableHead>
                    <TableHead>Fecha Cirugía</TableHead>
                    <TableHead>Estado</TableHead>
                    {canEditStatus && <TableHead>Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{patient.name}</div>
                          <div className="text-sm text-muted-foreground">{patient.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{patient.dni}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {patient.procedure || 'No especificado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {patient.procedure_date 
                          ? format(new Date(patient.procedure_date), "PPP", { locale: es })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusVariant(patient.status)}
                          className="flex items-center gap-1 w-fit"
                        >
                          {getStatusIcon(patient.status)}
                          {patient.status}
                        </Badge>
                      </TableCell>
                      {canEditStatus && (
                        <TableCell>
                          <Select
                            value={patient.status}
                            onValueChange={(value: 'Pendientes' | 'En progreso' | 'Completado') => 
                              updatePatientStatus(patient.id, value)
                            }
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pendientes">Pendientes</SelectItem>
                              <SelectItem value="En progreso">En progreso</SelectItem>
                              <SelectItem value="Completado">Completado</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientStatusManager;