import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Shield, User } from 'lucide-react';

const DNIVerification = () => {
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDNISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingrese su DNI",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Check if patient exists with this DNI
      const { data: patient, error } = await supabase
        .from('patients')
        .select('*')
        .eq('dni', dni.trim())
        .maybeSingle();

      if (error) {
        console.error('Error checking DNI:', error);
        toast({
          title: "Error",
          description: "Error al verificar el DNI. Intente nuevamente.",
          variant: "destructive"
        });
        return;
      }

      if (!patient) {
        toast({
          title: "DNI no encontrado",
          description: "No se encontró ningún paciente con este DNI. Verifique el número ingresado.",
          variant: "destructive"
        });
        return;
      }

      // Redirect to patient dashboard with token
      navigate(`/patient/${patient.token}`);
      
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Verificación de Identidad</CardTitle>
            <CardDescription className="text-base mt-2">
              Ingrese su DNI para acceder a su evaluación pre-anestésica
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDNISubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dni" className="text-sm font-medium">
                Número de DNI
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dni"
                  type="text"
                  placeholder="Ej: 12345678"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                  maxLength={20}
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? "Verificando..." : "Verificar DNI"}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              ¿No tiene su DNI a mano? Contacte a su centro médico para obtener asistencia.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DNIVerification;