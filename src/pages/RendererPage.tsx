// src/pages/RendererPage.tsx
import log from 'electron-log/renderer';
import { useEffect, useRef } from 'react';
import { CutRegion, useEditorStore, EditorState, EditorActions } from '../store/editorStore';
import { calculateZoomTransform } from '../lib/transform';
import { ExportSettings } from '../components/editor/ExportModal';

const RESOLUTIONS = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '2k': { width: 2560, height: 1440 },
};

const drawBackground = async (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  backgroundState: ReturnType<typeof useEditorStore.getState>['frameStyles']['background']
) => {
  ctx.clearRect(0, 0, width, height);

  switch (backgroundState.type) {
    case 'color':
      ctx.fillStyle = backgroundState.color || '#000000';
      ctx.fillRect(0, 0, width, height);
      break;
    case 'gradient': {
      const start = backgroundState.gradientStart || '#000000';
      const end = backgroundState.gradientEnd || '#ffffff';
      const direction = backgroundState.gradientDirection || 'to right';
      let gradient;

      if (direction.includes('circle')) {
        gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
      } else {
        const points = {
          'to bottom': [0, 0, 0, height], 'to top': [0, height, 0, 0], 'to right': [0, 0, width, 0],
          'to left': [width, 0, 0, 0], 'to bottom right': [0, 0, width, height], 'to bottom left': [width, 0, 0, height],
          'to top right': [0, height, width, 0], 'to top left': [width, height, 0, 0],
        }[direction] || [0, 0, width, 0];
        gradient = ctx.createLinearGradient(points[0], points[1], points[2], points[3]);
      }

      gradient.addColorStop(0, start);
      gradient.addColorStop(1, end);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'image':
    case 'wallpaper': {
      if (!backgroundState.imageUrl) {
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, width, height); return;
      }
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const imgRatio = img.width / img.height; const canvasRatio = width / height;
          let sx, sy, sWidth, sHeight;
          if (imgRatio > canvasRatio) {
            sHeight = img.height; sWidth = sHeight * canvasRatio;
            sx = (img.width - sWidth) / 2; sy = 0;
          } else {
            sWidth = img.width; sHeight = sWidth / canvasRatio;
            sx = 0; sy = (img.height - sHeight) / 2;
          }
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
          resolve();
        };
        img.onerror = (err) => {
          log.error(`[RendererPage] Failed to load background image: ${img.src}`, err);
          reject(err);
        };

        if (!backgroundState.imageUrl) {
          reject(new Error('No image URL provided'));
          return;
        }
        
        // Use a relative path that Electron's protocol can resolve
        img.src = backgroundState.imageUrl.startsWith('blob:')
          ? backgroundState.imageUrl
          : `media://${backgroundState.imageUrl}`;
      });
      break;
    }
    default:
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, width, height);
  }
};

type RenderStartPayload = {
  projectState: Omit<EditorState, keyof EditorActions>;
  exportSettings: ExportSettings;
}

