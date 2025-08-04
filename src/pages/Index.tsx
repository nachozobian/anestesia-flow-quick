import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCog, User, MessageSquare, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Sistema de Valoración de Consultas</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Sistema de Valoración 
            <span className="text-blue-600"> de Consultas Médicas</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Plataforma integral que conecta administradores médicos con pacientes a través de 
            evaluaciones inteligentes con IA y generación automatizada de reportes.
          </p>
        </div>

        {/* Access Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {/* Administrator Access */}
          <Card className="hover:shadow-xl transition-shadow border-2 hover:border-blue-200">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
                <UserCog className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Acceso Administrador</CardTitle>
              <CardDescription className="text-gray-600">
                Panel de control para profesionales médicos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span className="text-sm">Importar datos de pacientes (Excel/CSV)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <span className="text-sm">Configurar IA conversacional</span>
                </div>
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <span className="text-sm">Gestionar reportes y auditoría</span>
                </div>
              </div>
              <Button 
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-lg py-3"
                onClick={() => navigate('/admin')}
              >
                Acceder como Administrador
              </Button>
            </CardContent>
          </Card>

          {/* Patient Access */}
          <Card className="hover:shadow-xl transition-shadow border-2 hover:border-green-200">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Acceso Paciente</CardTitle>
              <CardDescription className="text-gray-600">
                Completa tu evaluación médica
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Cuestionario interactivo con IA</span>
                </div>
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Recomendaciones preoperatorias</span>
                </div>
                <div className="flex items-center space-x-3">
                  <UserCog className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Consentimiento informado digital</span>
                </div>
              </div>
              <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-600 mb-2">
                  ¿Recibiste un enlace de tu médico?
                </p>
                <p className="text-xs text-gray-500">
                  Usa el enlace enviado a tu teléfono para acceder
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Process Flow */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Flujo del Sistema</CardTitle>
            <CardDescription className="text-center">
              Proceso completo de evaluación médica en 4 pasos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  1
                </div>
                <h3 className="font-semibold mb-2">Importar Pacientes</h3>
                <p className="text-gray-600 text-sm">
                  Administrador carga datos del paciente
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  2
                </div>
                <h3 className="font-semibold mb-2">Envío de Enlace</h3>
                <p className="text-gray-600 text-sm">
                  Sistema envía enlace único por SMS/WhatsApp
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  3
                </div>
                <h3 className="font-semibold mb-2">Evaluación IA</h3>
                <p className="text-gray-600 text-sm">
                  Paciente interactúa con chatbot médico
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  4
                </div>
                <h3 className="font-semibold mb-2">Reporte Final</h3>
                <p className="text-gray-600 text-sm">
                  Generación automática con alertas médicas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-gray-600">
          <p>&copy; 2024 Sistema de Valoración de Consultas. Plataforma médica profesional.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
