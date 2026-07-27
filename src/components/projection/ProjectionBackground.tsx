import { useEffect } from 'react'
import type { ProjectionState, ProjectionTheme } from '@/types'
import { getYoutubeId } from '@/utils/youtube'

// ── movidos verbatim desde ProjectionWindow.tsx ──
function loadYoutubeAPI(callback: () => void) {
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

function YoutubePlayerContainer({ url, ytPlayerRef, objectFit }: { url: string; ytPlayerRef: React.MutableRefObject<any>; objectFit: 'cover' | 'contain' | 'fill' }) {
  const containerId = 'youtube-player-element';
  const videoId = getYoutubeId(url);

  useEffect(() => {
    if (!videoId) return;

    let destroyed = false;
    let player: any = null;

    loadYoutubeAPI(() => {
      if (destroyed) return;

      player = new (window as any).YT.Player(containerId, {
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
          mute: 0,
        },
        events: {
          onReady: (event: any) => {
            if (destroyed) return;
            ytPlayerRef.current = event.target;
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
        player.destroy();
      }
      ytPlayerRef.current = null;
    };
  }, [videoId, ytPlayerRef]);

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
        <div id={containerId} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

type Props = {
  theme: ProjectionTheme
  media?: ProjectionState['media'] | null
  filter?: string
} & (
  | { variant: 'preview'; mediaVideoRef?: never; ytPlayerRef?: never }
  | { variant: 'live'; mediaVideoRef?: React.Ref<HTMLVideoElement>; ytPlayerRef: React.MutableRefObject<any> }
)

export default function ProjectionBackground(props: Props) {
  const { theme, media, variant, filter } = props
  const bgFilter = filter ?? `blur(${theme.backgroundBlur || 0}px)`
  const bgTransform = theme.backgroundBlur ? 'scale(1.05)' : 'none'
  const bg =
    theme.backgroundType === 'image' && theme.backgroundImageUrl
      ? `url(${theme.backgroundImageUrl}) center/cover no-repeat`
      : theme.backgroundType === 'color' || !theme.backgroundType
        ? theme.background
        : '#000'

  const fit = media
    ? media.objectFit || (media.isBackgroundMode ? 'fill' : 'contain')
    : 'contain'

  const videoLayerStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
    zIndex: 1, filter: bgFilter, transform: bgTransform,
  }

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, filter: bgFilter, transform: bgTransform, background: bg }} />

      {theme.backgroundType === 'video' && theme.backgroundVideoUrl && (
        // El preview del operador se conforma con la miniatura: montar el video aquí abriría
        // una segunda descarga del mismo MP4 en paralelo con la ventana de proyección, y las
        // dos se reparten el ancho de banda. Sin miniatura (videos propios) cae al video.
        variant === 'preview' && theme.backgroundThumbnail ? (
          <img src={theme.backgroundThumbnail} alt="" style={videoLayerStyle} />
        ) : (
          <video
            key={theme.backgroundVideoUrl}
            src={theme.backgroundVideoUrl}
            autoPlay muted loop playsInline
            style={videoLayerStyle}
          />
        )
      )}

      <div style={{ position: 'absolute', inset: 0, zIndex: 5, backgroundColor: `rgba(0,0,0,${theme.backgroundOverlayOpacity ?? 0.3})` }} />

      {media && (
        <div
          data-testid="media-layer"
          style={{
            position: 'absolute', inset: 0, zIndex: media.isBackgroundMode ? 2 : 20,
            background: media.isBackgroundMode ? 'transparent' : '#000',
            filter: media.isBackgroundMode ? bgFilter : 'none',
            transform: media.isBackgroundMode ? bgTransform : 'none',
          }}
        >
          {media.type === 'video' ? (
            <video
              key={media.url}
              ref={props.variant === 'live' ? props.mediaVideoRef : undefined}
              src={media.url}
              autoPlay loop playsInline
              muted={variant === 'preview'}
              style={{ width: '100%', height: '100%', objectFit: fit }}
            />
          ) : media.type === 'youtube' ? (
            props.variant === 'live' ? (
              <YoutubePlayerContainer url={media.url} ytPlayerRef={props.ytPlayerRef} objectFit={fit} />
            ) : (
              <img src={`https://img.youtube.com/vi/${getYoutubeId(media.url)}/hqdefault.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: fit }} />
            )
          ) : (
            <img src={media.url} alt="" style={{ width: '100%', height: '100%', objectFit: fit }} />
          )}
        </div>
      )}
    </>
  )
}