export function RendererPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    log.info('[RendererPage] Component mounted. Setting up listeners.');

    const cleanup = window.electronAPI.onRenderStart(async ({ projectState, exportSettings }: RenderStartPayload) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      try {
        log.info('[RendererPage] Received "render:start" event.', { exportSettings });

        if (!canvas || !video) throw new Error('Canvas or Video ref is not available.');

        const { resolution, fps } = exportSettings;
        const [ratioW, ratioH] = projectState.aspectRatio.split(':').map(Number);
        const baseHeight = RESOLUTIONS[resolution as keyof typeof RESOLUTIONS].height;
        const aspectValue = ratioW / ratioH;
        let outputWidth = Math.round(baseHeight * aspectValue);
        outputWidth = outputWidth % 2 === 0 ? outputWidth : outputWidth + 1;
        const outputHeight = baseHeight;

        canvas.width = outputWidth;
        canvas.height = outputHeight;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Failed to get 2D context from canvas.');

        // Set state for transform calculations
        useEditorStore.setState(projectState);

        // --- FIX: Wait for video to be ready before starting the loop ---
        await new Promise<void>((resolve, reject) => {
            const onCanPlay = () => {
                video.removeEventListener('canplay', onCanPlay);
                video.removeEventListener('error', onError);
                log.info('[RendererPage] Video is ready to play.');
                resolve();
            };
            const onError = (e: Event) => {
                video.removeEventListener('canplay', onCanPlay);
                video.removeEventListener('error', onError);
                log.error('[RendererPage] Video loading error:', e);
                reject(new Error('Failed to load video for rendering.'));
            };

            video.addEventListener('canplay', onCanPlay);
            video.addEventListener('error', onError);

            video.src = `media://${projectState.videoPath}`;
            video.muted = true;
            video.load(); // Explicitly start loading
        });

        const seek = (time: number): Promise<void> => {
          if (Math.abs(video.currentTime - time) < 0.01) return Promise.resolve();
          return new Promise((resolve, reject) => {
            const onSeeked = () => { video.removeEventListener('seeked', onSeeked); video.removeEventListener('error', onError); resolve(); };
            const onError = (e: Event) => { video.removeEventListener('seeked', onSeeked); video.removeEventListener('error', onError); log.error('[RendererPage] Video seek error:', e); reject(new Error('Failed to seek video')); };
            video.addEventListener('seeked', onSeeked);
            video.addEventListener('error', onError);
            video.currentTime = time;
          });
        };

        const totalFrames = Math.floor(projectState.duration * fps);
        log.info(`[RendererPage] Starting render for ${totalFrames} frames at ${fps} FPS.`);

        if (totalFrames <= 0) {
          log.warn('[RendererPage] No frames to render (duration might be 0). Aborting render.');
          window.electronAPI.finishRender();
          return;
        }

        const cutRegionsArray = Object.values(projectState.cutRegions);

        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
          const currentTime = frameIndex / fps;

          const activeCutRegion = cutRegionsArray.find(
            (r: CutRegion) => currentTime >= r.startTime && currentTime < r.startTime + r.duration
          );

          if (activeCutRegion) {
            const endOfCut = activeCutRegion.startTime + activeCutRegion.duration;
            frameIndex = Math.floor(endOfCut * fps) - 1; // Jump frameIndex to the end of the cut
            continue;
          }

          await seek(currentTime);
          useEditorStore.getState().setCurrentTime(currentTime);
          const state = useEditorStore.getState();

          await drawBackground(ctx, outputWidth, outputHeight, state.frameStyles.background);
          ctx.save();
          
          const paddingPercent = state.frameStyles.padding / 100;
          const availableWidth = outputWidth * (1 - 2 * paddingPercent);
          const availableHeight = outputHeight * (1 - 2 * paddingPercent);
          const videoAspectRatio = state.videoDimensions.width / state.videoDimensions.height;
          let videoDisplayWidth, videoDisplayHeight;
          if (availableWidth / availableHeight > videoAspectRatio) {
            videoDisplayHeight = availableHeight;
            videoDisplayWidth = videoDisplayHeight * videoAspectRatio;
          } else {
            videoDisplayWidth = availableWidth;
            videoDisplayHeight = videoDisplayWidth / videoAspectRatio;
          }
          const paddingX = (outputWidth - videoDisplayWidth) / 2;
          const paddingY = (outputHeight - videoDisplayHeight) / 2;

          ctx.shadowColor = `rgba(0,0,0,${Math.min(state.frameStyles.shadow * 0.015, 0.4)})`;
          ctx.shadowBlur = state.frameStyles.shadow * 1.5;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = state.frameStyles.shadow;
          
          const framePath = new Path2D();
          framePath.roundRect(paddingX, paddingY, videoDisplayWidth, videoDisplayHeight, state.frameStyles.borderRadius);
          ctx.fillStyle = 'rgba(0,0,0,1)';
          ctx.fill(framePath);
          ctx.shadowColor = 'transparent';

          const borderGradient = ctx.createLinearGradient(paddingX, paddingY, paddingX + videoDisplayWidth, paddingY + videoDisplayHeight);
          borderGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
          borderGradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
          ctx.fillStyle = borderGradient;
          ctx.fill(framePath);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.stroke(framePath);

          const borderWidth = state.frameStyles.borderWidth;
          const videoInnerRadius = Math.max(0, state.frameStyles.borderRadius - borderWidth);
          const videoPath = new Path2D();
          videoPath.roundRect(
            paddingX + borderWidth, paddingY + borderWidth, 
            videoDisplayWidth - (borderWidth * 2), videoDisplayHeight - (borderWidth * 2), 
            videoInnerRadius
          );
          ctx.clip(videoPath);

          const { scale, translateX, translateY } = calculateZoomTransform(currentTime);
          const innerVideoWidth = videoDisplayWidth - (borderWidth * 2);
          const innerVideoHeight = videoDisplayHeight - (borderWidth * 2);
          const scaledVideoRenderWidth = innerVideoWidth * scale;
          const scaledVideoRenderHeight = innerVideoHeight * scale;
          const panX = (translateX / 100) * innerVideoWidth;
          const panY = (translateY / 100) * innerVideoHeight;
          const renderX = (paddingX + borderWidth) - (scaledVideoRenderWidth - innerVideoWidth) / 2 + panX;
          const renderY = (paddingY + borderWidth) - (scaledVideoRenderHeight - innerVideoHeight) / 2 + panY;
          ctx.drawImage(video, renderX, renderY, scaledVideoRenderWidth, scaledVideoRenderHeight);
          
          ctx.restore();

          const imageData = ctx.getImageData(0, 0, outputWidth, outputHeight);
          const frameBuffer = Buffer.from(imageData.data.buffer);
          const progress = Math.round(((frameIndex + 1) / totalFrames) * 100);

          window.electronAPI.sendFrameToMain({ frame: frameBuffer, progress });
        }

        log.info('[RendererPage] All frames rendered. Sending "finishRender" signal.');
        window.electronAPI.finishRender();

      } catch (error) {
        log.error('[RendererPage] CRITICAL ERROR during render loop:', error);
        window.electronAPI.finishRender(); // Signal finish even on error
      }
    });

    log.info('[RendererPage] Sending "render:ready" signal to main process.');
    window.electronAPI.rendererReady();

    return () => {
      log.info('[RendererPage] Component unmounted. Cleaning up listener.');
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  return (
    <div style={{ display: 'none' }}>
      <h1>Renderer Worker</h1>
      <canvas ref={canvasRef}></canvas>
      <video ref={videoRef}></video>
    </div>
  );
}