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
  const [securityCode, setSecurityCode] = useState('');
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

    if (!securityCode.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingrese el código de seguridad",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Use secure function to verify DNI and security code
      const { data, error } = await supabase
        .rpc('verify_dni_and_security_code', { 
          patient_dni: dni.trim(),
          security_code: securityCode.trim()
        });

      if (error) {
        console.error('Error checking DNI and security code:', error);
        toast({
          title: "Error",
          description: "Error al verificar las credenciales. Intente nuevamente.",
          variant: "destructive"
        });
        return;
      }

      if (!data || data.length === 0) {
        toast({
          title: "Credenciales incorrectas",
          description: "DNI o código de seguridad incorrecto. Verifique los datos ingresados.",
          variant: "destructive"
        });
        return;
      }

      // Redirect to patient dashboard with token
      navigate(`/patient/${data[0].token}`);
      
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
              Ingrese su DNI y el código de seguridad enviado por SMS
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
            <div className="space-y-2">
              <Label htmlFor="securityCode" className="text-sm font-medium">
                Código de Seguridad
              </Label>
              <div className="relative">
                <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="securityCode"
                  type="text"
                  placeholder="Ej: 123456"
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                  maxLength={6}
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? "Verificando..." : "Verificar Credenciales"}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              ¿No recibió el código de seguridad? Contacte a su centro médico para obtener asistencia.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DNIVerification;