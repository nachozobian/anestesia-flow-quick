import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Loader2, Users, Clock } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isToday, isTomorrow, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

interface Patient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  procedure?: string;
  procedure_date: string;
  created_at: string;
}

export const AppointmentsCalendar = () => {
  const [appointments, setAppointments] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    today: 0,
    tomorrow: 0,
    thisWeek: 0,
    total: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .not('procedure_date', 'is', null)
        .order('procedure_date', { ascending: true });

      if (error) {
        console.error('Error fetching appointments:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las citas",
          variant: "destructive",
        });
      } else {
        setAppointments(data || []);
        calculateStats(data || []);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (appointments: Patient[]) => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const tomorrowStart = startOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    const tomorrowEnd = endOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    const weekEnd = endOfDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));

    const stats = {
      today: 0,
      tomorrow: 0,
      thisWeek: 0,
      total: appointments.length
    };

    appointments.forEach(appointment => {
      const appointmentDate = parseISO(appointment.procedure_date);
      
      if (appointmentDate >= todayStart && appointmentDate <= todayEnd) {
        stats.today++;
      }
      
      if (appointmentDate >= tomorrowStart && appointmentDate <= tomorrowEnd) {
        stats.tomorrow++;
      }
      
      if (appointmentDate >= todayStart && appointmentDate <= weekEnd) {
        stats.thisWeek++;
      }
    });

    setStats(stats);
  };

  const getDateLabel = (date: string) => {
    const appointmentDate = parseISO(date);
    
    if (isToday(appointmentDate)) {
      return { label: 'Hoy', variant: 'default' as const };
    } else if (isTomorrow(appointmentDate)) {
      return { label: 'Mañana', variant: 'secondary' as const };
    } else if (isYesterday(appointmentDate)) {
      return { label: 'Ayer', variant: 'outline' as const };
    } else {
      return { 
        label: format(appointmentDate, 'dd MMM', { locale: es }), 
        variant: 'outline' as const 
      };
    }
  };

  const groupAppointmentsByDate = (appointments: Patient[]) => {
    const groups: { [key: string]: Patient[] } = {};
    
    appointments.forEach(appointment => {
      const date = appointment.procedure_date.split('T')[0]; // Get just the date part
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(appointment);
    });
    
    return groups;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const groupedAppointments = groupAppointmentsByDate(appointments);
  const sortedDates = Object.keys(groupedAppointments).sort();

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.today}</p>
                <p className="text-xs text-muted-foreground">Hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.tomorrow}</p>
                <p className="text-xs text-muted-foreground">Mañana</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.thisWeek}</p>
                <p className="text-xs text-muted-foreground">Esta semana</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appointments List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendario de Citas
          </CardTitle>
          <CardDescription>
            Lista de todas las citas programadas ordenadas por fecha
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedDates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay citas programadas</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map(date => {
                const dateAppointments = groupedAppointments[date];
                const { label, variant } = getDateLabel(date);
                
                return (
                  <div key={date} className="space-y-3">
                    <div className="flex items-center gap-3 border-b pb-2">
                      <Badge variant={variant}>{label}</Badge>
                      <span className="text-sm font-medium">
                        {format(parseISO(date), 'EEEE, dd MMMM yyyy', { locale: es })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dateAppointments.length} cita{dateAppointments.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <div className="grid gap-3">
                      {dateAppointments.map(appointment => (
                        <Card key={appointment.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-medium">{appointment.name}</p>
                              <p className="text-sm text-muted-foreground">{appointment.email}</p>
                              {appointment.phone && (
                                <p className="text-sm text-muted-foreground">{appointment.phone}</p>
                              )}
                            </div>
                            <div className="text-right space-y-1">
                              {appointment.procedure && (
                                <Badge variant="secondary" className="text-xs">
                                  {appointment.procedure}
                                </Badge>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(appointment.procedure_date), 'HH:mm', { locale: es })}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};