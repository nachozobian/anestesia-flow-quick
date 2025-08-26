import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Bot, User, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface PatientChatProps {
  patientId: string;
  onComplete: () => void;
}

const PatientChat = ({ patientId, onComplete }: PatientChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [canComplete, setCanComplete] = useState(false);
  const [recommendationsGenerated, setRecommendationsGenerated] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadConversation();
    // Add initial AI greeting if no messages exist
    initializeChat();
    checkRecommendationsStatus();
  }, [patientId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  };

  const loadConversation = async () => {
    if (!patientId) return;
    
    try {
      // Get patient token first
      const { data: patientResult } = await supabase
        .rpc('get_patient_by_token', { patient_token: patientId });
      
      if (!patientResult || patientResult.length === 0) return;
      
      // Load conversation using secure function
      const { data: conversationData, error } = await supabase
        .rpc('get_patient_conversations_by_token', { patient_token: patientId });

      if (error) {
        console.error('Error loading conversation:', error);
        return;
      }

      const formattedMessages: Message[] = (conversationData || []).map((msg: any) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        created_at: msg.created_at
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const initializeChat = async () => {
    // Check if conversation already exists using secure function
    const { data: existingMessages } = await supabase
      .rpc('get_patient_conversations_by_token', { patient_token: patientId });

    if (!existingMessages || existingMessages.length === 0) {
      // Add initial AI greeting using secure function
      await supabase.rpc('add_conversation_message_by_token', {
        patient_token: patientId,
        message_role: 'assistant',
        message_content: '¡Hola! Soy su asistente de IA para la evaluación pre-anestésica. Basándome en la información que ya proporcionó en el formulario, me gustaría hacerle algunas preguntas adicionales para asegurarme de que tenemos toda la información necesaria para su procedimiento. ¿Está listo para comenzar?'
      });

      loadConversation();
    }
  };

  const checkRecommendationsStatus = async () => {
    try {
      const { data: recommendations } = await supabase
        .rpc('get_patient_recommendations_by_token', { patient_token: patientId });
      
      if (recommendations && recommendations.length > 0) {
        setRecommendationsGenerated(true);
        setCanComplete(true);
      }
    } catch (error) {
      console.error('Error checking recommendations:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      patient_id: patientId,
      role: 'user' as const,
      content: input.trim()
    };

    setLoading(true);
    setInput('');

    try {
      // Update patient status to "En progreso" if this is their first message
      if (messages.length <= 1) { // Only AI greeting exists
        await supabase.rpc('update_patient_by_token', {
          patient_token: patientId,
          new_status: 'En progreso'
        });
      }

      // Save user message using secure function
      await supabase.rpc('add_conversation_message_by_token', {
        patient_token: patientId,
        message_role: 'user',
        message_content: input.trim()
      });

      // Get patient data for context using secure function
      const { data: patientResult } = await supabase
        .rpc('get_patient_by_token', { patient_token: patientId });
      
      const patientData = patientResult?.[0];

      // Get conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Get AI response using the openai-chat function
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('openai-chat', {
        body: {
          message: input.trim(),
          patientData: patientData,
          conversationHistory: conversationHistory
        }
      });

      if (aiError) {
        throw aiError;
      }

      // Check if recommendations were generated
      if (aiResponse.recommendations_generated) {
        setRecommendationsGenerated(true);
        setCanComplete(true);
        toast({
          title: "Consulta Completada",
          description: "El asistente ha generado recomendaciones médicas específicas para usted. Ya puede finalizar la consulta.",
        });
      }

      // Save AI response using secure function
      await supabase.rpc('add_conversation_message_by_token', {
        patient_token: patientId,
        message_role: 'assistant',
        message_content: aiResponse.response || 'Lo siento, hubo un error procesando su mensaje. Por favor intente nuevamente.'
      });

      // Reload conversation
      loadConversation();

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Error al enviar el mensaje. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleCompleteConsultation = () => {
    if (!canComplete) {
      toast({
        title: "Consulta incompleta",
        description: "La inteligencia artificial aún no ha completado su evaluación. Por favor, continúe la conversación hasta que se generen las recomendaciones.",
        variant: "destructive"
      });
      return;
    }
    onComplete();
  };

  if (initialLoading) {
    return (
      <Card className="w-full h-96 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando conversación...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full h-96 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <Bot className="h-5 w-5 text-primary" />
          <span>Consulta con IA</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-4">
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${
                  message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <div className={`p-2 rounded-full ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-secondary-foreground'
                }`}>
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div className={`flex-1 p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto max-w-[80%]'
                    : 'bg-muted'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-full bg-secondary text-secondary-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1 p-3 rounded-lg bg-muted">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Escribiendo...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="border-t p-4">
          <div className="flex items-end space-x-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Escriba su mensaje..."
              disabled={loading}
              className="flex-1 min-h-[40px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button 
              onClick={sendMessage} 
              disabled={loading || !input.trim()}
              size="icon"
              className="h-10 w-10 shrink-0"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Presione Enter para enviar • Shift+Enter para nueva línea
            </p>
            <Button 
              variant={canComplete ? "default" : "outline"}
              size="sm" 
              onClick={handleCompleteConsultation}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Procesando...
                </>
              ) : canComplete ? (
                'Finalizar Consulta ✓'
              ) : (
                'Finalizar Consulta (Esperando IA)'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PatientChat;