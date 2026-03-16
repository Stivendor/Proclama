import { useRef, useCallback, useEffect } from 'react'
import { useAppStore, useProjectionStore } from '@/stores'
import { captureAudioSample, recognizeAudio } from '@/services/acrcloud'
import { fetchLyrics } from '@/services/genius'
import { cleanLyricsText } from '@/services/lyricsParser'
import { db } from '@/db'
import { createSong, updateSong } from '@/services/supabase'

const CAPTURE_DURATION_MS = 10_000
const AUTO_INTERVAL_MS = 15_000

export function useAudioRecognition() {
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isCapturingRef = useRef(false)

  const { settings, recognitionStatus, setRecognitionStatus, setDetectedSong } = useAppStore()
  const { loadSong } = useProjectionStore()

  const stopListening = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    isCapturingRef.current = false
    setRecognitionStatus('idle')
    setDetectedSong(null)
    intervalRef.current = null
  }, [setRecognitionStatus, setDetectedSong])

  const performRecognition = useCallback(async () => {
    if (!streamRef.current || isCapturingRef.current) return
    if (!settings.acrcloudHost || !settings.acrcloudAccessKey) return

    isCapturingRef.current = true
    setRecognitionStatus('detecting')

    try {
      const blob = await captureAudioSample(streamRef.current, CAPTURE_DURATION_MS)
      const result = await recognizeAudio(blob, {
        host: settings.acrcloudHost,
        accessKey: settings.acrcloudAccessKey,
        accessSecret: settings.acrcloudAccessSecret
      })

      if (!result || result.confidence < settings.recognitionConfidenceThreshold) {
        setRecognitionStatus('not_found')
        setDetectedSong(null)
        setTimeout(() => setRecognitionStatus('listening'), 2000)
        return
      }

      setDetectedSong({ title: result.title, artist: result.artist, confidence: result.confidence })
      setRecognitionStatus('found')

      // 1. Buscar en BD local primero
      const matches = await db.songs
        .filter(s =>
          s.title.toLowerCase().includes(result.title.toLowerCase()) ||
          result.title.toLowerCase().includes(s.title.toLowerCase())
        )
        .toArray()

      if (matches.length > 0) {
        // ✅ Encontrada en BD local
        const song = matches[0]
        if (settings.recognitionMode === 'automatic') {
          loadSong(song)
          const newUsage = (song.usageCount || 0) + 1
          if (song.id != null) {
            await updateSong(song.id, { usageCount: newUsage })
            await db.songs.update(song.id, { usageCount: newUsage })
          }
        }
        // En modo 'assisted' el usuario confirma en la UI
        return
      }

      // 2. No está en BD — buscar letra en internet automáticamente
      setRecognitionStatus('detecting') // reutilizamos para indicar "buscando letra..."
      const rawLyrics = await fetchLyrics(result.artist, result.title)

      if (rawLyrics) {
        const lyrics = cleanLyricsText(rawLyrics)
        const now = new Date()
        const payload = {
          title: result.title,
          artist: result.artist,
          lyrics,
          key: '',
          tags: [],
          language: 'Español',
          usageCount: 1,
          createdAt: now,
          updatedAt: now
        }
        const created = await createSong(payload)
        const newSongId = created ? await db.songs.add(created) : await db.songs.add(payload)
        const newSong = await db.songs.get(newSongId)
        if (newSong) {
          if (settings.recognitionMode === 'automatic') {
            loadSong(newSong)
          }
          // Actualizar el detectedSong para que el usuario pueda confirmar en modo assisted
          setDetectedSong({ title: result.title, artist: result.artist, confidence: result.confidence })
        }
        setRecognitionStatus('found')
      } else {
        // No se encontró letra en ninguna fuente — el operador puede buscarla manualmente
        setRecognitionStatus('not_found')
        setTimeout(() => setRecognitionStatus('listening'), 3000)
      }

    } catch (err) {
      console.error('Error en reconocimiento:', err)
      setRecognitionStatus('error')
      setTimeout(() => setRecognitionStatus('listening'), 3000)
    } finally {
      isCapturingRef.current = false
    }
  }, [settings, loadSong, setRecognitionStatus, setDetectedSong])

  const startListening = useCallback(async (deviceId?: string) => {
    try {
      stopListening()
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          : { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      }
      streamRef.current = await navigator.mediaDevices.getUserMedia(constraints)
      setRecognitionStatus('listening')
      performRecognition()
      intervalRef.current = setInterval(performRecognition, AUTO_INTERVAL_MS)
    } catch (err) {
      console.error('Error accediendo al micrófono:', err)
      setRecognitionStatus('error')
    }
  }, [stopListening, setRecognitionStatus, performRecognition])

  useEffect(() => () => stopListening(), [stopListening])

  return { startListening, stopListening, recognitionStatus, performRecognition }
}

export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter(d => d.kind === 'audioinput')
}
