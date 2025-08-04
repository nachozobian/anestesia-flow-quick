import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadConversation();
    // Add initial AI greeting if no messages exist
    initializeChat();
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
    try {
      const { data, error } = await supabase
        .from('patient_conversations')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading conversation:', error);
        return;
      }

      setMessages((data || []) as Message[]);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const initializeChat = async () => {
    // Check if conversation already exists
    const { data: existingMessages } = await supabase
      .from('patient_conversations')
      .select('*')
      .eq('patient_id', patientId)
      .limit(1);

    if (!existingMessages || existingMessages.length === 0) {
      // Add initial AI greeting
      const welcomeMessage = {
        patient_id: patientId,
        role: 'assistant' as const,
        content: '¡Hola! Soy su asistente de IA para la evaluación pre-anestésica. Basándome en la información que ya proporcionó en el formulario, me gustaría hacerle algunas preguntas adicionales para asegurarme de que tenemos toda la información necesaria para su procedimiento. ¿Está listo para comenzar?'
      };

      const { error } = await supabase
        .from('patient_conversations')
        .insert([welcomeMessage]);

      if (!error) {
        loadConversation();
      }
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
      // Save user message
      const { error: userError } = await supabase
        .from('patient_conversations')
        .insert([userMessage]);

      if (userError) {
        throw userError;
      }

      // Get AI response using the bedrock-chat function
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('bedrock-chat', {
        body: {
          message: input.trim(),
          context: "You are a medical AI assistant helping with pre-anesthetic evaluation. Ask relevant follow-up questions based on the patient's medical form responses. Be professional, empathetic, and focused on gathering important medical information."
        }
      });

      if (aiError) {
        throw aiError;
      }

      // Save AI response
      const assistantMessage = {
        patient_id: patientId,
        role: 'assistant' as const,
        content: aiResponse.response || 'Lo siento, hubo un error procesando su mensaje. Por favor intente nuevamente.'
      };

      const { error: assistantError } = await supabase
        .from('patient_conversations')
        .insert([assistantMessage]);

      if (assistantError) {
        throw assistantError;
      }

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
          <div className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escriba su mensaje..."
              disabled={loading}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage} 
              disabled={loading || !input.trim()}
              size="icon"
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
              Presione Enter para enviar
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onComplete}
            >
              Finalizar Consulta
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PatientChat;