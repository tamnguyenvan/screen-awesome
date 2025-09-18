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
        // Fallback background if no image
        ctx.fillStyle = 'oklch(0.2077 0.0398 265.7549)';
        ctx.fillRect(0, 0, width, height);
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // Cover scaling logic
          const imgRatio = img.width / img.height;
          const canvasRatio = width / height;
          let sx, sy, sWidth, sHeight;

          if (imgRatio > canvasRatio) {
            // Image is wider than canvas
            sHeight = img.height;
            sWidth = sHeight * canvasRatio;
            sx = (img.width - sWidth) / 2;
            sy = 0;
          } else {
            // Image is taller than canvas
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
          // Draw fallback on error
          ctx.fillStyle = 'oklch(0.2077 0.0398 265.7549)';
          ctx.fillRect(0, 0, width, height);
          resolve(); // Resolve anyway to continue export
        };

        if (!backgroundState.imageUrl) {
          log.error('[RendererPage] No image URL provided');
          reject(new Error('No image URL provided'));
          return;
        }

        // Use the custom media:// protocol for local file access
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

  useEffect(() => {
    log.info('[RendererPage] Component mounted. Setting up listeners.');

    const cleanup = window.electronAPI.onRenderStart(async ({ projectState, exportSettings }: RenderStartPayload) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      try {
        log.info('[RendererPage] Received "render:start" event.', { exportSettings });

        if (!canvas || !video) throw new Error('Canvas or Video ref is not available.');

        // 1. Setup Output Dimensions
        const { resolution, fps } = exportSettings;
        const [ratioW, ratioH] = projectState.aspectRatio.split(':').map(Number);
        const baseHeight = RESOLUTIONS[resolution as keyof typeof RESOLUTIONS].height;
        const aspectValue = ratioW / ratioH;
        
        // Calculate width and ensure it's even for FFmpeg compatibility
        let outputWidth = Math.round(baseHeight * aspectValue);
        outputWidth = outputWidth % 2 === 0 ? outputWidth : outputWidth + 1;
        const outputHeight = baseHeight;

        canvas.width = outputWidth;
        canvas.height = outputHeight;

        // Use alpha: false for performance as we always draw a background
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Failed to get 2D context from canvas.');

        // Load project state into the store for calculations (e.g., calculateZoomTransform)
        useEditorStore.setState(projectState);
        const state = useEditorStore.getState();
        const { frameStyles, videoDimensions } = state;

        // --- Pre-calculate static layout values ---

        // The area available for the "Frame" (Outer border included) after padding
        const paddingPercent = frameStyles.padding / 100;
        const availableWidth = outputWidth * (1 - 2 * paddingPercent);
        const availableHeight = outputHeight * (1 - 2 * paddingPercent);

        const videoAspectRatio = videoDimensions.width / videoDimensions.height;

        // Calculate frame dimensions maintaining video aspect ratio within available space
        let frameWidth, frameHeight;
        if (availableWidth / availableHeight > videoAspectRatio) {
          frameHeight = availableHeight;
          frameWidth = frameHeight * videoAspectRatio;
        } else {
          frameWidth = availableWidth;
          frameHeight = frameWidth / videoAspectRatio;
        }

        // Position of the frame's top-left corner
        const frameX = (outputWidth - frameWidth) / 2;
        const frameY = (outputHeight - frameHeight) / 2;

        // Inner frame dimensions (where video is drawn)
        const borderWidth = frameStyles.borderWidth;
        const innerWidth = frameWidth - (borderWidth * 2);
        const innerHeight = frameHeight - (borderWidth * 2);
        const innerX = borderWidth;
        const innerY = borderWidth;
        const innerRadius = Math.max(0, frameStyles.borderRadius - borderWidth);


        // 2. Load Video and Wait
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
            video.load();
        });

        // Helper to seek video accurately
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

        // 3. Start Render Loop
        const totalFrames = Math.floor(projectState.duration * fps);
        log.info(`[RendererPage] Starting render for ${totalFrames} frames at ${fps} FPS.`);

        if (totalFrames <= 0) {
          log.warn('[RendererPage] No frames to render. Aborting.');
          window.electronAPI.finishRender();
          return;
        }

        const cutRegionsArray = Object.values(projectState.cutRegions);

        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
          const currentTime = frameIndex / fps;

          // Skip cut regions
          const activeCutRegion = cutRegionsArray.find(
            (r: CutRegion) => currentTime >= r.startTime && currentTime < r.startTime + r.duration
          );

          if (activeCutRegion) {
            const endOfCut = activeCutRegion.startTime + activeCutRegion.duration;
            // Jump frameIndex to the frame just before the end of the cut
            frameIndex = Math.floor(endOfCut * fps) - 1; 
            continue;
          }

          // Prepare for rendering
          await seek(currentTime);
          state.setCurrentTime(currentTime); // Update store for zoom calculations

          // --- BEGIN FRAME RENDERING ---

          // 1. Draw Background
          await drawBackground(ctx, outputWidth, outputHeight, frameStyles.background);

          // 2. Apply Transformations (Crucial: Do this *before* drawing the frame so shadow/border are transformed)
          ctx.save();

          // Move context origin to the center of the frame area
          ctx.translate(frameX + frameWidth / 2, frameY + frameHeight / 2);

          const { scale, translateX, translateY } = calculateZoomTransform(currentTime);

          // Apply scale
          ctx.scale(scale, scale);

          // Apply pan translation (translateX/Y are percentages of the frame width/height)
          const panX = (translateX / 100) * frameWidth;
          const panY = (translateY / 100) * frameHeight;
          ctx.translate(panX, panY);

          // Move origin back so (0,0) is the top-left of the frame area
          ctx.translate(-frameWidth / 2, -frameHeight / 2);

          // --- Now everything drawn is inside the zoomed/panned frame container ---

          // 3. Draw the Frame Shadow
          const { shadow, borderRadius } = frameStyles;
          const shadowOpacity = Math.min(shadow * 0.015, 0.4);

          ctx.shadowColor = `rgba(0, 0, 0, ${shadowOpacity})`;
          ctx.shadowBlur = shadow * 1.5;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = shadow;

          const frameOuterPath = new Path2D();
          // Draw at (0,0) because context is translated to frameX, frameY
          frameOuterPath.roundRect(0, 0, frameWidth, frameHeight, borderRadius);

          // Fill with near-transparent to cast the shadow without showing the fill
          ctx.fillStyle = 'rgba(0,0,0,0.001)';
          ctx.fill(frameOuterPath);

          // Reset shadow for subsequent draws
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          // 4. Draw the "Glass" Effect (Border and Gradient Overlay)
          ctx.save();
          ctx.clip(frameOuterPath);

          // --- Gradient Overlay (Simulating glassyFrameStyle from Preview.tsx) ---
          const gradient = ctx.createLinearGradient(0, 0, frameWidth, frameHeight);
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
          gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, frameWidth, frameHeight);

          // --- Glass Border ---
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 2; // Stroke is centered, so 2px width gives ~1px visual border
          ctx.stroke(frameOuterPath);

          ctx.restore(); // End glass clip

          // 5. Draw the Video Content
          const videoClipPath = new Path2D();
          videoClipPath.roundRect(innerX, innerY, innerWidth, innerHeight, innerRadius);

          ctx.save();
          ctx.clip(videoClipPath);

          // Draw video into the inner rectangle.
          // The context is already scaled/panned, so we just draw at the calculated inner coordinates.
          ctx.drawImage(video, innerX, innerY, innerWidth, innerHeight);

          ctx.restore(); // End video clip

          // --- END FRAME RENDERING ---

          ctx.restore(); // Restore context state (removes zoom/pan transform)

          // 6. Extract and Send Frame Data
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

    // Signal to main process that the renderer is ready to receive the project data
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