import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Lock, Eye, Users } from "lucide-react";

interface DataProcessingConsentProps {
  onAccept: () => void;
}

export default function DataProcessingConsent({ onAccept }: DataProcessingConsentProps) {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    if (accepted) {
      onAccept();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mx-auto max-w-2xl">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Consentimiento de Tratamiento de Datos
            </CardTitle>
            <CardDescription className="text-lg text-gray-600">
              Para continuar con su evaluación pre-anestésica, necesitamos su consentimiento para el tratamiento de sus datos personales
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-start space-x-3">
                <Lock className="h-6 w-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900">Seguridad de Datos</h3>
                  <p className="text-gray-600">Sus datos están protegidos con encriptación de nivel médico y se almacenan de forma segura.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Eye className="h-6 w-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900">Uso de la Información</h3>
                  <p className="text-gray-600">Sus datos se utilizarán únicamente para su evaluación pre-anestésica y atención médica.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Users className="h-6 w-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900">Acceso Restringido</h3>
                  <p className="text-gray-600">Solo el personal médico autorizado tendrá acceso a su información.</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">¿Qué datos recopilamos?</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Información médica relevante para la anestesia</li>
                <li>• Historial médico y medicamentos actuales</li>
                <li>• Alergias y reacciones adversas</li>
                <li>• Información de contacto de emergencia</li>
              </ul>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="consent" 
                checked={accepted}
                onCheckedChange={(checked) => setAccepted(checked as boolean)}
              />
              <label 
                htmlFor="consent" 
                className="text-sm text-gray-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Acepto el tratamiento de mis datos personales para fines médicos según se describe anteriormente
              </label>
            </div>

            <Button 
              onClick={handleAccept}
              disabled={!accepted}
              className="w-full"
              size="lg"
            >
              Continuar con la Evaluación
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}