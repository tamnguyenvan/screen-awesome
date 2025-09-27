import React, { useEffect, useMemo, useRef, memo, useState } from 'react';
import { useEditorStore, usePlaybackState } from '../../store/editorStore';
import { calculateZoomTransform } from '../../lib/transform';
import { Film, Play, Pause, Fullscreen, Shrink } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { cn, formatTime } from '../../lib/utils';
import Slider from '../ui/slider';
import { Button } from '../ui/button';

const generateBackgroundStyle = (backgroundState: ReturnType<typeof useEditorStore.getState>['frameStyles']['background']) => {
  switch (backgroundState.type) {
    case 'color':
      return { background: backgroundState.color || '#ffffff' };
    case 'gradient': {
      const start = backgroundState.gradientStart || '#000000';
      const end = backgroundState.gradientEnd || '#ffffff';
      const direction = backgroundState.gradientDirection || 'to right';
      const gradient = direction.includes('circle')
        ? `radial-gradient(${direction}, ${start}, ${end})`
        : `linear-gradient(${direction}, ${start}, ${end})`;
      return { background: gradient };
    }
    case 'image':
    case 'wallpaper':
      return {
        backgroundImage: `url(${backgroundState.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    default:
      return { background: 'oklch(0.2077 0.0398 265.7549)' };
  }
};

export const Preview = memo(({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement> }) => {
  const { frameStyles, videoUrl, aspectRatio, videoDimensions, cutRegions,
    webcamVideoUrl, webcamPosition, isWebcamVisible, webcamStyles,
    duration, currentTime, togglePlay,
    isPreviewFullScreen, togglePreviewFullScreen
  } = useEditorStore(
    useShallow(state => ({
      frameStyles: state.frameStyles,
      videoUrl: state.videoUrl,
      aspectRatio: state.aspectRatio,
      videoDimensions: state.videoDimensions,
      cutRegions: state.cutRegions,
      webcamVideoUrl: state.webcamVideoUrl,
      webcamPosition: state.webcamPosition,
      isWebcamVisible: state.isWebcamVisible,
      webcamStyles: state.webcamStyles,
      duration: state.duration,
      currentTime: state.currentTime,
      togglePlay: state.togglePlay,
      isPreviewFullScreen: state.isPreviewFullScreen,
      togglePreviewFullScreen: state.togglePreviewFullScreen,
    })));

  const { setPlaying, setCurrentTime, setDuration, setVideoDimensions } = useEditorStore(
    useShallow(state => ({
      setPlaying: state.setPlaying,
      setCurrentTime: state.setCurrentTime,
      setDuration: state.setDuration,
      setVideoDimensions: state.setVideoDimensions,
    })));
  const { isPlaying, isCurrentlyCut } = usePlaybackState();

  const [previewWidth, setPreviewWidth] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const frameContainerRef = useRef<HTMLDivElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setPreviewWidth(entries[0].contentRect.width);
      }
    });

    if (previewContainerRef.current) {
      observer.observe(previewContainerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const webcamVideo = webcamVideoRef.current;
    if (isPlaying) {
      video.play();
      webcamVideo?.play();
    } else {
      video.pause();
      webcamVideo?.pause();
    }
  }, [isPlaying, videoRef]);

  useEffect(() => {
    let animationFrameId: number;
    const updateTransform = () => {
      if (!frameContainerRef.current || !videoRef.current) return;
      const liveCurrentTime = videoRef.current.currentTime;
      
      const { scale, translateX, translateY, transformOrigin } = calculateZoomTransform(liveCurrentTime);

      const shadowBlur = frameStyles.shadow * 1.5;
      const shadowOffsetY = frameStyles.shadow;
      
      const style = frameContainerRef.current.style;
      style.filter = `drop-shadow(0px ${shadowOffsetY}px ${shadowBlur}px ${frameStyles.shadowColor})`;
      
      style.transformOrigin = transformOrigin;
      style.transform = `scale(${scale}) translate(${translateX}%, ${translateY}%)`;
    };
    updateTransform();
    const animate = () => {
      updateTransform();
      animationFrameId = requestAnimationFrame(animate);
    };
    if (isPlaying) {
      animate();
    } else {
      updateTransform();
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, videoRef, frameStyles.shadow, frameStyles.shadowColor]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    isPlaying ? video.play() : video.pause();
  }, [isPlaying, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying && isCurrentlyCut) {
      const allCutRegions = Object.values(useEditorStore.getState().cutRegions);
      const activeCutRegion = allCutRegions.find(
        r => video.currentTime >= r.startTime && video.currentTime < (r.startTime + r.duration)
      );
      if (activeCutRegion) {
        video.currentTime = activeCutRegion.startTime + activeCutRegion.duration;
        setCurrentTime(video.currentTime);
      }
    }
  }, [isCurrentlyCut, isPlaying, videoRef, setCurrentTime]);

  const backgroundStyle = useMemo(() => generateBackgroundStyle(frameStyles.background), [frameStyles.background]);
  const cssAspectRatio = useMemo(() => aspectRatio.replace(':', ' / '), [aspectRatio]);

  const { videoDisplayWidth, videoDisplayHeight } = useMemo(() => {
    if (!videoDimensions.width || !videoDimensions.height) {
      return { videoDisplayWidth: '100%', videoDisplayHeight: '100%' };
    }
    const [vpWidth, vpHeight] = aspectRatio.split(':').map(Number);
    const viewportAspectRatio = vpWidth / vpHeight;
    const nativeVideoAspectRatio = videoDimensions.width / videoDimensions.height;
    if (nativeVideoAspectRatio > viewportAspectRatio) {
      return { videoDisplayWidth: '100%', videoDisplayHeight: 'auto' };
    } else {
      return { videoDisplayWidth: 'auto', videoDisplayHeight: '100%' };
    }
  }, [aspectRatio, videoDimensions]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const endTrimRegion = Object.values(cutRegions).find(r => r.trimType === 'end');
    if (endTrimRegion && videoRef.current.currentTime >= endTrimRegion.startTime) {
      videoRef.current.currentTime = endTrimRegion.startTime;
      videoRef.current.pause();
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.currentTime = videoRef.current.currentTime;
    }
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight });
    }
  };

  const glassyFrameStyle = useMemo(() => ({
    padding: `${frameStyles.borderWidth}px`,
    borderRadius: `${frameStyles.borderRadius}px`,
    background: `
      linear-gradient(135deg, 
        rgba(255, 255, 255, 0.25) 0%, 
        rgba(255, 255, 255, 0.15) 50%, 
        rgba(255, 255, 255, 0.05) 100%
      ),
      radial-gradient(ellipse at top left, 
        rgba(255, 255, 255, 0.2) 0%, 
        transparent 50%
      )
    `,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: `1px solid rgba(255, 255, 255, 0.3)`,
    boxShadow: `
      inset 0 1px 0 0 rgba(255, 255, 255, 0.4),
      inset 0 -1px 0 0 rgba(255, 255, 255, 0.1),
      0 0 0 1px rgba(0, 0, 0, 0.1),
      0 2px 10px -2px rgba(0, 0, 0, 0.2),
      0 8px 25px -5px rgba(0, 0, 0, 0.1)
    `,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  }), [frameStyles.borderWidth, frameStyles.borderRadius]);

  const videoStyle = useMemo(() => ({
    borderRadius: `${Math.max(0, frameStyles.borderRadius - frameStyles.borderWidth)}px`,
    position: 'relative' as const,
    zIndex: 1,
  }), [frameStyles.borderRadius, frameStyles.borderWidth]);

  const webcamDynamicStyle = useMemo(() => {
    const shadowBlur = webcamStyles.shadow * 1.5;
    const shadowOffsetY = webcamStyles.shadow;
    return {
      height: `${webcamStyles.size}%`,
      filter: `drop-shadow(0px ${shadowOffsetY}px ${shadowBlur}px ${webcamStyles.shadowColor})`,
    };
  }, [webcamStyles]);

  const webcamWrapperClasses = cn(
    'absolute z-20 aspect-square overflow-hidden rounded-[35%]',
    'transition-all duration-300 ease-in-out',
    {
      'top-4 left-4': webcamPosition.pos === 'top-left',
      'top-4 right-4': webcamPosition.pos === 'top-right',
      'bottom-4 left-4': webcamPosition.pos === 'bottom-left',
      'bottom-4 right-4': webcamPosition.pos === 'bottom-right',
      'opacity-0 scale-95': !isWebcamVisible,
      'opacity-100 scale-100': isWebcamVisible,
    }
  );
  
  const handleScrub = (value: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div
        id="preview-container"
        ref={previewContainerRef}
        className="transition-all duration-300 ease-out flex items-center justify-center relative overflow-hidden"
        style={{ ...backgroundStyle, aspectRatio: cssAspectRatio, maxWidth: '100%', maxHeight: '100%' }}
      >
        <div className="w-full h-full flex items-center justify-center relative" style={{ padding: `${frameStyles.padding}%` }}>
          {videoUrl ? (
            <>
              <div
                ref={frameContainerRef}
                className="relative"
                style={{
                  width: videoDisplayWidth,
                  height: videoDisplayHeight,
                  aspectRatio: videoDimensions.width / videoDimensions.height,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  transition: 'transform 50ms linear',
                }}
              >
                <div
                  className="w-full h-full transition-all duration-300 ease-out"
                  style={glassyFrameStyle}
                >
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-cover block relative z-10 transition-all duration-200"
                    style={videoStyle}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                  />
                </div>
              </div>

              {webcamVideoUrl && (
                <div className={webcamWrapperClasses} style={webcamDynamicStyle}>
                  <video
                    ref={webcamVideoRef}
                    src={webcamVideoUrl}
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-50/10 to-slate-100/5 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center text-white/70 gap-4 backdrop-blur-sm">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center backdrop-blur-md border border-white/20">
                <Film className="w-8 h-8 text-white/70" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium mb-1 text-white/80">No project loaded</p>
                <p className="text-sm text-white/50">Load a project to begin editing</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {videoUrl && (
        <div
          className="w-full"
          style={{ width: previewWidth > 0 ? previewWidth : 'auto', maxWidth: '100%' }}
        >
          <div className="bg-card/80 backdrop-blur-xl border border-border/30 rounded-bl-xl rounded-br-xl px-3 py-1.5 flex items-center gap-3 shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="flex-shrink-0 text-foreground/70 hover:text-foreground h-8 w-8"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <div className="flex items-baseline gap-1.5 text-xs font-mono tabular-nums text-muted-foreground">
              <span>{formatTime(currentTime, true)}</span>
              <span>/</span>
              <span>{formatTime(duration, true)}</span>
            </div>
            <Slider
              min={0}
              max={duration}
              step={0.01}
              value={currentTime}
              onChange={handleScrub}
              disabled={duration === 0}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePreviewFullScreen}
              className="flex-shrink-0 text-foreground/70 hover:text-foreground h-8 w-8"
            >
              {isPreviewFullScreen ? <Shrink className="w-4 h-4" /> : <Fullscreen className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
Preview.displayName = 'Preview';