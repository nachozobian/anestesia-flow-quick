import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, Clock, FileText, Loader2 } from 'lucide-react';

interface Recommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
}

interface RecommendationsViewProps {
  patientId: string;
  onContinue: () => void;
}

const RecommendationsView = ({ patientId, onContinue }: RecommendationsViewProps) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRecommendations();
  }, [patientId]);

  const loadRecommendations = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_recommendations')
        .select('*')
        .eq('patient_id', patientId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading recommendations:', error);
        return;
      }

      if (!data || data.length === 0) {
        // Generate recommendations if none exist
        generateRecommendations();
      } else {
        setRecommendations(data as Recommendation[]);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async () => {
    setGenerating(true);
    try {
      // Get patient data and conversation history
      const [patientResult, responsesResult, conversationResult] = await Promise.all([
        supabase
          .from('patients')
          .select('*')
          .eq('id', patientId)
          .single(),
        supabase
          .from('patient_responses')
          .select('*')
          .eq('patient_id', patientId)
          .single(),
        supabase
          .from('patient_conversations')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: true })
      ]);

      const patient = patientResult.data;
      const responses = responsesResult.data;
      const conversation = conversationResult.data || [];

      // Create context for AI
      const context = `
        Patient: ${patient?.name}
        Procedure: ${patient?.procedure}
        Procedure Date: ${patient?.procedure_date}
        
        Medical Information:
        - Allergies: ${responses?.has_allergies ? responses?.allergies : 'None'}
        - Current Medications: ${responses?.current_medications || 'None'}
        - Medical History: ${responses?.medical_history || 'None'}
        - Previous Surgeries: ${responses?.previous_surgeries || 'None'}
        - Smoking: ${responses?.smoking ? 'Yes' : 'No'}
        - Alcohol: ${responses?.alcohol ? 'Yes' : 'No'}
        - Exercise: ${responses?.exercise || 'None specified'}
        - Sleep: ${responses?.sleep_hours || 'Not specified'} hours
        - Stress Level: ${responses?.stress_level || 'Not specified'}/10
        
        Conversation Summary:
        ${conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      `;

      // Generate recommendations using AI
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('bedrock-chat', {
        body: {
          message: "Based on this patient's medical information and our conversation, generate 3-5 specific pre-operative recommendations. Format as JSON array with objects containing: category, title, description, priority (high/medium/low). Focus on practical, actionable advice.",
          context: context
        }
      });

      if (aiError) {
        throw aiError;
      }

      // Parse AI response and create recommendations
      let recommendationData = [];
      try {
        const aiText = aiResponse.response;
        // Try to extract JSON from the response
        const jsonMatch = aiText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          recommendationData = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: create default recommendations
          recommendationData = [
            {
              category: "Pre-Operatorio",
              title: "Ayuno pre-operatorio",
              description: "Mantenga ayuno completo 8 horas antes de la cirugía (sin alimentos ni líquidos).",
              priority: "high"
            },
            {
              category: "Medicación",
              title: "Revisión de medicamentos",
              description: "Suspenda medicamentos antiinflamatorios 7 días antes de la cirugía según indicación médica.",
              priority: "medium"
            },
            {
              category: "Estilo de Vida",
              title: "Cesación de tabaco",
              description: "Evite fumar al menos 24 horas antes de la cirugía para reducir complicaciones.",
              priority: "high"
            }
          ];
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        // Use default recommendations
        recommendationData = [
          {
            category: "Pre-Operatorio",
            title: "Preparación general",
            description: "Siga todas las instrucciones pre-operatorias proporcionadas por su equipo médico.",
            priority: "high"
          }
        ];
      }

      // Save recommendations to database
      const recommendationsToInsert = recommendationData.map((rec: any) => ({
        patient_id: patientId,
        category: rec.category,
        title: rec.title,
        description: rec.description,
        priority: rec.priority
      }));

      const { error: insertError } = await supabase
        .from('patient_recommendations')
        .insert(recommendationsToInsert);

      if (insertError) {
        throw insertError;
      }

      // Reload recommendations
      loadRecommendations();

      toast({
        title: "Recomendaciones generadas",
        description: "Se han generado sus recomendaciones personalizadas.",
      });

    } catch (error) {
      console.error('Error generating recommendations:', error);
      toast({
        title: "Error",
        description: "Error al generar recomendaciones. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-success" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Alta Prioridad';
      case 'medium':
        return 'Prioridad Media';
      case 'low':
        return 'Baja Prioridad';
      default:
        return priority;
    }
  };

  if (loading || generating) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">
            {generating ? 'Generando recomendaciones personalizadas...' : 'Cargando recomendaciones...'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Recomendaciones Pre-Operatorias</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            Basándose en su información médica y la consulta con IA, estas son sus recomendaciones personalizadas para antes de la cirugía:
          </p>
          
          <div className="space-y-4">
            {recommendations.map((recommendation) => (
              <Card key={recommendation.id} className="border-l-4 border-l-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon(recommendation.priority)}
                      <h4 className="font-semibold text-sm">{recommendation.title}</h4>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {recommendation.category}
                      </Badge>
                      <Badge 
                        variant={getPriorityColor(recommendation.priority) as any} 
                        className="text-xs"
                      >
                        {getPriorityLabel(recommendation.priority)}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {recommendation.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {recommendations.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                No se encontraron recomendaciones. 
              </p>
              <Button onClick={generateRecommendations} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generando...
                  </>
                ) : (
                  'Generar Recomendaciones'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onContinue} className="px-8">
          Continuar al Consentimiento
        </Button>
      </div>
    </div>
  );
};

export default RecommendationsView;