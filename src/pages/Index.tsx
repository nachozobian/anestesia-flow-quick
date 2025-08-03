import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, Users, Link as LinkIcon, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: FileSpreadsheet,
      title: "Carga de Datos",
      description: "Sube archivos CSV/XLSX con información de pacientes de forma rápida y segura."
    },
    {
      icon: Users,
      title: "Gestión de Pacientes", 
      description: "Visualiza y administra toda la información de tus pacientes en un solo lugar."
    },
    {
      icon: LinkIcon,
      title: "Enlaces Únicos",
      description: "Genera links personalizados para que cada paciente complete su evaluación."
    },
    {
      icon: Shield,
      title: "Seguridad Médica",
      description: "Cumple con estándares de privacidad y seguridad para datos médicos."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-xl font-bold text-gray-900">AnestesiaFlow</span>
          </div>
          <Button onClick={() => navigate('/admin')} className="bg-blue-600 hover:bg-blue-700">
            Panel Médico
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Sistema de Evaluación 
            <span className="text-blue-600"> Pre-Anestésica</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Plataforma moderna para anestesiólogos que optimiza el proceso de evaluación pre-operatoria 
            mediante tecnología intuitiva y segura.
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate('/admin')}
              className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
            >
              Acceder como Médico
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Process Flow */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Flujo de Trabajo Simple</CardTitle>
            <CardDescription className="text-center">
              Proceso optimizado en 3 pasos para maximizar eficiencia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  1
                </div>
                <h3 className="font-semibold mb-2">Cargar Datos</h3>
                <p className="text-gray-600 text-sm">
                  Sube tu archivo CSV/XLSX con la información de pacientes
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  2
                </div>
                <h3 className="font-semibold mb-2">Generar Enlaces</h3>
                <p className="text-gray-600 text-sm">
                  El sistema crea automáticamente enlaces únicos para cada paciente
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  3
                </div>
                <h3 className="font-semibold mb-2">Recopilar Respuestas</h3>
                <p className="text-gray-600 text-sm">
                  Los pacientes completan su evaluación y tú recibes notificaciones
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-gray-600">
          <p>&copy; 2024 AnestesiaFlow. Desarrollado para profesionales médicos.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
