import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, Save, X, Eye } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SystemPromptManagerProps {
  userRole: string | null;
}

export const SystemPromptManager = ({ userRole }: SystemPromptManagerProps) => {
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isOwner = userRole === 'Owner';

  useEffect(() => {
    fetchSystemPrompt();
  }, []);

  const fetchSystemPrompt = async () => {
    try {
      const { data, error } = await supabase
        .from('system_prompts')
        .select('content')
        .eq('name', 'anesthesia_assistant')
        .single();

      if (error) {
        console.error('Error fetching system prompt:', error);
        toast({
          title: "Error",
          description: "No se pudo cargar el prompt del sistema",
          variant: "destructive",
        });
      } else {
        setCurrentPrompt(data?.content || '');
        setEditedPrompt(data?.content || '');
      }
    } catch (error) {
      console.error('Error fetching system prompt:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrompt = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('system_prompts')
        .update({ content: editedPrompt, updated_at: new Date().toISOString() })
        .eq('name', 'anesthesia_assistant');

      if (error) {
        console.error('Error updating system prompt:', error);
        toast({
          title: "Error",
          description: "No se pudo actualizar el prompt del sistema",
          variant: "destructive",
        });
      } else {
        setCurrentPrompt(editedPrompt);
        setIsEditing(false);
        toast({
          title: "Éxito",
          description: "Prompt del sistema actualizado correctamente",
        });
      }
    } catch (error) {
      console.error('Error updating system prompt:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedPrompt(currentPrompt);
    setIsEditing(false);
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
               Prompt del Sistema
             </CardTitle>
             <CardDescription>
               {isOwner 
                 ? 'Puedes visualizar y modificar el prompt que usa el asistente médico'
                 : 'Visualización del prompt actual del asistente médico'
               }
             </CardDescription>
           </div>
           {isOwner && !isEditing && (
            <Button 
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
              placeholder="Ingresa el prompt del sistema..."
            />
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={saving || editedPrompt === currentPrompt}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Cambios
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Confirmar cambios?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción actualizará el prompt del sistema que usa el asistente médico. 
                      Los cambios se aplicarán inmediatamente en todas las nuevas conversaciones.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSavePrompt}>
                      Confirmar Cambios
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button 
                variant="outline" 
                onClick={handleCancelEdit}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-4 border">
              <pre className="whitespace-pre-wrap text-sm font-mono overflow-auto max-h-[400px]">
                {currentPrompt || 'No hay prompt configurado'}
              </pre>
            </div>
            {!isOwner && (
              <p className="text-sm text-muted-foreground">
                Solo los propietarios pueden modificar este prompt.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};