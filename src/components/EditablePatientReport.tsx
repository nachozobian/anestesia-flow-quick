import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Download, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Patient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dni: string;
  birth_date?: string;
  procedure?: string;
  procedure_date?: string;
  status: string;
  created_at: string;
  token: string;
  updated_at: string;
}

interface PatientReport {
  responses: any;
  recommendations: any[];
  conversations: any[];
  consents: any[];
}

interface EditablePatientReportProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  patientReport: PatientReport;
  onSaveAndGeneratePDF: (editedData: any) => void;
}

export const EditablePatientReport: React.FC<EditablePatientReportProps> = ({
  isOpen,
  onClose,
  patient,
  patientReport,
  onSaveAndGeneratePDF
}) => {
  const [editedData, setEditedData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (patientReport && isOpen) {
      // Initialize form with existing data
      setEditedData({
        // Patient basic info
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        dni: patient.dni,
        birth_date: patient.birth_date,
        procedure: patient.procedure,
        procedure_date: patient.procedure_date,
        
        // Medical responses
        emergency_contact_name: patientReport.responses?.emergency_contact_name || '',
        emergency_contact_phone: patientReport.responses?.emergency_contact_phone || '',
        emergency_contact_relationship: patientReport.responses?.emergency_contact_relationship || '',
        has_allergies: patientReport.responses?.has_allergies || false,
        allergies: patientReport.responses?.allergies || '',
        current_medications: patientReport.responses?.current_medications || '',
        medical_history: patientReport.responses?.medical_history || '',
        previous_surgeries: patientReport.responses?.previous_surgeries || '',
        family_history: patientReport.responses?.family_history || '',
        smoking: patientReport.responses?.smoking || false,
        alcohol: patientReport.responses?.alcohol || false,
        exercise: patientReport.responses?.exercise || '',
        diet: patientReport.responses?.diet || '',
        sleep_hours: patientReport.responses?.sleep_hours || '',
        stress_level: patientReport.responses?.stress_level || '',
        additional_concerns: patientReport.responses?.additional_concerns || '',
        
        // Recommendations (editable)
        recommendations: patientReport.recommendations || [],
        
        // Conversations and consents (read-only for display)
        conversations: patientReport.conversations || [],
        consents: patientReport.consents || []
      });
    }
  }, [patientReport, patient, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Required fields validation
    if (!editedData.name?.trim()) newErrors.name = 'Nombre es requerido';
    if (!editedData.email?.trim()) newErrors.email = 'Email es requerido';
    if (!editedData.dni?.trim()) newErrors.dni = 'DNI es requerido';
    if (!editedData.procedure?.trim()) newErrors.procedure = 'Procedimiento es requerido';
    
    // Critical medical info validation
    if (editedData.has_allergies && !editedData.allergies?.trim()) {
      newErrors.allergies = 'Debe especificar las alergias';
    }
    
    if (!editedData.emergency_contact_name?.trim()) {
      newErrors.emergency_contact_name = 'Contacto de emergencia es requerido';
    }
    
    if (!editedData.emergency_contact_phone?.trim()) {
      newErrors.emergency_contact_phone = 'Teléfono de emergencia es requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (validateForm()) {
      try {
        // Get current user for validation
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Usuario no autenticado');
        }

        // Update patient basic information
        const { error: patientError } = await supabase
          .from('patients')
          .update({
            name: editedData.name,
            email: editedData.email,
            phone: editedData.phone,
            dni: editedData.dni,
            birth_date: editedData.birth_date,
            procedure: editedData.procedure,
            procedure_date: editedData.procedure_date,
            status: 'Validado',
            validated_by: user.id,
            validated_at: new Date().toISOString()
          })
          .eq('id', patient.id);

        if (patientError) throw patientError;

        // Update patient responses
        const { error: responseError } = await supabase
          .from('patient_responses')
          .upsert({
            patient_id: patient.id,
            emergency_contact_name: editedData.emergency_contact_name,
            emergency_contact_phone: editedData.emergency_contact_phone,
            emergency_contact_relationship: editedData.emergency_contact_relationship,
            has_allergies: editedData.has_allergies,
            allergies: editedData.allergies,
            current_medications: editedData.current_medications,
            medical_history: editedData.medical_history,
            previous_surgeries: editedData.previous_surgeries,
            family_history: editedData.family_history,
            smoking: editedData.smoking,
            alcohol: editedData.alcohol,
            exercise: editedData.exercise,
            diet: editedData.diet,
            sleep_hours: editedData.sleep_hours ? parseInt(editedData.sleep_hours) : null,
            stress_level: editedData.stress_level ? parseInt(editedData.stress_level) : null,
            additional_concerns: editedData.additional_concerns,
            updated_at: new Date().toISOString()
          });

        if (responseError) throw responseError;

        // Delete existing recommendations and insert new ones
        await supabase
          .from('patient_recommendations')
          .delete()
          .eq('patient_id', patient.id);

        if (editedData.recommendations && editedData.recommendations.length > 0) {
          const { error: recError } = await supabase
            .from('patient_recommendations')
            .insert(
              editedData.recommendations.map((rec: any) => ({
                patient_id: patient.id,
                category: rec.category,
                title: rec.title,
                description: rec.description,
                priority: rec.priority
              }))
            );

          if (recError) throw recError;
        }

        // Call the validation function to officially validate the report
        const { data: validationResult, error: validationError } = await supabase.rpc('validate_patient_report', {
          patient_id: patient.id,
          validator_user_id: user.id
        });

        if (validationError) {
          console.error('Validation error:', validationError);
        }

        // Send validation SMS to patient
        try {
          const { error: smsError } = await supabase.functions.invoke('send-validation-sms', {
            body: {
              patientId: patient.id,
              validatorName: user.email || 'Equipo médico'
            }
          });

          if (smsError) {
            console.error('Error sending validation SMS:', smsError);
          }
        } catch (smsError) {
          console.error('Error sending validation SMS:', smsError);
        }

        // Generate PDF with updated data
        onSaveAndGeneratePDF(editedData);
        
        // Close the modal
        onClose();
        
        // Refresh the page to show updated status
        window.location.reload();

        toast({
          title: "Informe validado",
          description: "Los cambios han sido guardados, el estado cambió a 'Validado', se envió SMS al paciente y el PDF está siendo generado.",
        });
      } catch (error) {
        console.error('Error saving patient data:', error);
        toast({
          title: "Error",
          description: "No se pudieron guardar los cambios. Inténtelo de nuevo.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Error de validación",
        description: "Por favor complete todos los campos requeridos.",
        variant: "destructive",
      });
    }
  };

  const updateField = (field: string, value: any) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addRecommendation = () => {
    const newRec = {
      id: Date.now().toString(),
      category: '',
      title: '',
      description: '',
      priority: 'medium'
    };
    updateField('recommendations', [...editedData.recommendations, newRec]);
  };

  const updateRecommendation = (index: number, field: string, value: string) => {
    const updated = [...editedData.recommendations];
    updated[index] = { ...updated[index], [field]: value };
    updateField('recommendations', updated);
  };

  const removeRecommendation = (index: number) => {
    const updated = editedData.recommendations.filter((_, i) => i !== index);
    updateField('recommendations', updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Informe Pre-anestésico - {patient.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del Paciente</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={editedData.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
              </div>
              
              <div>
                <Label htmlFor="dni">DNI *</Label>
                <Input
                  id="dni"
                  value={editedData.dni || ''}
                  onChange={(e) => updateField('dni', e.target.value)}
                  className={errors.dni ? 'border-destructive' : ''}
                />
                {errors.dni && <p className="text-sm text-destructive mt-1">{errors.dni}</p>}
              </div>
              
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={editedData.email || ''}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
              </div>
              
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={editedData.phone || ''}
                  onChange={(e) => updateField('phone', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="procedure">Procedimiento *</Label>
                <Input
                  id="procedure"
                  value={editedData.procedure || ''}
                  onChange={(e) => updateField('procedure', e.target.value)}
                  className={errors.procedure ? 'border-destructive' : ''}
                />
                {errors.procedure && <p className="text-sm text-destructive mt-1">{errors.procedure}</p>}
              </div>
              
              <div>
                <Label htmlFor="procedure_date">Fecha del Procedimiento</Label>
                <Input
                  id="procedure_date"
                  type="date"
                  value={editedData.procedure_date || ''}
                  onChange={(e) => updateField('procedure_date', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Contacto de Emergencia
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="emergency_name">Nombre *</Label>
                <Input
                  id="emergency_name"
                  value={editedData.emergency_contact_name || ''}
                  onChange={(e) => updateField('emergency_contact_name', e.target.value)}
                  className={errors.emergency_contact_name ? 'border-destructive' : ''}
                />
                {errors.emergency_contact_name && <p className="text-sm text-destructive mt-1">{errors.emergency_contact_name}</p>}
              </div>
              
              <div>
                <Label htmlFor="emergency_phone">Teléfono *</Label>
                <Input
                  id="emergency_phone"
                  value={editedData.emergency_contact_phone || ''}
                  onChange={(e) => updateField('emergency_contact_phone', e.target.value)}
                  className={errors.emergency_contact_phone ? 'border-destructive' : ''}
                />
                {errors.emergency_contact_phone && <p className="text-sm text-destructive mt-1">{errors.emergency_contact_phone}</p>}
              </div>
              
              <div>
                <Label htmlFor="emergency_relationship">Relación</Label>
                <Input
                  id="emergency_relationship"
                  value={editedData.emergency_contact_relationship || ''}
                  onChange={(e) => updateField('emergency_contact_relationship', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Medical History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historia Médica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has_allergies"
                    checked={editedData.has_allergies}
                    onCheckedChange={(checked) => updateField('has_allergies', checked)}
                  />
                  <Label htmlFor="has_allergies" className="font-medium text-destructive">Tiene alergias</Label>
                </div>
                
                {editedData.has_allergies && (
                  <div>
                    <Label htmlFor="allergies">Especificar alergias *</Label>
                    <Textarea
                      id="allergies"
                      value={editedData.allergies || ''}
                      onChange={(e) => updateField('allergies', e.target.value)}
                      className={errors.allergies ? 'border-destructive' : ''}
                      placeholder="Describa las alergias conocidas..."
                    />
                    {errors.allergies && <p className="text-sm text-destructive mt-1">{errors.allergies}</p>}
                  </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="current_medications">Medicamentos Actuales</Label>
                <Textarea
                  id="current_medications"
                  value={editedData.current_medications || ''}
                  onChange={(e) => updateField('current_medications', e.target.value)}
                  placeholder="Liste todos los medicamentos que toma actualmente..."
                />
              </div>
              
              <div>
                <Label htmlFor="medical_history">Historia Médica</Label>
                <Textarea
                  id="medical_history"
                  value={editedData.medical_history || ''}
                  onChange={(e) => updateField('medical_history', e.target.value)}
                  placeholder="Enfermedades, condiciones médicas previas..."
                />
              </div>
              
              <div>
                <Label htmlFor="previous_surgeries">Cirugías Previas</Label>
                <Textarea
                  id="previous_surgeries"
                  value={editedData.previous_surgeries || ''}
                  onChange={(e) => updateField('previous_surgeries', e.target.value)}
                  placeholder="Liste cirugías o procedimientos previos..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Lifestyle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estilo de Vida</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="smoking"
                    checked={editedData.smoking}
                    onCheckedChange={(checked) => updateField('smoking', checked)}
                  />
                  <Label htmlFor="smoking">Fumador</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="alcohol"
                    checked={editedData.alcohol}
                    onCheckedChange={(checked) => updateField('alcohol', checked)}
                  />
                  <Label htmlFor="alcohol">Consume alcohol</Label>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sleep_hours">Horas de sueño</Label>
                  <Input
                    id="sleep_hours"
                    type="number"
                    value={editedData.sleep_hours || ''}
                    onChange={(e) => updateField('sleep_hours', e.target.value)}
                    min="0"
                    max="24"
                  />
                </div>
                
                <div>
                  <Label htmlFor="stress_level">Nivel de estrés (1-10)</Label>
                  <Input
                    id="stress_level"
                    type="number"
                    value={editedData.stress_level || ''}
                    onChange={(e) => updateField('stress_level', e.target.value)}
                    min="1"
                    max="10"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="exercise">Ejercicio</Label>
                <Textarea
                  id="exercise"
                  value={editedData.exercise || ''}
                  onChange={(e) => updateField('exercise', e.target.value)}
                  placeholder="Describa su rutina de ejercicio..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Recomendaciones Médicas
                <Button onClick={addRecommendation} size="sm" variant="outline">
                  Agregar Recomendación
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editedData.recommendations?.map((rec: any, index: number) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium">Recomendación {index + 1}</h4>
                    <Button
                      onClick={() => removeRecommendation(index)}
                      size="sm"
                      variant="destructive"
                    >
                      Eliminar
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Categoría</Label>
                      <Input
                        value={rec.category || ''}
                        onChange={(e) => updateRecommendation(index, 'category', e.target.value)}
                        placeholder="Ej: Pre-operatorio, Post-operatorio"
                      />
                    </div>
                    
                    <div>
                      <Label>Prioridad</Label>
                      <Select value={rec.priority || 'medium'} onValueChange={(value) => updateRecommendation(index, 'priority', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="medium">Media</SelectItem>
                          <SelectItem value="low">Baja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Título</Label>
                    <Input
                      value={rec.title || ''}
                      onChange={(e) => updateRecommendation(index, 'title', e.target.value)}
                      placeholder="Título de la recomendación"
                    />
                  </div>
                  
                  <div>
                    <Label>Descripción</Label>
                    <Textarea
                      value={rec.description || ''}
                      onChange={(e) => updateRecommendation(index, 'description', e.target.value)}
                      placeholder="Descripción detallada de la recomendación"
                    />
                  </div>
                </div>
              ))}
              
              {editedData.recommendations?.length === 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No hay recomendaciones para este paciente. Considere agregar recomendaciones relevantes.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Conversations Summary */}
          {editedData.conversations?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumen de Conversaciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Badge variant="outline">
                  {editedData.conversations.length} mensajes intercambiados con IA
                </Badge>
                
                <div className="max-h-60 overflow-y-auto space-y-3 border rounded-lg p-4">
                  {editedData.conversations.map((conv: any, index: number) => (
                    <div key={index} className="border-b last:border-b-0 pb-2 last:pb-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={conv.role === 'user' ? 'default' : 'secondary'} className="text-xs">
                          {conv.role === 'user' ? 'Paciente' : 'IA Médica'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(conv.created_at), "PPp", { locale: es })}
                        </span>
                      </div>
                      <p className="text-sm">{conv.content}</p>
                    </div>
                  ))}
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Este resumen se incluirá automáticamente en el PDF
                </p>
              </CardContent>
            </Card>
          )}

          {/* Consents Summary (Read-only) */}
          {editedData.consents?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estado de Consentimientos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {editedData.consents.map((consent: any, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge variant={consent.accepted ? "default" : "destructive"}>
                        {consent.accepted ? 'Aceptado' : 'Rechazado'}
                      </Badge>
                      <span className="text-sm">{consent.consent_type}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Separator className="my-6" />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Validar y Descargar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};