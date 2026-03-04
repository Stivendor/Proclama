import type { RecognitionResult } from '@/types'

interface ACRCloudConfig {
  host: string
  accessKey: string
  accessSecret: string
}

/**
 * Genera la firma HMAC-SHA1 para ACRCloud.
 * Se usa Web Crypto API (disponible en todos los navegadores modernos).
 */
async function signACRCloud(
  accessKey: string,
  accessSecret: string,
  timestamp: number,
  dataType: string,
  signatureVersion: string
): Promise<string> {
  const stringToSign = ['POST', '/v1/identify', accessKey, dataType, signatureVersion, timestamp].join('\n')
  const encoder = new TextEncoder()
  const keyData = encoder.encode(accessSecret)
  const messageData = encoder.encode(stringToSign)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const signatureArray = Array.from(new Uint8Array(signatureBuffer))
  return btoa(String.fromCharCode(...signatureArray))
}

/**
 * Captura un fragmento de audio del stream del micrófono y lo envía a ACRCloud.
 * Retorna el resultado del reconocimiento o null si no se encontró.
 */
export async function recognizeAudio(
  audioBlob: Blob,
  config: ACRCloudConfig
): Promise<RecognitionResult | null> {
  const timestamp = Math.floor(Date.now() / 1000)
  const dataType = 'audio'
  const signatureVersion = '1'

  const signature = await signACRCloud(
    config.accessKey,
    config.accessSecret,
    timestamp,
    dataType,
    signatureVersion
  )

  const formData = new FormData()
  formData.append('sample', audioBlob, 'sample.wav')
  formData.append('access_key', config.accessKey)
  formData.append('data_type', dataType)
  formData.append('signature_version', signatureVersion)
  formData.append('signature', signature)
  formData.append('sample_bytes', String(audioBlob.size))
  formData.append('timestamp', String(timestamp))

  const response = await fetch(`https://${config.host}/v1/identify`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) throw new Error(`ACRCloud HTTP ${response.status}`)

  const data = await response.json()

  if (data.status?.code !== 0) return null // No match o error

  const music = data.metadata?.music?.[0]
  if (!music) return null

  return {
    title: music.title,
    artist: music.artists?.[0]?.name ?? '',
    confidence: music.score ?? 0,
    externalId: music.acrid
  }
}

/**
 * Hook de captura de audio con MediaRecorder.
 * Graba `durationMs` milisegundos y devuelve el Blob.
 */
export function captureAudioSample(
  stream: MediaStream,
  durationMs = 10000
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Preferir webm/opus; fallback a ogg/opus; fallback a cualquiera
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : ''

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
    const chunks: BlobPart[] = []

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }))
    recorder.onerror = e => reject(e)

    recorder.start()
    setTimeout(() => recorder.stop(), durationMs)
  })
}
