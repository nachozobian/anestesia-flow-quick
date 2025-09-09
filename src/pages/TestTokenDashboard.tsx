import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, MessageCircle, FileText, Shield, CheckCircle2 } from "lucide-react";
import DataProcessingConsent from "@/components/DataProcessingConsent";
import PatientChat from "@/components/PatientChat";
import RecommendationsView from "@/components/RecommendationsView";
import InformedConsent from "@/components/InformedConsent";
import { supabase } from "@/integrations/supabase/client";

enum Step {
  DATA_CONSENT = "data_consent",
  CHAT = "chat", 
  RECOMMENDATIONS = "recommendations",
  CONSENT = "consent",
  COMPLETED = "completed"
}

interface Patient {
  id: string;
  name: string;
  dni: string;
  email: string;
  procedure?: string;
  procedure_date?: string;
}

export default function TestTokenDashboard() {
  const [currentStep, setCurrentStep] = useState<Step>(Step.DATA_CONSENT);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentToken, setCurrentToken] = useState<string>('test-token');
  const { toast } = useToast();

  // Usar un paciente fijo para test-token
  useEffect(() => {
    const loadTestPatient = async () => {
      try {
        // Buscar o crear paciente de prueba
        let testToken = 'test-token';
        const { data: existingPatients } = await supabase
          .from('patients')
          .select('*')
          .limit(1);

        let patient = null;
        
        if (existingPatients && existingPatients.length > 0) {
          // Usar el primer paciente existente como paciente de prueba
          patient = existingPatients[0];
          testToken = patient.token;
          console.log('Using existing patient as test patient:', patient.name, testToken);
        } else {
          // Intentar buscar paciente test-token
          const { data: testPatient } = await supabase
            .from('patients')
            .select('*')
            .eq('token', 'test-token')
            .single();

          if (testPatient) {
            patient = testPatient;
          } else {
            // Crear paciente de prueba si no existe ninguno
            const { data: newPatient, error } = await supabase
              .from('patients')
              .insert({
                token: 'test-token',
                name: 'Paciente de Prueba',
                dni: '12345678',
                email: 'test@example.com',
                procedure: 'Evaluación Pre-anestésica',
                procedure_date: new Date().toISOString().split('T')[0]
              })
              .select()
              .single();

            if (error) throw error;
            patient = newPatient;
          }
        }

        setPatient(patient);
        setCurrentToken(testToken);

        // Verificar el progreso del paciente usando función backend con el token correcto
        await checkPatientProgressWithValidation(testToken);
      } catch (error) {
        console.error('Error loading test patient:', error);
        toast({
          title: "Error",
          description: "No se pudo cargar la información del paciente",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadTestPatient();
  }, [toast]);

  const checkPatientProgressWithValidation = async (patientToken: string) => {
    try {
      // Usar función backend para obtener el paso actual
      const { data: currentStepResult, error } = await supabase
        .rpc('get_current_step_by_token', { patient_token: patientToken });

      if (error) {
        console.error('Error getting current step:', error);
        return;
      }

      // Mapear el resultado backend al enum del frontend
      switch (currentStepResult) {
        case 'completed':
          setCurrentStep(Step.COMPLETED);
          break;
        case 'consent':
          setCurrentStep(Step.CONSENT);
          break;
        case 'recommendations':
          setCurrentStep(Step.RECOMMENDATIONS);
          break;
        case 'chat':
          setCurrentStep(Step.CHAT);
          break;
        case 'data_consent':
        default:
          setCurrentStep(Step.DATA_CONSENT);
          break;
      }
    } catch (error) {
      console.error('Error checking progress:', error);
    }
  };

  const validateAndProceedToStep = async (targetStep: string) => {
    try {
      // Validar acceso al paso usando función backend
      const { data: validation, error } = await supabase
        .rpc('validate_step_access', { 
          patient_token: currentToken, 
          target_step: targetStep 
        });

      if (error) {
        console.error('Error validating step access:', error);
        toast({
          title: "Error de validación",
          description: "No se pudo validar el acceso al paso",
          variant: "destructive",
        });
        return false;
      }

      const validationResult = validation as { allowed: boolean; reason?: string };

      if (!validationResult.allowed) {
        toast({
          title: "Acceso denegado",
          description: validationResult.reason || "No se puede acceder a este paso",
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating step:', error);
      return false;
    }
  };

  const markStepCompleted = async (stepName: string) => {
    try {
      const { data: success, error } = await supabase
        .rpc('mark_step_completed', { 
          patient_token: currentToken, 
          step_name: stepName 
        });

      if (error || !success) {
        console.error('Error marking step completed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error marking step completed:', error);
      return false;
    }
  };

  const getStepProgress = () => {
    const steps = [Step.DATA_CONSENT, Step.CHAT, Step.RECOMMENDATIONS, Step.CONSENT, Step.COMPLETED];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const getStepIcon = (step: Step) => {
    switch (step) {
      case Step.DATA_CONSENT:
        return Shield;
      case Step.CHAT:
        return MessageCircle;
      case Step.RECOMMENDATIONS:
        return FileText;
      case Step.CONSENT:
        return CheckCircle;
      case Step.COMPLETED:
        return CheckCircle2;
      default:
        return Shield;
    }
  };

  const getStepLabel = (step: Step) => {
    switch (step) {
      case Step.DATA_CONSENT:
        return "Consentimiento de Datos";
      case Step.CHAT:
        return "Consulta con IA";
      case Step.RECOMMENDATIONS:
        return "Recomendaciones";
      case Step.CONSENT:
        return "Consentimiento Informado";
      case Step.COMPLETED:
        return "Completado";
      default:
        return "";
    }
  };

  const isStepCompleted = (step: Step) => {
    const steps = [Step.DATA_CONSENT, Step.CHAT, Step.RECOMMENDATIONS, Step.CONSENT, Step.COMPLETED];
    const targetIndex = steps.indexOf(step);
    const currentIndex = steps.indexOf(currentStep);
    return currentIndex > targetIndex;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando evaluación...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600">No se pudo encontrar la información del paciente.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === Step.COMPLETED) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center">
        <Card className="max-w-2xl mx-auto shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Evaluación Completada
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Su evaluación pre-anestésica ha sido completada exitosamente.
            </p>
            <p className="text-sm text-gray-500">
              Hemos registrado toda la información necesaria para su procedimiento.
              El equipo médico revisará sus respuestas antes de la cirugía.
            </p>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Proceso Finalizado e Inmutable
            </Badge>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                ⚠️ Este proceso ha sido marcado como completado y no puede ser reiniciado o modificado.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Evaluación Pre-anestésica</h1>
              <p className="text-gray-600">Paciente: {patient.name}</p>
            </div>
            <Badge variant="secondary">
              {getStepLabel(currentStep)}
            </Badge>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Progreso</span>
              <span>{Math.round(getStepProgress())}%</span>
            </div>
            <Progress value={getStepProgress()} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="mt-6 flex justify-between">
            {[Step.DATA_CONSENT, Step.CHAT, Step.RECOMMENDATIONS, Step.CONSENT, Step.COMPLETED].map((step) => {
              const Icon = getStepIcon(step);
              const isCompleted = isStepCompleted(step);
              const isCurrent = currentStep === step;
              
              return (
                <div key={step} className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      isCompleted
                        ? "bg-green-100 text-green-600"
                        : isCurrent
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="mt-2 text-xs text-gray-500 text-center max-w-20">
                    {getStepLabel(step)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentStep === Step.DATA_CONSENT && (
          <DataProcessingConsent 
            onAccept={async () => {
              if (await validateAndProceedToStep('chat')) {
                await markStepCompleted('data_consent');
                setCurrentStep(Step.CHAT);
              }
            }} 
          />
        )}

        {currentStep === Step.CHAT && (
          <PatientChat
            patientId={patient.id}
            onComplete={async () => {
              if (await validateAndProceedToStep('recommendations')) {
                await markStepCompleted('chat');
                setCurrentStep(Step.RECOMMENDATIONS);
              }
            }}
          />
        )}

        {currentStep === Step.RECOMMENDATIONS && (
          <RecommendationsView
            patientId={patient.id}
            onContinue={async () => {
              if (await validateAndProceedToStep('consent')) {
                await markStepCompleted('recommendations');
                setCurrentStep(Step.CONSENT);
              }
            }}
          />
        )}

        {currentStep === Step.CONSENT && (
          <InformedConsent
            patientId={patient.id}
            onComplete={async () => {
              if (await validateAndProceedToStep('completed')) {
                await markStepCompleted('consent');
                await markStepCompleted('completed');
                setCurrentStep(Step.COMPLETED);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}