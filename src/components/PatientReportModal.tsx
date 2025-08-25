import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Calendar, 
  Phone, 
  Mail, 
  FileText, 
  MessageSquare, 
  Stethoscope,
  CheckCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Patient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dni: string;
  procedure?: string;
  procedure_date?: string;
  birth_date?: string;
  token: string;
}

interface PatientResponse {
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  has_allergies?: boolean;
  allergies?: string;
  current_medications?: string;
  medical_history?: string;
  previous_surgeries?: string;
  family_history?: string;
  smoking?: boolean;
  alcohol?: boolean;
  exercise?: string;
  diet?: string;
  sleep_hours?: number;
  stress_level?: number;
  additional_concerns?: string;
}

interface Conversation {
  role: string;
  content: string;
  created_at: string;
}

interface Recommendation {
  category: string;
  title: string;
  description: string;
  priority: string;
  created_at: string;
}

interface Consent {
  consent_type: string;
  accepted: boolean;
  accepted_at?: string;
  signature_data?: string;
}

interface PatientReportModalProps {
  patient: Patient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PatientReportModal: React.FC<PatientReportModalProps> = ({
  patient,
  open,
  onOpenChange
}) => {
  const [loading, setLoading] = useState(false);
  const [patientResponse, setPatientResponse] = useState<PatientResponse | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (patient && open) {
      fetchPatientReport();
    }
  }, [patient, open]);

  const fetchPatientReport = async () => {
    if (!patient) return;

    setLoading(true);
    try {
      // Get patient responses
      const { data: responseData } = await supabase
        .rpc('get_patient_responses_by_token', { patient_token: patient.token });
      
      if (responseData && responseData.length > 0) {
        setPatientResponse(responseData[0]);
      }

      // Get conversations
      const { data: conversationData } = await supabase
        .rpc('get_patient_conversations_by_token', { patient_token: patient.token });
      
      setConversations(conversationData || []);

      // Get recommendations
      const { data: recommendationData } = await supabase
        .rpc('get_patient_recommendations_by_token', { patient_token: patient.token });
      
      setRecommendations(recommendationData || []);

      // Get consents
      const { data: consentData } = await supabase
        .rpc('get_patient_consents_by_token', { patient_token: patient.token });
      
      setConsents(consentData || []);

    } catch (error) {
      console.error('Error fetching patient report:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el informe del paciente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'alto':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'medio':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'bajo':
        return <CheckCircle className="h-4 w-4 text-success" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'alto':
        return 'destructive';
      case 'medio':
        return 'secondary';
      case 'bajo':
        return 'default';
      default:
        return 'outline';
    }
  };

  if (!patient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Informe del Paciente
          </DialogTitle>
          <DialogDescription>
            Informe completo de la evaluación pre-anestésica
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 pr-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                {/* Patient Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Información del Paciente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="font-medium">Nombre</p>
                        <p className="text-muted-foreground">{patient.name}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium">DNI</p>
                        <p className="text-muted-foreground">{patient.dni}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </p>
                        <p className="text-muted-foreground">{patient.email}</p>
                      </div>
                      {patient.phone && (
                        <div className="space-y-2">
                          <p className="font-medium flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Teléfono
                          </p>
                          <p className="text-muted-foreground">{patient.phone}</p>
                        </div>
                      )}
                      {patient.birth_date && (
                        <div className="space-y-2">
                          <p className="font-medium flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Fecha de Nacimiento
                          </p>
                          <p className="text-muted-foreground">
                            {format(new Date(patient.birth_date), "PPP", { locale: es })}
                          </p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="font-medium">Procedimiento</p>
                        <Badge variant="outline">
                          {patient.procedure || 'No especificado'}
                        </Badge>
                      </div>
                      {patient.procedure_date && (
                        <div className="space-y-2">
                          <p className="font-medium">Fecha de Cirugía</p>
                          <p className="text-muted-foreground">
                            {format(new Date(patient.procedure_date), "PPP", { locale: es })}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Patient Responses */}
                {patientResponse && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Información Médica
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Emergency Contact */}
                      {patientResponse.emergency_contact_name && (
                        <div>
                          <h4 className="font-semibold mb-3 border-b pb-2">Contacto de Emergencia</h4>
                          <div className="space-y-2">
                            <p><span className="font-medium">Nombre:</span> {patientResponse.emergency_contact_name}</p>
                            {patientResponse.emergency_contact_phone && (
                              <p><span className="font-medium">Teléfono:</span> {patientResponse.emergency_contact_phone}</p>
                            )}
                            {patientResponse.emergency_contact_relationship && (
                              <p><span className="font-medium">Relación:</span> {patientResponse.emergency_contact_relationship}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Medical Information */}
                      <div>
                        <h4 className="font-semibold mb-3 border-b pb-2">Historia Médica</h4>
                        <div className="space-y-2">
                          <p>
                            <span className="font-medium">Alergias:</span>{' '}
                            {patientResponse.has_allergies ? (
                              <span className="text-destructive">
                                Sí - {patientResponse.allergies || 'No especificadas'}
                              </span>
                            ) : (
                              <span className="text-success">No</span>
                            )}
                          </p>
                          {patientResponse.current_medications && (
                            <p><span className="font-medium">Medicamentos actuales:</span> {patientResponse.current_medications}</p>
                          )}
                          {patientResponse.medical_history && (
                            <p><span className="font-medium">Historia médica:</span> {patientResponse.medical_history}</p>
                          )}
                          {patientResponse.previous_surgeries && (
                            <p><span className="font-medium">Cirugías previas:</span> {patientResponse.previous_surgeries}</p>
                          )}
                          {patientResponse.family_history && (
                            <p><span className="font-medium">Historia familiar:</span> {patientResponse.family_history}</p>
                          )}
                        </div>
                      </div>

                      {/* Lifestyle */}
                      <div>
                        <h4 className="font-semibold mb-3 border-b pb-2">Estilo de Vida</h4>
                        <div className="space-y-2">
                          <p>
                            <span className="font-medium">Fumador:</span>{' '}
                            <span className={patientResponse.smoking ? "text-destructive" : "text-success"}>
                              {patientResponse.smoking ? 'Sí' : 'No'}
                            </span>
                          </p>
                          <p>
                            <span className="font-medium">Alcohol:</span>{' '}
                            <span className={patientResponse.alcohol ? "text-warning" : "text-success"}>
                              {patientResponse.alcohol ? 'Sí' : 'No'}
                            </span>
                          </p>
                          {patientResponse.exercise && (
                            <p><span className="font-medium">Ejercicio:</span> {patientResponse.exercise}</p>
                          )}
                          {patientResponse.diet && (
                            <p><span className="font-medium">Dieta:</span> {patientResponse.diet}</p>
                          )}
                          {patientResponse.sleep_hours && (
                            <p><span className="font-medium">Horas de sueño:</span> {patientResponse.sleep_hours} horas</p>
                          )}
                          {patientResponse.stress_level !== undefined && (
                            <p><span className="font-medium">Nivel de estrés:</span> {patientResponse.stress_level}/10</p>
                          )}
                          {patientResponse.additional_concerns && (
                            <p><span className="font-medium">Preocupaciones adicionales:</span> {patientResponse.additional_concerns}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recommendations */}
                {recommendations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Stethoscope className="h-5 w-5" />
                        Recomendaciones Médicas
                      </CardTitle>
                      <CardDescription>
                        Recomendaciones generadas por el sistema de IA
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {recommendations.map((rec, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{rec.category}</Badge>
                                <Badge variant={getPriorityColor(rec.priority) as any}>
                                  {getPriorityIcon(rec.priority)}
                                  {rec.priority}
                                </Badge>
                              </div>
                            </div>
                            <h4 className="font-semibold mb-2">{rec.title}</h4>
                            <p className="text-muted-foreground text-sm">{rec.description}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Conversations */}
                {conversations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Conversación con IA
                      </CardTitle>
                      <CardDescription>
                        Historial de la consulta con el asistente médico
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 max-h-60 overflow-y-auto">
                        {conversations.map((conv, index) => (
                          <div key={index} className={`flex ${conv.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg p-3 ${
                              conv.role === 'user' 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted'
                            }`}>
                              <p className="text-sm">{conv.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Consents */}
                {consents.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Consentimientos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {consents.map((consent, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded">
                            <span className="font-medium">{consent.consent_type}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant={consent.accepted ? "default" : "destructive"}>
                                {consent.accepted ? 'Aceptado' : 'Rechazado'}
                              </Badge>
                              {consent.accepted_at && (
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(consent.accepted_at), "PPp", { locale: es })}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PatientReportModal;