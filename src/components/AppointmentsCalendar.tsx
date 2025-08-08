import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Loader2, Users, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isToday, isTomorrow, isYesterday, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addWeeks, addMonths, addYears, subWeeks, subMonths, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Patient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  procedure?: string;
  procedure_date: string;
  created_at: string;
}

type ViewMode = 'month' | 'week' | 'year';

export const AppointmentsCalendar = () => {
  const [appointments, setAppointments] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
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

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(appointment => 
      isSameDay(parseISO(appointment.procedure_date), date)
    );
  };

  const getDatesWithAppointments = () => {
    return appointments.map(appointment => parseISO(appointment.procedure_date.split('T')[0]));
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else if (viewMode === 'month') {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else if (viewMode === 'year') {
      setCurrentDate(direction === 'next' ? addYears(currentDate, 1) : subYears(currentDate, 1));
    }
  };

  const getDateRangeLabel = () => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { locale: es });
      const end = endOfWeek(currentDate, { locale: es });
      return `${format(start, 'dd MMM', { locale: es })} - ${format(end, 'dd MMM yyyy', { locale: es })}`;
    } else if (viewMode === 'month') {
      return format(currentDate, 'MMMM yyyy', { locale: es });
    } else {
      return format(currentDate, 'yyyy', { locale: es });
    }
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

  const selectedDateAppointments = selectedDate ? getAppointmentsForDate(selectedDate) : [];
  const datesWithAppointments = getDatesWithAppointments();

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
              <CalendarIcon className="h-4 w-4 text-blue-500" />
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
              <CalendarIcon className="h-4 w-4 text-green-500" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar View */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Calendario de Citas
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                >
                  Semana
                </Button>
                <Button
                  variant={viewMode === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('month')}
                >
                  Mes
                </Button>
                <Button
                  variant={viewMode === 'year' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('year')}
                >
                  Año
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <CardDescription>
                Selecciona una fecha para ver las citas programadas
              </CardDescription>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateDate('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[150px] text-center">
                  {getDateRangeLabel()}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateDate('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={currentDate}
              onMonthChange={setCurrentDate}
              locale={es}
              className={cn("rounded-md border p-3 pointer-events-auto")}
              modifiers={{
                hasAppointments: datesWithAppointments,
              }}
              modifiersClassNames={{
                hasAppointments: "bg-primary text-primary-foreground font-bold hover:bg-primary/90",
              }}
            />
          </CardContent>
        </Card>

        {/* Selected Date Appointments */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate ? (
                <>Citas para {format(selectedDate, 'EEEE, dd MMMM yyyy', { locale: es })}</>
              ) : (
                'Selecciona una fecha'
              )}
            </CardTitle>
            <CardDescription>
              {selectedDateAppointments.length} cita{selectedDateAppointments.length !== 1 ? 's' : ''} programada{selectedDateAppointments.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDateAppointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay citas programadas para esta fecha</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDateAppointments.map(appointment => (
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};