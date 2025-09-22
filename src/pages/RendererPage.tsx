import log from 'electron-log/renderer';
import { useEffect, useRef } from 'react';
import { useEditorStore, EditorActions } from '../store/editorStore';
import { EditorState } from '../types/store';
import { calculateZoomTransform } from '../lib/transform';
import { ExportSettings } from '../components/editor/ExportModal';
import { RESOLUTIONS } from '../lib/constants';

/**
 * Draws the background (color, gradient, image) onto the canvas.
 * This matches the implementation in Preview.tsx (generateBackgroundStyle).
 */
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
        // Map direction strings to canvas coordinates
        const getCoords = (dir: string) => {
          switch (dir) {
            case 'to bottom': return [0, 0, 0, height];
            case 'to top': return [0, height, 0, 0];
            case 'to right': return [0, 0, width, 0];
            case 'to left': return [width, 0, 0, 0];
            case 'to bottom right': return [0, 0, width, height];
            case 'to bottom left': return [width, 0, 0, height];
            case 'to top right': return [0, height, width, 0];
            case 'to top left': return [width, height, 0, 0];
            default: return [0, 0, width, 0];
          }
        };
        const coords = getCoords(direction);
        // @ts-expect-error - TS doesn't know coords has exactly 4 elements
        gradient = ctx.createLinearGradient(...coords);
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
        ctx.fillStyle = 'oklch(0.2077 0.0398 265.7549)';
        ctx.fillRect(0, 0, width, height);
        return;
      }
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const imgRatio = img.width / img.height;
          const canvasRatio = width / height;
          let sx, sy, sWidth, sHeight;
          if (imgRatio > canvasRatio) {
            sHeight = img.height;
            sWidth = sHeight * canvasRatio;
            sx = (img.width - sWidth) / 2;
            sy = 0;
          } else {
            sWidth = img.width;
            sHeight = sWidth / canvasRatio;
            sx = 0;
            sy = (img.height - sHeight) / 2;
          }
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
          resolve();
        };
        img.onerror = (err) => {
          log.error(`[RendererPage] Failed to load background image: ${img.src}`, err);
          ctx.fillStyle = 'oklch(0.2077 0.0398 265.7549)';
          ctx.fillRect(0, 0, width, height);
          resolve();
        };
        if (!backgroundState.imageUrl) {
          resolve();
          return;
        }
        const finalUrl = backgroundState.imageUrl.startsWith('blob:')
          ? backgroundState.imageUrl
          : `media://${backgroundState.imageUrl}`;
        img.src = finalUrl;
      });
      break;
    }
    default:
      ctx.fillStyle = 'oklch(0.2077 0.0398 265.7549)';
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
  const webcamVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    log.info('[RendererPage] Component mounted. Setting up listeners.');

    const cleanup = window.electronAPI.onRenderStart(async ({ projectState, exportSettings }: RenderStartPayload) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const webcamVideo = webcamVideoRef.current;

      try {
        log.info('[RendererPage] Received "render:start" event.', { exportSettings });
        if (!canvas || !video) throw new Error('Canvas or Video ref is not available.');

        // --- Setup (kích thước, load video) ---
        const { resolution, fps } = exportSettings;
        const [ratioW, ratioH] = projectState.aspectRatio.split(':').map(Number);
        const baseHeight = RESOLUTIONS[resolution as keyof typeof RESOLUTIONS].height;
        let outputWidth = Math.round(baseHeight * (ratioW / ratioH));
        outputWidth = outputWidth % 2 === 0 ? outputWidth : outputWidth + 1;
        const outputHeight = baseHeight;
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Failed to get 2D context from canvas.');
        useEditorStore.setState(projectState);
        const state = useEditorStore.getState();
        const { frameStyles, videoDimensions } = state;
        const paddingPercent = frameStyles.padding / 100;
        const availableWidth = outputWidth * (1 - 2 * paddingPercent);
        const availableHeight = outputHeight * (1 - 2 * paddingPercent);
        const videoAspectRatio = videoDimensions.width / videoDimensions.height;
        let frameWidth, frameHeight;
        if (availableWidth / availableHeight > videoAspectRatio) {
          frameHeight = availableHeight;
          frameWidth = frameHeight * videoAspectRatio;
        } else {
          frameWidth = availableWidth;
          frameHeight = frameWidth / videoAspectRatio;
        }
        const frameX = (outputWidth - frameWidth) / 2;
        const frameY = (outputHeight - frameHeight) / 2;
        const borderWidth = frameStyles.borderWidth;
        const innerWidth = frameWidth - (borderWidth * 2);
        const innerHeight = frameHeight - (borderWidth * 2);
        const innerX = borderWidth;
        const innerY = borderWidth;
        const innerRadius = Math.max(0, frameStyles.borderRadius - borderWidth);
        const { webcamPosition, webcamStyles, isWebcamVisible } = projectState;
        const webcamHeight = outputHeight * (webcamStyles.size / 100);
        const webcamWidth = webcamHeight;
        const webcamRadius = webcamHeight * 0.35;
        const padding = outputHeight * 0.02;
        let webcamX, webcamY;
        switch (webcamPosition.pos) {
          case 'top-left': webcamX = padding; webcamY = padding; break;
          case 'top-right': webcamX = outputWidth - webcamWidth - padding; webcamY = padding; break;
          case 'bottom-left': webcamX = padding; webcamY = outputHeight - webcamHeight - padding; break;
          default: webcamX = outputWidth - webcamWidth - padding; webcamY = outputHeight - webcamHeight - padding; break;
        }
        const loadVideo = (videoElement: HTMLVideoElement, source: string, path: string): Promise<void> =>
          new Promise((resolve, reject) => {
            const onCanPlay = () => { videoElement.removeEventListener('canplaythrough', onCanPlay); videoElement.removeEventListener('error', onError); log.info(`[RendererPage] ${source} video is ready.`); resolve(); };
            const onError = (e: Event) => { videoElement.removeEventListener('canplaythrough', onCanPlay); videoElement.removeEventListener('error', onError); log.error(`[RendererPage] ${source} loading error:`, e); reject(new Error(`Failed to load ${source}.`)); };
            videoElement.addEventListener('canplaythrough', onCanPlay);
            videoElement.addEventListener('error', onError);
            videoElement.src = `media://${path}`;
            videoElement.muted = true;
            videoElement.load();
          });
        const loadPromises: Promise<void>[] = [loadVideo(video, 'Main video', projectState.videoPath!)];
        if (projectState.webcamVideoPath && webcamVideo) { loadPromises.push(loadVideo(webcamVideo, 'Webcam video', projectState.webcamVideoPath)); }
        await Promise.all(loadPromises);

        // --- BẮT ĐẦU LOGIC RENDER MỚI ---

        log.info('[RendererPage] Starting frame-by-frame rendering...');
        const cutRegionsArray = Object.values(projectState.cutRegions);
        const totalDuration = projectState.duration;
        const totalFrames = Math.floor(totalDuration * fps);
        let framesSent = 0;

        for (let i = 0; i < totalFrames; i++) {
          const currentTime = i / fps;

          // Bỏ qua các frame nằm trong vùng "cut"
          const isInCutRegion = cutRegionsArray.some(
            (r) => currentTime >= r.startTime && currentTime < (r.startTime + r.duration)
          );
          if (isInCutRegion) {
            continue;
          }

          // Chờ video seek đến đúng thời điểm
          await new Promise<void>(resolve => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
            };
            video.addEventListener('seeked', onSeeked, { once: true });
            video.currentTime = currentTime;
            if (webcamVideo) webcamVideo.currentTime = currentTime;
          });

          // Cập nhật state để tính toán transform chính xác
          state.setCurrentTime(currentTime);

          // --- Logic vẽ canvas (giữ nguyên như cũ) ---
          await drawBackground(ctx, outputWidth, outputHeight, frameStyles.background);
          ctx.save();
          ctx.translate(frameX + frameWidth / 2, frameY + frameHeight / 2);
          const { scale, translateX, translateY } = calculateZoomTransform(currentTime);
          ctx.scale(scale, scale);
          ctx.translate((translateX / 100) * frameWidth, (translateY / 100) * frameHeight);
          ctx.translate(-frameWidth / 2, -frameHeight / 2);
          const { shadow, borderRadius } = frameStyles;
          ctx.shadowColor = `rgba(0, 0, 0, ${Math.min(shadow * 0.015, 0.4)})`;
          ctx.shadowBlur = shadow * 1.5;
          ctx.shadowOffsetY = shadow;
          const frameOuterPath = new Path2D();
          frameOuterPath.roundRect(0, 0, frameWidth, frameHeight, borderRadius);
          ctx.fillStyle = 'rgba(0,0,0,0.001)'; // Needed for shadow to apply
          ctx.fill(frameOuterPath);
          ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
          ctx.save();
          ctx.clip(frameOuterPath);
          const gradient = ctx.createLinearGradient(0, 0, frameWidth, frameHeight);
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
          gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, frameWidth, frameHeight);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 2;
          ctx.stroke(frameOuterPath);
          ctx.restore();
          const videoClipPath = new Path2D();
          videoClipPath.roundRect(innerX, innerY, innerWidth, innerHeight, innerRadius);
          ctx.save();
          ctx.clip(videoClipPath);
          ctx.drawImage(video, innerX, innerY, innerWidth, innerHeight);
          ctx.restore();
          ctx.restore();
          if (isWebcamVisible && webcamVideo) {
            ctx.save();
            const webcamPath = new Path2D();
            webcamPath.roundRect(webcamX, webcamY, webcamWidth, webcamHeight, webcamRadius);
            ctx.clip(webcamPath);
            ctx.drawImage(webcamVideo, webcamX, webcamY, webcamWidth, webcamHeight);
            ctx.restore();
          }
          // --- Kết thúc logic vẽ canvas ---

          const imageData = ctx.getImageData(0, 0, outputWidth, outputHeight);
          const frameBuffer = Buffer.from(imageData.data.buffer);
          const progress = Math.round((i / totalFrames) * 100);
          window.electronAPI.sendFrameToMain({ frame: frameBuffer, progress });
          framesSent++;
        }

        log.info(`[RendererPage] Render finished. Sent ${framesSent} frames. Sending "finishRender" signal.`);
        window.electronAPI.finishRender();

      } catch (error) {
        log.error('[RendererPage] CRITICAL ERROR during render process:', error);
        window.electronAPI.finishRender(); // Báo cho main process biết là đã có lỗi
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
    <div>
      <h1>Renderer Worker</h1>
      <p>This page is hidden and used for video exporting.</p>
      <canvas ref={canvasRef}></canvas>
      <video ref={videoRef}></video>
      <video ref={webcamVideoRef}></video>
    </div>
  );
}