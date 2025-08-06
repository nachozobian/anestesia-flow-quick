import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// AWS Signature V4 signing function
async function signRequest(method: string, url: string, body: string, region: string, service: string) {
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured')
  }

  const encoder = new TextEncoder()
  
  // Create canonical request
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '')
  const date = timestamp.substr(0, 8)
  
  const canonicalUri = new URL(url).pathname
  const canonicalQuerystring = ''
  const canonicalHeaders = `host:${new URL(url).host}\nx-amz-date:${timestamp}\n`
  const signedHeaders = 'host;x-amz-date'
  
  const payloadHash = await crypto.subtle.digest('SHA-256', encoder.encode(body))
    .then(buffer => Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0')).join(''))

  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${date}/${region}/${service}/aws4_request`
  const canonicalRequestHash = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest))
    .then(buffer => Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0')).join(''))
  
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${canonicalRequestHash}`
  
  // Calculate signature
  const getSignatureKey = async (key: string, dateStamp: string, regionName: string, serviceName: string) => {
    const kDate = await crypto.subtle.importKey('raw', encoder.encode('AWS4' + key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(k => crypto.subtle.sign('HMAC', k, encoder.encode(dateStamp)))
    const kRegion = await crypto.subtle.importKey('raw', kDate, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(k => crypto.subtle.sign('HMAC', k, encoder.encode(regionName)))
    const kService = await crypto.subtle.importKey('raw', kRegion, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(k => crypto.subtle.sign('HMAC', k, encoder.encode(serviceName)))
    const kSigning = await crypto.subtle.importKey('raw', kService, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(k => crypto.subtle.sign('HMAC', k, encoder.encode('aws4_request')))
    return kSigning
  }
  
  const signingKey = await getSignatureKey(secretAccessKey, date, region, service)
  const signature = await crypto.subtle.importKey('raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(k => crypto.subtle.sign('HMAC', k, encoder.encode(stringToSign)))
    .then(buffer => Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0')).join(''))
  
  // Create authorization header
  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  
  return {
    'Authorization': authorization,
    'X-Amz-Date': timestamp,
    'Content-Type': 'application/json'
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { message, patientData, conversationHistory = [] } = await req.json()
    
    if (!message) {
      throw new Error('Message is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get patient medical responses for additional context
    let patientResponses = null
    if (patientData?.id) {
      const { data } = await supabase
        .from('patient_responses')
        .select('*')
        .eq('patient_id', patientData.id)
        .single()
      
      patientResponses = data
    }

    // Prepare the request for Amazon Bedrock
    const region = Deno.env.get('AWS_REGION') || 'us-east-1'
    const modelId = 'anthropic.claude-3-haiku-20240307-v1:0' // Claude 3 Haiku for medical consultation
    
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`
    
    // Prepare context for medical consultation
    const systemPrompt = `Eres un asistente médico especializado en evaluaciones preanestésicas. Tu rol es:

1. Realizar preguntas relevantes sobre el historial médico del paciente
2. Evaluar factores de riesgo anestésico
3. Identificar contraindicaciones o precauciones
4. Generar recomendaciones basadas en las respuestas del paciente

Información del paciente:
- Nombre: ${patientData?.name || 'No disponible'}
- Procedimiento: ${patientData?.procedure || 'No especificado'}
- Fecha del procedimiento: ${patientData?.procedure_date || 'No especificada'}
- DNI: ${patientData?.dni || 'No disponible'}

${patientResponses ? `
Información médica previa del formulario:
- Alergias: ${patientResponses.has_allergies ? (patientResponses.allergies || 'Sí, pero no especificadas') : 'No'}
- Medicamentos actuales: ${patientResponses.current_medications || 'No especificados'}
- Historia médica: ${patientResponses.medical_history || 'No especificada'}
- Cirugías previas: ${patientResponses.previous_surgeries || 'No especificadas'}
- Historia familiar: ${patientResponses.family_history || 'No especificada'}
- Fumador: ${patientResponses.smoking ? 'Sí' : 'No'}
- Consumo de alcohol: ${patientResponses.alcohol ? 'Sí' : 'No'}
- Ejercicio: ${patientResponses.exercise || 'No especificado'}
- Dieta: ${patientResponses.diet || 'No especificada'}
- Horas de sueño: ${patientResponses.sleep_hours || 'No especificado'}
- Nivel de estrés (1-10): ${patientResponses.stress_level || 'No especificado'}
- Preocupaciones adicionales: ${patientResponses.additional_concerns || 'Ninguna'}
- Contacto de emergencia: ${patientResponses.emergency_contact_name || 'No especificado'}
` : ''}

Mantén un tono profesional pero empático. Basándote en la información del formulario, haz preguntas específicas y relevantes para completar la evaluación preanestésica. Si identificas factores de riesgo, profundiza en esos temas.`

    // Build conversation messages
    const messages = [
      { role: 'user', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ]

    const requestBody = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1000,
      temperature: 0.7,
      messages: messages
    })

    console.log('Calling Bedrock with:', { modelId, region })

    // Sign the request
    const headers = await signRequest('POST', url, requestBody, region, 'bedrock')
    
    // Make the request to Bedrock
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: requestBody
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Bedrock API error:', errorText)
      throw new Error(`Bedrock API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('Bedrock response:', result)

    // Extract the response content
    const aiResponse = result.content?.[0]?.text || result.completion || 'No se pudo generar una respuesta'

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in bedrock-chat function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})