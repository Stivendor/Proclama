import { useState, useEffect } from 'react'
import { Mic, MicOff, Radio, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useAudioRecognition, getAudioInputDevices } from '@/hooks/useAudioRecognition'
import { useAppStore, useProjectionStore } from '@/stores'
import { db } from '@/db'
import { updateSong } from '@/services/supabase'

export default function RecognitionPanel() {
  const { settings, recognitionStatus, detectedSong, setDetectedSong, setRecognitionStatus } = useAppStore()
  const { loadSong } = useProjectionStore()
  const { startListening, stopListening } = useAudioRecognition()

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [isListening, setIsListening] = useState(false)

  useEffect(() => {
    getAudioInputDevices().then(d => setDevices(d))
  }, [])

  const toggle = async () => {
    if (isListening) {
      stopListening()
      setIsListening(false)
    } else {
      await startListening(selectedDevice || undefined)
      setIsListening(true)
    }
  }

  const handleConfirm = async () => {
    if (!detectedSong) return
    const matches = await db.songs
      .filter(s => s.title.toLowerCase().includes(detectedSong.title.toLowerCase()))
      .toArray()
    if (matches.length > 0) {
      const song = matches[0]
      loadSong(song)
      if (song.id != null) {
        const newUsage = (song.usageCount || 0) + 1
        await updateSong(song.id, { usageCount: newUsage })
        await db.songs.update(song.id, { usageCount: newUsage })
      }
    }
    setDetectedSong(null)
    setRecognitionStatus('listening')
  }

  const noConfig = !settings.acrcloudHost || !settings.acrcloudAccessKey

  return (
    <div className="recognition-panel">
      <div className="recognition-header">
        <Radio size={16} />
        <span>Reconocimiento</span>
      </div>

      {noConfig && (
        <div className="recognition-warning">
          <AlertCircle size={14} />
          Configura ACRCloud en Ajustes
        </div>
      )}

      {/* Selector de dispositivo */}
      {devices.length > 1 && (
        <select
          className="device-select"
          value={selectedDevice}
          onChange={e => setSelectedDevice(e.target.value)}
          disabled={isListening}
        >
          <option value="">Micrófono predeterminado</option>
          {devices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Micrófono ${d.deviceId.slice(0, 8)}`}</option>
          ))}
        </select>
      )}

      {/* Botón on/off */}
      <button
        className={`btn-recognition ${isListening ? 'active' : ''}`}
        onClick={toggle}
        disabled={noConfig}
      >
        {isListening ? <><MicOff size={16} /> Detener escucha</> : <><Mic size={16} /> Iniciar escucha</>}
      </button>

      {/* Visualizador de estado */}
      {isListening && (
        <div className={`recognition-status status-${recognitionStatus}`}>
          {recognitionStatus === 'listening' && (
            <><div className="pulse-dot" /> Escuchando...</>
          )}
          {recognitionStatus === 'detecting' && (
            <><div className="spin-dot" /> Analizando audio...</>
          )}
          {recognitionStatus === 'not_found' && (
            <><XCircle size={14} /> Canción no identificada</>
          )}
          {recognitionStatus === 'error' && (
            <><AlertCircle size={14} /> Error de conexión</>
          )}
          {recognitionStatus === 'found' && (
            <><CheckCircle size={14} /> ¡Canción encontrada!</>
          )}
        </div>
      )}

      {/* Canción detectada para confirmar (modo assisted) */}
      {detectedSong && settings.recognitionMode === 'assisted' && (
        <div className="detected-song">
          <div className="detected-title">{detectedSong.title}</div>
          <div className="detected-artist">{detectedSong.artist}</div>
          <div className="detected-confidence">Confianza: {detectedSong.confidence}%</div>
          <div className="detected-actions">
            <button className="btn-confirm" onClick={handleConfirm}>
              <CheckCircle size={14} /> Proyectar
            </button>
            <button className="btn-dismiss" onClick={() => setDetectedSong(null)}>
              <XCircle size={14} /> Ignorar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
