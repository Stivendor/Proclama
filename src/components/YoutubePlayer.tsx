import { useEffect, useRef } from 'react'

export function getYoutubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export function loadYoutubeAPI(callback: () => void) {
  if ((window as any).YT && (window as any).YT.Player) {
    callback();
    return;
  }
  
  const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
  if (existingScript) {
    const interval = setInterval(() => {
      if ((window as any).YT && (window as any).YT.Player) {
        clearInterval(interval);
        callback();
      }
    }, 100);
    return;
  }

  const previousCallback = (window as any).onYouTubeIframeAPIReady;
  (window as any).onYouTubeIframeAPIReady = () => {
    if (previousCallback) previousCallback();
    callback();
  };

  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
}

interface YoutubePlayerProps {
  url: string;
  ytPlayerRef?: React.MutableRefObject<any>;
  objectFit: 'cover' | 'contain';
  mute?: boolean;
}

export default function YoutubePlayer({ url, ytPlayerRef, objectFit, mute = false }: YoutubePlayerProps) {
  const videoId = getYoutubeId(url);
  const containerId = useRef(`youtube-player-${crypto.randomUUID()}`);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!videoId) return;

    let destroyed = false;
    let player: any = null;

    loadYoutubeAPI(() => {
      if (destroyed) return;
      
      const el = document.getElementById(containerId.current);
      if (!el) return;

      player = new (window as any).YT.Player(containerId.current, {
        width: '100%',
        height: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          mute: mute ? 1 : 0,
        },
        events: {
          onReady: (event: any) => {
            console.log("YouTube Player Ready. Video ID:", videoId, "Muted:", mute);
            if (destroyed) return;
            playerRef.current = event.target;
            if (ytPlayerRef) {
              ytPlayerRef.current = event.target;
            }
            if (mute) {
              event.target.mute();
            } else {
              event.target.unMute();
            }
            event.target.playVideo();
          },
          onStateChange: (event: any) => {
            if (event.data === (window as any).YT.PlayerState.ENDED) {
              event.target.playVideo();
            }
          }
        }
      });
    });

    return () => {
      destroyed = true;
      if (player && typeof player.destroy === 'function') {
        try {
          player.destroy();
        } catch {}
      }
      if (ytPlayerRef) {
        ytPlayerRef.current = null;
      }
    };
  }, [videoId, ytPlayerRef, mute]);

  if (!videoId) {
    return (
      <div style={{ color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        Enlace de YouTube no válido
      </div>
    );
  }

  const isCover = objectFit === 'cover';
  
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#000'
    }}>
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          ...(isCover ? {
            width: '177.77777778vh',
            height: '56.25vw',
            minWidth: '100%',
            minHeight: '100%',
          } : {
            width: '100%',
            height: '100%',
          })
        }}
      >
        <div id={containerId.current} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}
