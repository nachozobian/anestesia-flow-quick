import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const ResendSMS = () => {
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni.trim() || !phone.trim()) {
      toast({
        title: "Error",
        description: "Debe ingresar DNI y teléfono",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      // Validar paciente en la base de datos
  const response = await fetch("https://fxolgklxzibbakbrokcn.supabase.co/functions/v1/validate-patient-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni: dni.trim(), phone: phone.trim() })
      });
      const result = await response.json();
      if (!response.ok || !result.valid) {
        toast({
          title: "Datos incorrectos",
          description: "No se encontró un paciente con ese DNI y teléfono.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      // Reenviar SMS
  const smsResp = await fetch("https://fxolgklxzibbakbrokcn.supabase.co/functions/v1/resend-validation-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: dni.trim() })
      });
      const smsResult = await smsResp.json();
      if (smsResp.ok && smsResult.success) {
        toast({
          title: "SMS reenviado",
          description: "El código ha sido reenviado a su teléfono.",
          variant: "success"
        });
        navigate("/dni-verification");
      } else {
        toast({
          title: "Error",
          description: smsResult.error || "No se pudo reenviar el SMS.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
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
          <CardTitle className="text-2xl font-bold">Reenviar código por SMS</CardTitle>
          <CardDescription className="text-base mt-2">
            Ingrese su DNI y número de teléfono para validar su identidad y recibir el código por SMS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResend} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dni" className="text-sm font-medium">Número de DNI</Label>
              <Input id="dni" type="text" placeholder="Ej: 12345678" value={dni} onChange={e => setDni(e.target.value)} disabled={loading} maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Número de teléfono</Label>
              <Input id="phone" type="text" placeholder="Ej: 1123456789" value={phone} onChange={e => setPhone(e.target.value)} disabled={loading} maxLength={15} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Reenviar código por SMS"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResendSMS;
