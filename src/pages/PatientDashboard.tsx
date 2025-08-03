import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  emergency_contact_name: z.string().min(2, "Nome do contato de emergência é obrigatório"),
  emergency_contact_phone: z.string().min(10, "Telefone do contato deve ter pelo menos 10 dígitos"),
  allergies: z.string().optional(),
  current_medications: z.string().optional(),
  previous_surgeries: z.string().optional(),
  medical_conditions: z.string().optional(),
  smoking_status: z.enum(["never", "former", "current"]),
  alcohol_consumption: z.enum(["never", "occasional", "regular", "heavy"]),
  pregnancy_status: z.boolean().optional(),
  additional_notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  birth_date: string;
  procedure: string;
  procedure_date: string;
}

const PatientDashboard = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasResponse, setHasResponse] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      emergency_contact_name: "",
      emergency_contact_phone: "",
      allergies: "",
      current_medications: "",
      previous_surgeries: "",
      medical_conditions: "",
      smoking_status: "never",
      alcohol_consumption: "never",
      pregnancy_status: false,
      additional_notes: "",
    },
  });

  useEffect(() => {
    const fetchPatient = async () => {
      if (!token) {
        toast({
          title: "Token inválido",
          description: "Link de acesso inválido ou expirado.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      try {
        // Fetch patient data - using any type until Supabase types are updated
        const { data: patientData, error: patientError } = await (supabase as any)
          .from("patients")
          .select("*")
          .eq("unique_token", token)
          .single();

        if (patientError || !patientData) {
          toast({
            title: "Paciente não encontrado",
            description: "Link de acesso inválido ou expirado.",
            variant: "destructive",
          });
          navigate("/");
          return;
        }

        setPatient(patientData);

        // Check if patient already has responses
        const { data: responseData } = await (supabase as any)
          .from("patient_responses")
          .select("id")
          .eq("patient_id", patientData.id)
          .single();

        if (responseData) {
          setHasResponse(true);
        }
      } catch (error) {
        console.error("Error fetching patient:", error);
        toast({
          title: "Erro",
          description: "Erro ao carregar dados do paciente.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [token, navigate]);

  const onSubmit = async (data: FormData) => {
    if (!patient) return;

    setSubmitting(true);

    try {
      const { error } = await (supabase as any)
        .from("patient_responses")
        .insert({
          patient_id: patient.id,
          ...data,
        });

      if (error) throw error;

      toast({
        title: "Formulário enviado com sucesso!",
        description: "Suas informações foram registradas. Entraremos em contato em breve.",
      });

      setHasResponse(true);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "Erro ao enviar formulário",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>Link inválido ou expirado.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (hasResponse) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-green-600">Formulário já enviado</CardTitle>
            <CardDescription>
              Obrigado, {patient.name}! Suas informações já foram registradas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <p><strong>Procedimento:</strong> {patient.procedure}</p>
              <p><strong>Data:</strong> {new Date(patient.procedure_date).toLocaleDateString('pt-BR')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Avaliação Pré-Anestésica</CardTitle>
            <CardDescription>
              Olá, {patient.name}! Por favor, preencha as informações abaixo para sua consulta.
            </CardDescription>
            <div className="text-sm bg-muted p-4 rounded-lg space-y-1">
              <p><strong>Procedimento:</strong> {patient.procedure}</p>
              <p><strong>Data:</strong> {new Date(patient.procedure_date).toLocaleDateString('pt-BR')}</p>
              <p><strong>Email:</strong> {patient.email}</p>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Emergency Contact */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Contato de Emergência</h3>
                  <FormField
                    control={form.control}
                    name="emergency_contact_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do contato de emergência *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo" {...field} />
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
                        <FormLabel>Telefone do contato de emergência *</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Medical History */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Histórico Médico</h3>
                  <FormField
                    control={form.control}
                    name="allergies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alergias (medicamentos, alimentos, etc.)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Descreva suas alergias ou digite 'Nenhuma'" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="current_medications"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medicamentos em uso</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Liste todos os medicamentos que você toma regularmente" {...field} />
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
                        <FormLabel>Cirurgias anteriores</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Descreva cirurgias realizadas anteriormente" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="medical_conditions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condições médicas</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Diabetes, hipertensão, doenças cardíacas, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Lifestyle */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Estilo de Vida</h3>
                  <FormField
                    control={form.control}
                    name="smoking_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status de tabagismo</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="never" id="never" />
                              <label htmlFor="never">Nunca fumei</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="former" id="former" />
                              <label htmlFor="former">Ex-fumante</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="current" id="current" />
                              <label htmlFor="current">Fumante atual</label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="alcohol_consumption"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Consumo de álcool</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="never" id="alcohol-never" />
                              <label htmlFor="alcohol-never">Nunca bebo</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="occasional" id="occasional" />
                              <label htmlFor="occasional">Ocasionalmente</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="regular" id="regular" />
                              <label htmlFor="regular">Regularmente</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="heavy" id="heavy" />
                              <label htmlFor="heavy">Consumo elevado</label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pregnancy_status"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Estou grávida ou posso estar grávida
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="additional_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações adicionais</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Qualquer informação adicional que considera importante"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar Formulário"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PatientDashboard;