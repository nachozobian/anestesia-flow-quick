import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import DataProcessingConsent from '@/components/DataProcessingConsent';
import PatientChat from '@/components/PatientChat';
import RecommendationsView from '@/components/RecommendationsView';
import InformedConsent from '@/components/InformedConsent';
import { 
  CheckCircle, 
  Clock, 
  FileText, 
  MessageSquare, 
  Stethoscope,
  User,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

// Form schema
const formSchema = z.object({
  emergency_contact_name: z.string().min(1, "El nombre del contacto de emergencia es requerido"),
  emergency_contact_phone: z.string().min(1, "El teléfono del contacto de emergencia es requerido"),
  emergency_contact_relationship: z.string().min(1, "La relación con el contacto de emergencia es requerida"),
  has_allergies: z.boolean(),
  allergies: z.string().optional(),
  current_medications: z.string().optional(),
  medical_history: z.string().optional(),
  previous_surgeries: z.string().optional(),
  family_history: z.string().optional(),
  smoking: z.boolean(),
  alcohol: z.boolean(),
  exercise: z.string().optional(),
  diet: z.string().optional(),
  sleep_hours: z.coerce.number().min(0).max(24).optional(),
  stress_level: z.coerce.number().min(0).max(10).optional(),
  additional_concerns: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Patient {
  id: string;
  dni: string;
  name: string;
  email: string;
  phone?: string;
  birth_date?: string;
  procedure?: string;
  procedure_date?: string;
  token: string;
}

// Step enum
enum Step {
  FORM = 'form',
  DATA_CONSENT = 'data_consent',
  CHAT = 'chat', 
  RECOMMENDATIONS = 'recommendations',
  CONSENT = 'consent',
  COMPLETE = 'complete'
}

const EnhancedPatientDashboard = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(Step.FORM);
  const [isTestToken, setIsTestToken] = useState(false);
  const [hasResponse, setHasResponse] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      has_allergies: false,
      smoking: false,
      alcohol: false,
    }
  });

  useEffect(() => {
    if (token) {
      fetchPatientData();
    }
  }, [token]);

  const fetchPatientData = async () => {
    if (!token) return;

    try {
      // Fetch patient data
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('token', token)
        .single();

      if (patientError || !patientData) {
        console.error('Patient not found:', patientError);
        setLoading(false);
        return;
      }

      setPatient(patientData);

      // Check if this is a test token
      const isTestPatient = patientData.token.startsWith('test-token');
      setIsTestToken(isTestPatient);

      // Set initial step based on token type
      if (isTestPatient) {
        setCurrentStep(Step.DATA_CONSENT);
      }

      // Check if patient has already submitted responses
      const { data: existingResponse } = await supabase
        .from('patient_responses')
        .select('*')
        .eq('patient_id', patientData.id)
        .maybeSingle();

      if (existingResponse) {
        setHasResponse(true);
        // Pre-populate form with existing data
        form.reset(existingResponse);
        
        // Determine current step based on progress
        const { data: chatHistory } = await supabase
          .from('patient_conversations')
          .select('*')
          .eq('patient_id', patientData.id)
          .limit(1);

        const { data: recommendations } = await supabase
          .from('patient_recommendations')
          .select('*')
          .eq('patient_id', patientData.id)
          .limit(1);

        const { data: consent } = await supabase
          .from('informed_consents')
          .select('*')
          .eq('patient_id', patientData.id)
          .eq('accepted', true)
          .limit(1);

        if (consent && consent.length > 0) {
          setCurrentStep(Step.COMPLETE);
        } else if (recommendations && recommendations.length > 0) {
          setCurrentStep(Step.CONSENT);
        } else if (chatHistory && chatHistory.length > 0) {
          setCurrentStep(Step.RECOMMENDATIONS);
        } else if (isTestPatient) {
          setCurrentStep(Step.CHAT);
        } else {
          setCurrentStep(Step.CHAT);
        }
      }

    } catch (error) {
      console.error('Error fetching patient data:', error);
      toast({
        title: "Error",
        description: "Error al cargar los datos del paciente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!patient) return;

    setSubmitting(true);
    try {
      if (hasResponse) {
        // Update existing response
        const { error } = await supabase
          .from('patient_responses')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('patient_id', patient.id);

        if (error) throw error;
      } else {
        // Create new response
        const { error } = await supabase
          .from('patient_responses')
          .insert([{
            patient_id: patient.id,
            ...data
          }]);

        if (error) throw error;
        setHasResponse(true);
      }

      toast({
        title: "Formulario guardado",
        description: "Sus respuestas han sido guardadas exitosamente.",
      });

      setCurrentStep(Step.CHAT);

    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: "Error al guardar el formulario. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStepProgress = () => {
    const steps = isTestToken 
      ? [Step.DATA_CONSENT, Step.CHAT, Step.RECOMMENDATIONS, Step.CONSENT, Step.COMPLETE]
      : Object.values(Step);
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const getStepIcon = (step: Step) => {
    switch (step) {
      case Step.FORM:
        return <FileText className="w-4 h-4" />;
      case Step.DATA_CONSENT:
        return <FileText className="w-4 h-4" />;
      case Step.CHAT:
        return <MessageSquare className="w-4 h-4" />;
      case Step.RECOMMENDATIONS:
        return <Stethoscope className="w-4 h-4" />;
      case Step.CONSENT:
        return <FileText className="w-4 h-4" />;
      case Step.COMPLETE:
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getStepLabel = (step: Step) => {
    switch (step) {
      case Step.FORM:
        return "Formulario Médico";
      case Step.DATA_CONSENT:
        return "Consentimiento de Datos";
      case Step.CHAT:
        return "Consulta con IA";
      case Step.RECOMMENDATIONS:
        return "Recomendaciones";
      case Step.CONSENT:
        return "Consentimiento";
      case Step.COMPLETE:
        return "Completado";
    }
  };

  const isStepCompleted = (step: Step) => {
    const steps = isTestToken 
      ? [Step.DATA_CONSENT, Step.CHAT, Step.RECOMMENDATIONS, Step.CONSENT, Step.COMPLETE]
      : Object.values(Step);
    const stepIndex = steps.indexOf(step);
    const currentIndex = steps.indexOf(currentStep);
    return stepIndex < currentIndex || (step === currentStep && currentStep === Step.COMPLETE);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-sm text-muted-foreground">Cargando datos del paciente...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-xl font-bold">Acceso Denegado</CardTitle>
            <CardDescription>
              No se pudo encontrar un paciente con este enlace. Verifique que el enlace sea correcto o contacte a su centro médico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/verify')} 
              className="w-full"
              variant="outline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Verificación
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === Step.COMPLETE) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <CardTitle className="text-2xl font-bold">Evaluación Completada</CardTitle>
            <CardDescription>
              Su evaluación pre-anestésica ha sido completada exitosamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold mb-2">Resumen</h3>
              <p className="text-sm text-muted-foreground">
                ✓ Formulario médico completado<br />
                ✓ Consulta con IA realizada<br />
                ✓ Recomendaciones generadas<br />
                ✓ Consentimiento informado aceptado
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Su equipo médico revisará la información y se pondrá en contacto con usted si es necesario.
            </p>
            <Button 
              onClick={() => navigate('/verify')} 
              variant="outline"
            >
              Realizar Nueva Evaluación
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Evaluación Pre-Anestésica</CardTitle>
                  <CardDescription>{patient.name} - {patient.procedure}</CardDescription>
                </div>
              </div>
              <Badge variant="outline">{patient.procedure_date}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Progreso</span>
                <span>{Math.round(getStepProgress())}%</span>
              </div>
              <Progress value={getStepProgress()} className="w-full" />
              
              {/* Step indicators */}
              <div className="flex justify-between">
                {(isTestToken 
                  ? [Step.DATA_CONSENT, Step.CHAT, Step.RECOMMENDATIONS, Step.CONSENT, Step.COMPLETE]
                  : Object.values(Step)
                ).map((step) => (
                  <div key={step} className="flex flex-col items-center space-y-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isStepCompleted(step) 
                        ? 'bg-primary text-primary-foreground' 
                        : step === currentStep
                        ? 'bg-primary/20 text-primary border-2 border-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {isStepCompleted(step) ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        getStepIcon(step)
                      )}
                    </div>
                    <span className="text-xs text-center">{getStepLabel(step)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        {currentStep === Step.DATA_CONSENT && (
          <DataProcessingConsent onAccept={() => setCurrentStep(Step.CHAT)} />
        )}

        {currentStep === Step.FORM && (
          <Card>
            <CardHeader>
              <CardTitle>Información Médica</CardTitle>
              <CardDescription>
                Complete la siguiente información médica para su evaluación pre-anestésica.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Emergency Contact Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Contacto de Emergencia</h3>
                    
                    <FormField
                      control={form.control}
                      name="emergency_contact_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre completo</FormLabel>
                          <FormControl>
                            <Input placeholder="Nombre del contacto de emergencia" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergency_contact_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl>
                            <Input placeholder="Teléfono del contacto de emergencia" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergency_contact_relationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relación</FormLabel>
                          <FormControl>
                            <Input placeholder="Parentesco o relación" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Medical History Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Historia Médica</h3>

                    <FormField
                      control={form.control}
                      name="has_allergies"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Tengo alergias conocidas</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    {form.watch('has_allergies') && (
                      <FormField
                        control={form.control}
                        name="allergies"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Detalles de alergias</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Describa sus alergias (medicamentos, alimentos, etc.)"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="current_medications"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medicamentos actuales</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Liste todos los medicamentos que toma actualmente"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="medical_history"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Historia médica</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describa cualquier enfermedad o condición médica importante"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="previous_surgeries"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cirugías previas</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Liste cualquier cirugía previa y el año"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="family_history"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Historia familiar</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Historia familiar de enfermedades importantes"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Lifestyle Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Estilo de Vida</h3>

                    <FormField
                      control={form.control}
                      name="smoking"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>¿Fuma usted?</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={(value) => field.onChange(value === "true")}
                              value={field.value ? "true" : "false"}
                              className="flex flex-col space-y-1"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="true" id="smoking-yes" />
                                <label htmlFor="smoking-yes">Sí</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="false" id="smoking-no" />
                                <label htmlFor="smoking-no">No</label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="alcohol"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>¿Consume alcohol regularmente?</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={(value) => field.onChange(value === "true")}
                              value={field.value ? "true" : "false"}
                              className="flex flex-col space-y-1"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="true" id="alcohol-yes" />
                                <label htmlFor="alcohol-yes">Sí</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="false" id="alcohol-no" />
                                <label htmlFor="alcohol-no">No</label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="exercise"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Actividad física</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Describa su rutina de ejercicio"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="diet"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dieta</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Describa su dieta habitual"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sleep_hours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Horas de sueño por noche</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              max="24"
                              placeholder="Ejemplo: 8"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="stress_level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nivel de estrés (1-10)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              max="10"
                              placeholder="Del 1 (muy bajo) al 10 (muy alto)"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="additional_concerns"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preocupaciones adicionales</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="¿Hay algo más que le preocupe sobre la anestesia o cirugía?"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar y Continuar'
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {currentStep === Step.CHAT && patient && (
          <PatientChat 
            patientId={patient.id} 
            onComplete={() => setCurrentStep(Step.RECOMMENDATIONS)}
          />
        )}

        {currentStep === Step.RECOMMENDATIONS && patient && (
          <RecommendationsView 
            patientId={patient.id} 
            onContinue={() => setCurrentStep(Step.CONSENT)}
          />
        )}

        {currentStep === Step.CONSENT && patient && (
          <InformedConsent 
            patientId={patient.id} 
            onComplete={() => setCurrentStep(Step.COMPLETE)}
          />
        )}
      </div>
    </div>
  );
};

export default EnhancedPatientDashboard;