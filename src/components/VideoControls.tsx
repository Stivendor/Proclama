import { Play, Pause, RotateCcw, FastForward } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectionStore } from '@/stores'

export default function VideoControls() {
  const { media, mediaStatus, sendMediaCommand } = useProjectionStore(useShallow(s => ({
    media: s.state.media,
    mediaStatus: s.state.mediaStatus,
    sendMediaCommand: s.sendMediaCommand
  })))

  if (!media || (media.type !== 'video' && media.type !== 'youtube')) return null

  const currentTime = mediaStatus?.currentTime ?? 0
  const duration = mediaStatus?.duration ?? 0
  const isPlaying = mediaStatus?.isPlaying ?? false

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    sendMediaCommand('seek', value)
  }

  return (
    <div className="video-controls">
      <div className="video-controls-header">
        <span className="video-name">{media.name || media.url.split('/').pop()}</span>
      </div>
      
      <div className="video-timeline-row">
        <span className="time-label">{formatTime(currentTime)}</span>
        <input 
          type="range" 
          min={0} 
          max={duration || 100} 
          step={0.1}
          value={currentTime} 
          onChange={handleSeek}
          className="video-seek-bar"
        />
        <span className="time-label">{formatTime(duration)}</span>
      </div>

      <div className="video-actions-row">
        <button className="btn-video-action" onClick={() => sendMediaCommand('seek', Math.max(0, currentTime - 5))}>
           <RotateCcw size={16} />
        </button>
        <button 
          className="btn-video-play" 
          onClick={() => sendMediaCommand(isPlaying ? 'pause' : 'play')}
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        <button className="btn-video-action" onClick={() => sendMediaCommand('seek', Math.min(duration, currentTime + 5))}>
           <FastForward size={16} />
        </button>
      </div>

      <style>{`
        .video-controls {
          background: var(--bg-elevated);
          border: 1px solid var(--gold-dim);
          border-radius: var(--radius-sm);
          padding: 12px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .video-name { font-size: 11px; font-weight: 600; color: var(--gold); text-transform: uppercase; letter-spacing: 0.5px; }
        .video-timeline-row { display: flex; align-items: center; gap: 8px; }
        .time-label { font-size: 10px; font-family: monospace; color: var(--text-muted); min-width: 30px; }
        .video-seek-bar { 
          flex: 1; height: 4px; accent-color: var(--gold); cursor: pointer;
          background: rgba(255,255,255,0.1); border-radius: 2px;
        }
        .video-actions-row { display: flex; align-items: center; justify-content: center; gap: 16px; }
        .btn-video-play {
          width: 40px; height: 40px; border-radius: 50%;
          background: var(--gold); color: black; border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: transform 0.15s;
        }
        .btn-video-play:hover { transform: scale(1.1); background: #f0c541; }
        .btn-video-action {
          background: none; border: none; color: var(--text-muted);
          cursor: pointer; transition: color 0.15s;
        }
        .btn-video-action:hover { color: var(--text-primary); }
      `}</style>
    </div>
  )
}
