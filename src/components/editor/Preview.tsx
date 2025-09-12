// src/components/editor/Preview.tsx

import React, { useEffect, useMemo, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { calculateZoomTransform } from '../../lib/transform';

interface PreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

const generateBackgroundStyle = (backgroundState: ReturnType<typeof useEditorStore.getState>['frameStyles']['background']) => {
  switch (backgroundState.type) {
    case 'color':
      return { background: backgroundState.color || '#ffffff' };
    case 'gradient':
      return { background: `linear-gradient(145deg, ${backgroundState.gradientStart}, ${backgroundState.gradientEnd})` };
    case 'image':
    case 'wallpaper':
      return {
        backgroundImage: `url(${backgroundState.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    default:
      return { background: '#000000' };
  }
};

export function Preview({ videoRef }: PreviewProps) {
  const {
    frameStyles, videoUrl, isPlaying, setPlaying,
    setCurrentTime, setDuration, aspectRatio, setVideoDimensions,
    videoDimensions
  } = useEditorStore();

  const transformContainerRef = useRef<HTMLDivElement>(null);

  // Vòng lặp render để cập nhật transform (không thay đổi)
  useEffect(() => {
    let animationFrameId: number;

    const updateTransform = () => {
      if (!transformContainerRef.current || !videoRef.current) return;

      // Lấy thời gian trực tiếp từ video element
      const liveCurrentTime = videoRef.current.currentTime;

      // Truyền thời gian trực tiếp vào hàm tính toán
      const { scale, translateX, translateY } = calculateZoomTransform(liveCurrentTime);

      transformContainerRef.current.style.transform = `scale(${scale}) translate(${translateX}%, ${translateY}%)`;
    };

    updateTransform();

    const animate = () => {
      updateTransform();
      animationFrameId = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      animate();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
    // THAY ĐỔI Ở ĐÂY: Xóa 'currentTime' khỏi dependency array
  }, [isPlaying, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    isPlaying ? video.play() : video.pause();
  }, [isPlaying, videoRef]);

  const backgroundStyle = useMemo(() => generateBackgroundStyle(frameStyles.background), [frameStyles.background]);
  const cssAspectRatio = useMemo(() => aspectRatio.replace(':', ' / '), [aspectRatio]);

  // Tính toán aspect ratio của video gốc
  const videoAspectRatio = useMemo(() => {
    if (videoDimensions.height === 0) return 16 / 9; // fallback
    return videoDimensions.width / videoDimensions.height;
  }, [videoDimensions]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      });
    }
  };

  const handlePlay = () => setPlaying(true);
  const handlePause = () => setPlaying(false);

  return (
    // Canvas
    <div
      className="transition-all duration-200 ease-in-out flex items-center justify-center relative"
      style={{
        ...backgroundStyle,
        aspectRatio: cssAspectRatio,
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
      }}
    >
      {/* Padding Container */}
      <div
        className="w-full h-full flex items-center justify-center"
        style={{
          padding: `${frameStyles.padding}%`,
        }}
      >
        {videoUrl ? (
          // Container này giờ sẽ có aspect ratio của video
          <div
            ref={transformContainerRef}
            className="transition-transform duration-100 max-w-full max-h-full" // Bỏ w-full, h-full, thêm max-w/h
            style={{
              aspectRatio: videoAspectRatio, // Đặt aspect ratio của video gốc
              borderRadius: `${frameStyles.borderRadius}px`,
              boxShadow: `0 0 ${frameStyles.shadow * 2}px rgba(0,0,0,0.${frameStyles.shadow})`,
              overflow: 'hidden',
            }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handlePause}
            />
          </div>
        ) : (
          <div className="w-full h-full bg-gray-500/20 flex items-center justify-center text-gray-500">
            <p>Load a project to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}