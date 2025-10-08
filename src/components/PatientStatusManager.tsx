import React, { useState, useEffect } from 'react';
import { CalendarIcon, Filter, Users, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Download, FileText, Shield, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import { EditablePatientReport } from './EditablePatientReport';

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
  has_infection?: boolean;
  infection_detected_at?: string;
  infection_keywords?: string;
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
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [patientReports, setPatientReports] = useState<{[key: string]: any}>({});
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
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

  const updatePatientStatus = async (patientId: string, newStatus: 'Pendientes' | 'En progreso' | 'Completado' | 'Validado') => {
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


  const sendSMSManually = async (patient: Patient) => {
    if (!canEditStatus) {
      toast({
        title: "Sin permisos",
        description: "No tienes permisos para enviar SMS",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error: smsError } = await supabase.functions.invoke('send-appointment-sms', {
        body: {
          patientId: patient.id,
          appointmentDate: patient.procedure_date,
          procedure: patient.procedure
        }
      });

      if (smsError) {
        console.error('Error sending SMS:', smsError);
        toast({
          title: "Error",
          description: "Error al enviar SMS",
          variant: "destructive",
        });
      } else {
        toast({
          title: "SMS Enviado",
          description: `SMS enviado exitosamente a ${patient.name}`,
        });
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast({
        title: "Error",
        description: "Error al enviar SMS",
        variant: "destructive",
      });
    }
  };

  const togglePatientExpansion = async (patient: Patient) => {
    if (patient.status !== 'Completado' && patient.status !== 'Validado') return;

    const newExpanded = new Set(expandedPatients);
    if (newExpanded.has(patient.id)) {
      newExpanded.delete(patient.id);
    } else {
      newExpanded.add(patient.id);
      // Load patient report data if not already loaded
      if (!patientReports[patient.id]) {
        await loadPatientReport(patient);
      }
    }
    setExpandedPatients(newExpanded);
  };

  const loadPatientReport = async (patient: Patient) => {
    try {
      // Get patient responses
      const { data: responseData } = await supabase
        .rpc('get_patient_responses_by_token', { patient_token: patient.token });
      
      // Get conversations
      const { data: conversationData } = await supabase
        .rpc('get_patient_conversations_by_token', { patient_token: patient.token });
      
      // Get recommendations
      const { data: recommendationData } = await supabase
        .rpc('get_patient_recommendations_by_token', { patient_token: patient.token });
      
      // Get consents
      const { data: consentData } = await supabase
        .rpc('get_patient_consents_by_token', { patient_token: patient.token });

      // Get conversation summary
      const { data: summaryData } = await supabase
        .rpc('get_conversation_summary_by_token', { patient_token: patient.token });

      setPatientReports(prev => ({
        ...prev,
        [patient.id]: {
          responses: responseData?.[0] || null,
          conversations: conversationData || [],
          recommendations: recommendationData || [],
          consents: consentData || [],
          summary: summaryData?.[0] || null
        }
      }));
    } catch (error) {
      console.error('Error loading patient report:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el informe del paciente",
        variant: "destructive",
      });
    }
  };

  const generatePDFWithData = async (patient: Patient, editedData?: any) => {
    const report = editedData || patientReports[patient.id];
    const summary = report?.summary || null;
    
    if (!report) {
      toast({
        title: "Error",
        description: "No se pudo cargar la información del paciente",
        variant: "destructive",
      });
      return;
    }

    try {
      
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.width;
      const margin = 20;
      let yPosition = 30;

      // Helper function to add text with word wrap
      const addText = (text: string, fontSize = 10, isBold = false) => {
        try {
          pdf.setFontSize(fontSize);
          pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
          const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
          pdf.text(lines, margin, yPosition);
          yPosition += lines.length * (fontSize * 0.5) + 5;
          
          // Check if we need a new page
          if (yPosition > pdf.internal.pageSize.height - 30) {
            pdf.addPage();
            yPosition = 30;
          }
        } catch (textError) {
          console.error('Error adding text to PDF:', textError);
          // Continue without this text rather than failing completely
        }
      };

      // Title
      const patientName = editedData ? editedData.name : patient.name;
      addText(`INFORME PREANESTÉSICO - ${patientName}`, 16, true);
      yPosition += 10;

      // Patient Information (use edited data if available)
      addText('INFORMACIÓN DEL PACIENTE', 14, true);
      addText(`Nombre: ${editedData?.name || patient.name}`);
      addText(`DNI: ${editedData?.dni || patient.dni}`);
      addText(`Email: ${editedData?.email || patient.email}`);
      if (editedData?.phone || patient.phone) addText(`Teléfono: ${editedData?.phone || patient.phone}`);
      if (editedData?.birth_date || patient.birth_date) addText(`Fecha de Nacimiento: ${format(new Date(editedData?.birth_date || patient.birth_date), "PPP", { locale: es })}`);
      addText(`Procedimiento: ${editedData?.procedure || patient.procedure || 'No especificado'}`);
      if (editedData?.procedure_date || patient.procedure_date) addText(`Fecha de Cirugía: ${format(new Date(editedData?.procedure_date || patient.procedure_date), "PPP", { locale: es })}`);
      yPosition += 10;

      // Medical Information (use edited data if available)
      const responses = editedData || (report && report.responses);
      if (responses) {
        addText('INFORMACIÓN MÉDICA', 14, true);
        
        // Emergency Contact
        if (responses.emergency_contact_name) {
          addText('Contacto de Emergencia:', 12, true);
          addText(`Nombre: ${responses.emergency_contact_name}`);
          if (responses.emergency_contact_phone) addText(`Teléfono: ${responses.emergency_contact_phone}`);
          if (responses.emergency_contact_relationship) addText(`Relación: ${responses.emergency_contact_relationship}`);
          yPosition += 5;
        }

      }

      // AI Generated Conversation Summary (priority placement)
      if (summary) {
        addText('RESUMEN DE EVALUACIÓN PREANESTÉSICA', 14, true);
        addText(`Generado por: ${summary.generated_by} el ${format(new Date(summary.created_at), "PPp", { locale: es })}`, 9);
        yPosition += 5;
        addText(summary.summary, 10);
        yPosition += 10;
      }

      // Recommendations (use edited data if available)
      const recommendations = editedData?.recommendations || report.recommendations;
      if (recommendations && recommendations.length > 0) {
        addText('RECOMENDACIONES MÉDICAS', 14, true);
        recommendations.forEach((rec: any, index: number) => {
          addText(`${index + 1}. ${rec.title} (${rec.category} - ${rec.priority})`, 11, true);
          addText(rec.description);
          yPosition += 3;
        });
        yPosition += 10;
      }

      // Conversations (always use original data for conversations)
      const conversations = report.conversations || [];
      if (conversations.length > 0) {
        addText('RESUMEN DE CONVERSACIONES CON IA', 14, true);
        addText(`Total de mensajes intercambiados: ${conversations.length}`, 11, true);
        yPosition += 5;
        
        conversations.forEach((conv: any, index: number) => {
          const role = conv.role === 'user' ? 'Paciente' : 'IA Médica';
          const timestamp = conv.created_at ? format(new Date(conv.created_at), "PPp", { locale: es }) : '';
          addText(`[${timestamp}] ${role}:`, 10, true);
          addText(conv.content, 10);
          yPosition += 3;
        });
        yPosition += 10;
      }

      // Consents
      
      if (report.consents && report.consents.length > 0) {
        const preAnestheticConsent = report.consents.find((c: any) => c.consent_type === 'pre_anesthetic');
        
        if (preAnestheticConsent) {
          // Add new page for consent
          pdf.addPage();
          yPosition = 30;
          
          addText('CONSENTIMIENTO INFORMADO PARA ANESTESIA', 16, true);
          yPosition += 10;
          
          // Patient info section
          addText(`Paciente: ${patient.name}`, 12, true);
          addText(`DNI: ${patient.dni}`);
          addText(`Procedimiento: ${patient.procedure || 'No especificado'}`);
          if (patient.procedure_date) {
            addText(`Fecha del Procedimiento: ${format(new Date(patient.procedure_date), "PPP", { locale: es })}`);
          }
          yPosition += 10;
          
          // Consent content
          const consentContent = `
Estimado/a ${patient.name},

Este documento tiene como objetivo informarle sobre los riesgos, beneficios y alternativas relacionados con la anestesia que recibirá durante su procedimiento quirúrgico.

INFORMACIÓN SOBRE LA ANESTESIA:
La anestesia es un conjunto de técnicas que permiten realizar procedimientos quirúrgicos sin dolor, utilizando medicamentos que bloquean la sensación de dolor y, en algunos casos, producen pérdida de consciencia.

TIPOS DE ANESTESIA:
1. Anestesia General: Pérdida completa de la consciencia
2. Anestesia Regional: Bloqueo de una región específica del cuerpo
3. Anestesia Local: Bloqueo de un área pequeña específica
4. Sedación: Relajación y reducción de la ansiedad

RIESGOS Y COMPLICACIONES:
Como cualquier procedimiento médico, la anestesia conlleva ciertos riesgos, que pueden incluir:

RIESGOS COMUNES (frecuencia: 1 en 100 a 1 en 1000):
- Náuseas y vómitos postoperatorios
- Dolor de garganta
- Somnolencia prolongada
- Temblores
- Dolor de cabeza

RIESGOS POCO FRECUENTES (frecuencia: 1 en 1000 a 1 en 10000):
- Reacciones alérgicas a medicamentos
- Problemas respiratorios temporales
- Alteraciones de la presión arterial
- Infección en el sitio de punción (anestesia regional)

RIESGOS RAROS (frecuencia: menor a 1 en 10000):
- Reacciones alérgicas graves
- Complicaciones cardiovasculares graves
- Daño neurológico permanente
- Despertar durante la anestesia general
- Muerte relacionada con la anestesia

FACTORES QUE PUEDEN AUMENTAR LOS RIESGOS:
- Enfermedades cardíacas o pulmonares preexistentes
- Diabetes mal controlada
- Obesidad
- Consumo de alcohol o drogas
- Reacciones previas a anestésicos
- Ciertos medicamentos

PREPARACIÓN PRE-ANESTÉSICA:
- Seguir las instrucciones de ayuno
- Informar sobre todos los medicamentos que toma
- Informar sobre alergias conocidas
- Seguir las recomendaciones médicas específicas

CUIDADOS POST-ANESTÉSICOS:
- Será monitoreado/a hasta su recuperación completa
- Puede experimentar efectos residuales temporales
- Siga las instrucciones del equipo médico
- Reporte cualquier síntoma inusual

ALTERNATIVAS:
Las alternativas a la anestesia son limitadas y dependen del tipo de procedimiento. En algunos casos, pueden considerarse técnicas de anestesia local o sedación mínima.

CONSENTIMIENTO:
He leído y comprendido la información proporcionada sobre la anestesia. He tenido la oportunidad de hacer preguntas, las cuales han sido respondidas satisfactoriamente. Entiendo los riesgos, beneficios y alternativas de la anestesia.

Autorizo al equipo médico a administrar la anestesia que consideren más apropiada para mi procedimiento.

Comprendo que ningún procedimiento médico está libre de riesgos y que no se me puede garantizar un resultado específico.`;

          addText(consentContent, 9);
          yPosition += 10;
          
          // Consent status
          const status = preAnestheticConsent.accepted ? 'ACEPTADO' : 'PENDIENTE';
          const acceptanceDate = preAnestheticConsent.accepted_at ? 
            format(new Date(preAnestheticConsent.accepted_at), "PPp", { locale: es }) : '';
          
          addText(`Estado del Consentimiento: ${status}`, 12, true);
          if (acceptanceDate) {
            addText(`Fecha de Aceptación: ${acceptanceDate}`, 10);
          }
          yPosition += 15;
          
          // Signature section
          addText('FIRMA DEL PACIENTE:', 12, true);
          yPosition += 5;
          
          if (preAnestheticConsent.signature_data) {
            try {
              // Add signature image to PDF
              const signatureImg = preAnestheticConsent.signature_data;
              const imgWidth = 80;
              const imgHeight = 40;
              
              pdf.addImage(signatureImg, 'PNG', margin, yPosition, imgWidth, imgHeight);
              yPosition += imgHeight + 10;
              
              addText(`Firmado digitalmente el ${acceptanceDate}`, 8);
            } catch (error) {
              console.error('Error adding signature to PDF:', error);
              // Draw signature box if image fails
              pdf.rect(margin, yPosition, 80, 40);
              pdf.text('Firma Digital Registrada', margin + 5, yPosition + 20);
              yPosition += 50;
            }
          } else {
            // Draw empty signature box
            pdf.rect(margin, yPosition, 80, 40);
            pdf.text('Firma:', margin, yPosition - 3);
            yPosition += 50;
            
            addText('Fecha: _______________', 10);
            yPosition += 10;
          }
        }
      } else {
        // Add consent section even when no consents exist
        pdf.addPage();
        yPosition = 30;
        
        addText('CONSENTIMIENTO INFORMADO PARA ANESTESIA', 16, true);
        yPosition += 10;
        
        // Patient info section
        addText(`Paciente: ${patient.name}`, 12, true);
        addText(`DNI: ${patient.dni}`);
        addText(`Procedimiento: ${patient.procedure || 'No especificado'}`);
        if (patient.procedure_date) {
          addText(`Fecha del Procedimiento: ${format(new Date(patient.procedure_date), "PPP", { locale: es })}`);
        }
        yPosition += 20;
        
        addText('Estado del Consentimiento: PENDIENTE', 12, true);
        yPosition += 15;
        
        // Draw empty signature box
        addText('FIRMA DEL PACIENTE:', 12, true);
        yPosition += 5;
        pdf.rect(margin, yPosition, 80, 40);
        pdf.text('Firma:', margin, yPosition - 3);
        yPosition += 50;
        
        addText('Fecha: _______________', 10);
        yPosition += 10;
      }
      
      // Summary of other consents (only if consents exist)
      if (report.consents && report.consents.length > 0) {
        const preAnestheticConsent = report.consents.find((c: any) => c.consent_type === 'pre_anesthetic');
        if (report.consents.length > 1 || !preAnestheticConsent) {
          yPosition += 10;
          addText('RESUMEN DE CONSENTIMIENTOS', 12, true);
          report.consents.forEach((consent: any) => {
            const status = consent.accepted ? 'Aceptado' : 'Rechazado';
            const date = consent.accepted_at ? format(new Date(consent.accepted_at), "PPp", { locale: es }) : '';
            addText(`${consent.consent_type}: ${status} ${date ? `- ${date}` : ''}`, 9);
          });
        }
      }

      // Footer
      pdf.setFontSize(8);
      pdf.text(`Generado el ${format(new Date(), "PPp", { locale: es })}`, margin, pdf.internal.pageSize.height - 10);

      // Save PDF
      const fileName = editedData ? editedData.name : patient.name;
      const sanitizedFileName = (fileName || 'paciente').replace(/\s+/g, '_');
      pdf.save(`informe_${sanitizedFileName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

      toast({
        title: "PDF Generado",
        description: "El informe se ha descargado exitosamente",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    }
  };

  const generatePDF = (patient: Patient) => {
    generatePDFWithData(patient);
  };

  const handleSaveAndGeneratePDF = async (editedData: any) => {
    if (editingPatient) {
      // Actualiza el estado local para reflejar los cambios editados
      setPatientReports(prev => ({
        ...prev,
        [editingPatient.id]: {
          ...prev[editingPatient.id],
          ...editedData
        }
      }));

      // Guardar los cambios en el backend (Supabase)
      try {
        // Actualiza los datos principales del paciente
        await supabase
          .from('patients')
          .update({
            name: editedData.name,
            dni: editedData.dni,
            email: editedData.email,
            phone: editedData.phone,
            birth_date: editedData.birth_date,
            procedure: editedData.procedure,
            procedure_date: editedData.procedure_date
          })
          .eq('id', editingPatient.id);

        // Actualiza las respuestas médicas si existen
        if (editedData.responses) {
          await supabase
            .from('patient_responses')
            .update(editedData.responses as any)
            .eq('patient_token', editingPatient.token);
        }

        // Actualiza recomendaciones si existen
        if (editedData.recommendations) {
          // Aquí podrías actualizar recomendaciones si tienes una tabla específica
          // await supabase.from('patient_recommendations').update(...)
        }
        // Puedes agregar más actualizaciones según tu modelo de datos
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudo guardar el informe en el backend',
          variant: 'destructive',
        });
      }

      generatePDFWithData(editingPatient, editedData);
      setEditingPatient(null);
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
      case 'Validado':
        return <Shield className="h-4 w-4" />;
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
      case 'Validado':
        return 'default'; // Verde - será estilizado con clases personalizadas
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
      validado: filteredPatients.filter(p => p.status === 'Validado').length,
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validados</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{counts.validado}</div>
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
                  <SelectItem value="Validado">Validado</SelectItem>
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
            Gestiona el estado de los pacientes y sus tratamientos. 
            Haz click en pacientes completados para ver su informe.
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
                    {canEditStatus && <TableHead>SMS</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => [
                      <TableRow 
                        key={patient.id}
                        className={(patient.status === 'Completado' || patient.status === 'Validado') ? 'cursor-pointer hover:bg-muted/50' : ''}
                        onClick={() => togglePatientExpansion(patient)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(patient.status === 'Completado' || patient.status === 'Validado') && (
                              expandedPatients.has(patient.id) ? 
                                <ChevronDown className="h-4 w-4" /> : 
                                <ChevronRight className="h-4 w-4" />
                            )}
                            <div>
                              <div className="font-medium">{patient.name}</div>
                              <div className="text-sm text-muted-foreground">{patient.email}</div>
                            </div>
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
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={getStatusVariant(patient.status)}
                              className={cn(
                                "flex items-center gap-1 w-fit",
                                patient.status === 'Validado' && "bg-green-100 text-green-800 border-green-300"
                              )}
                            >
                              {getStatusIcon(patient.status)}
                              {patient.status}
                            </Badge>
                            
                            {/* Infection Flag */}
                            {patient.has_infection && patient.status === 'Completado' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge 
                                      variant="destructive" 
                                      className="bg-red-100 text-red-800 border-red-300 cursor-help animate-pulse"
                                    >
                                      <Zap className="h-3 w-3 mr-1" />
                                      Infección
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="max-w-60">
                                      <p className="font-semibold mb-1">🦠 Proceso Infeccioso Detectado</p>
                                      <p className="text-xs mb-1">
                                        Detectado el {patient.infection_detected_at ? format(new Date(patient.infection_detected_at), "PPp", { locale: es }) : 'fecha no disponible'}
                                      </p>
                                      {patient.infection_keywords && (
                                        <p className="text-xs">
                                          <strong>Palabras clave:</strong> {patient.infection_keywords}
                                        </p>
                                      )}
                                      <p className="text-xs mt-1 text-yellow-600">
                                        ⚠️ Requiere evaluación médica urgente
                                      </p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        {canEditStatus && (
                          <TableCell>
                            <Select
                              value={patient.status}
                              onValueChange={(value: 'Pendientes' | 'En progreso' | 'Completado' | 'Validado') => 
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
                                <SelectItem value="Validado">Validado</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                        {canEditStatus && (
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                sendSMSManually(patient);
                              }}
                              disabled={!patient.procedure_date}
                            >
                              Enviar SMS
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                      
                      ,
                      
                      /* Collapsible Content */
                      (patient.status === 'Completado' || patient.status === 'Validado') && expandedPatients.has(patient.id) && (
                        <TableRow key={`${patient.id}-expanded`}>
                          <TableCell colSpan={canEditStatus ? 7 : 5} className="p-0">
                            <div className="p-4 bg-muted/30">
                              {patientReports[patient.id] ? (
                                <div className="space-y-4">
                                  <div className="flex justify-between items-center">
                                    <h4 className="font-semibold flex items-center gap-2">
                                      <FileText className="h-4 w-4" />
                                      Informe del Paciente
                                      {patient.status === 'Validado' && (
                                        <Badge className="bg-green-100 text-green-800 border-green-300">
                                          <Shield className="h-3 w-3 mr-1" />
                                          Validado
                                        </Badge>
                                      )}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                      {patient.status === 'Completado' && canEditStatus && (
                                        <Button
                                          onClick={() => setEditingPatient(patient)}
                                          size="sm"
                                          variant="default"
                                          className="flex items-center gap-2"
                                        >
                                          <Download className="h-4 w-4" />
                                          Ver/Editar Informe
                                        </Button>
                                      )}
                                      {patient.status === 'Validado' && (
                                        <Button
                                          onClick={() => {
                                            const report = patientReports[patient.id];
                                            if (report) {
                                              generatePDFWithData(patient, report);
                                            }
                                          }}
                                          size="sm"
                                          variant="outline"
                                          className="flex items-center gap-2"
                                        >
                                          <Download className="h-4 w-4" />
                                          Descargar PDF
                                        </Button>
                                      )}
                                     </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    {/* Medical Info */}
                                    {patientReports[patient.id].responses && (
                                      <div className="space-y-2">
                                        <h5 className="font-medium">Información Médica</h5>
                                        <div className="space-y-1 text-muted-foreground">
                                          <p>Alergias: {patientReports[patient.id].responses.has_allergies ? 'Sí' : 'No'}</p>
                                          <p>Fumador: {patientReports[patient.id].responses.smoking ? 'Sí' : 'No'}</p>
                                          <p>Alcohol: {patientReports[patient.id].responses.alcohol ? 'Sí' : 'No'}</p>
                                          {patientReports[patient.id].responses.sleep_hours && (
                                            <p>Horas de sueño: {patientReports[patient.id].responses.sleep_hours}h</p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Recommendations */}
                                    {patientReports[patient.id].recommendations.length > 0 && (
                                      <div className="space-y-2">
                                        <h5 className="font-medium">Recomendaciones ({patientReports[patient.id].recommendations.length})</h5>
                                        <div className="space-y-1 text-muted-foreground">
                                          {patientReports[patient.id].recommendations.slice(0, 3).map((rec: any, idx: number) => (
                                            <p key={idx} className="text-xs">• {rec.title}</p>
                                          ))}
                                          {patientReports[patient.id].recommendations.length > 3 && (
                                            <p className="text-xs">+ {patientReports[patient.id].recommendations.length - 3} más...</p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Conversation Summary */}
                                    {patientReports[patient.id].conversations.length > 0 && (
                                      <div className="space-y-2">
                                        <h5 className="font-medium">Conversación con IA</h5>
                                        <p className="text-muted-foreground text-xs">
                                          {patientReports[patient.id].conversations.length} mensajes intercambiados
                                        </p>
                                      </div>
                                    )}
                                    
                                    {/* Consents */}
                                    {patientReports[patient.id].consents.length > 0 && (
                                      <div className="space-y-2">
                                        <h5 className="font-medium">Consentimientos</h5>
                                        <div className="space-y-1">
                                          {patientReports[patient.id].consents.map((consent: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2">
                                              <Badge variant={consent.accepted ? "default" : "destructive"} className="text-xs">
                                                {consent.accepted ? 'Aceptado' : 'Rechazado'}
                                              </Badge>
                                              <span className="text-xs text-muted-foreground">{consent.consent_type}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center py-4">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                  <span className="ml-2 text-sm text-muted-foreground">Cargando informe...</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                  ].filter(Boolean))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editable Patient Report Dialog */}
      {editingPatient && (
        <EditablePatientReport
          isOpen={!!editingPatient}
          onClose={() => setEditingPatient(null)}
          patient={editingPatient}
          patientReport={patientReports[editingPatient.id]}
          onSaveAndGeneratePDF={handleSaveAndGeneratePDF}
        />
      )}
    </div>
  );
};

export default PatientStatusManager;