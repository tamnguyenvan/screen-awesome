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

        // --- Setup canvas and video elements ---
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

        // --- Load state and calculate dimensions ---
        useEditorStore.setState(projectState);
        const state = useEditorStore.getState();
        const { frameStyles, videoDimensions } = state;

        const paddingPercent = frameStyles.padding / 100;
        const availableWidth = outputWidth * (1 - 2 * paddingPercent);
        const availableHeight = outputHeight * (1 - 2 * paddingPercent);

        const videoAspectRatio = videoDimensions.width / videoDimensions.height;
        let frameContentWidth, frameContentHeight;
        if (availableWidth / availableHeight > videoAspectRatio) {
            frameContentHeight = availableHeight;
            frameContentWidth = frameContentHeight * videoAspectRatio;
        } else {
            frameContentWidth = availableWidth;
            frameContentHeight = frameContentWidth / videoAspectRatio;
        }

        const frameX = (outputWidth - frameContentWidth) / 2;
        const frameY = (outputHeight - frameContentHeight) / 2;
        
        // --- Webcam setup ---
        const { webcamPosition, webcamStyles, isWebcamVisible } = projectState;

        // [FIXED] Webcam size is a percentage of the AVAILABLE height (inside the padding), not the total output height.
        // This makes it match the Preview.tsx logic.
        const webcamHeight = availableHeight * (webcamStyles.size / 100);
        const webcamWidth = webcamHeight; // Assuming square webcam aspect ratio for circle
        const webcamSquircleRadius = webcamHeight * 0.35; // Matches rounded-[35%]
        
        // [FIXED] Webcam padding should also be relative to the available space to match the preview's visual feel.
        const webcamEdgePadding = availableHeight * 0.02;

        let webcamX, webcamY;
        // [FIXED] Calculate webcam position relative to the main video frame's bounding box, not the whole canvas.
        switch (webcamPosition.pos) {
          case 'top-left': 
            webcamX = frameX + webcamEdgePadding; 
            webcamY = frameY + webcamEdgePadding; 
            break;
          case 'top-right': 
            webcamX = frameX + frameContentWidth - webcamWidth - webcamEdgePadding; 
            webcamY = frameY + webcamEdgePadding; 
            break;
          case 'bottom-left': 
            webcamX = frameX + webcamEdgePadding; 
            webcamY = frameY + frameContentHeight - webcamHeight - webcamEdgePadding; 
            break;
          default: /* bottom-right */ 
            webcamX = frameX + frameContentWidth - webcamWidth - webcamEdgePadding; 
            webcamY = frameY + frameContentHeight - webcamHeight - webcamEdgePadding; 
            break;
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

        log.info('[RendererPage] Starting frame-by-frame rendering...');
        const cutRegionsArray = Object.values(projectState.cutRegions);
        const totalDuration = projectState.duration;
        const totalFrames = Math.floor(totalDuration * fps);
        let framesSent = 0;

        for (let i = 0; i < totalFrames; i++) {
          const currentTime = i / fps;

          const isInCutRegion = cutRegionsArray.some(
            (r) => currentTime >= r.startTime && currentTime < (r.startTime + r.duration)
          );
          if (isInCutRegion) {
            continue;
          }

          await new Promise<void>(resolve => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
            };
            video.addEventListener('seeked', onSeeked, { once: true });
            video.currentTime = currentTime;
            if (webcamVideo) webcamVideo.currentTime = currentTime;
          });

          state.setCurrentTime(currentTime);

          // RENDER LOGIC STARTS
          // 1. Draw background
          await drawBackground(ctx, outputWidth, outputHeight, frameStyles.background);

          // 2. Main video frame transform and drawing
          ctx.save();
          
          const { scale, translateX, translateY, transformOrigin } = calculateZoomTransform(currentTime);

          const [originXStr, originYStr] = transformOrigin.split(' ');
          const originXMul = parseFloat(originXStr) / 100;
          const originYMul = parseFloat(originYStr) / 100;

          const originPxX = originXMul * frameContentWidth;
          const originPxY = originYMul * frameContentHeight;

          // Move canvas origin to the top-left of the untransformed video frame
          ctx.translate(frameX, frameY); 
          
          // Apply zoom/pan transformations relative to the frame's content box
          ctx.translate(originPxX, originPxY);
          ctx.scale(scale, scale);
          ctx.translate((translateX / 100) * frameContentWidth, (translateY / 100) * frameContentHeight);
          ctx.translate(-originPxX, -originPxY);

          const { shadow, borderRadius, shadowColor, borderWidth } = frameStyles;
          
          // --- Define Geometries ---
          // Path for the outer frame/border area
          const framePath = new Path2D();
          framePath.roundRect(0, 0, frameContentWidth, frameContentHeight, borderRadius);
          
          // Path for the inner video area (inside the border)
          const videoPath = new Path2D();
          const videoRadius = Math.max(0, borderRadius - borderWidth);
          videoPath.roundRect(borderWidth, borderWidth, frameContentWidth - 2 * borderWidth, frameContentHeight - 2 * borderWidth, videoRadius);

          // 3. Draw shadow for the entire frame
          ctx.save();
          ctx.shadowColor = shadowColor;
          ctx.shadowBlur = shadow * 1.5;
          ctx.shadowOffsetY = 0; // The preview shadow has no offset
          ctx.fillStyle = 'rgba(0,0,0,0.001)'; // Must fill to cast shadow
          ctx.fill(framePath);
          ctx.restore(); // Restore from shadow settings

          // 4. Draw the "glassy" frame effects
          ctx.save();
          ctx.clip(framePath); // Clip all drawing to the outer frame shape

          // 4a. Main linear gradient for glass effect
          const linearGrad = ctx.createLinearGradient(0, 0, frameContentWidth, frameContentHeight);
          linearGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
          linearGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
          linearGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
          ctx.fillStyle = linearGrad;
          ctx.fillRect(0, 0, frameContentWidth, frameContentHeight);
          
          // 4b. Radial sheen gradient for highlights
          const radialGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, frameContentWidth * 0.7);
          radialGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
          radialGrad.addColorStop(0.5, 'transparent');
          ctx.fillStyle = radialGrad;
          ctx.fillRect(0, 0, frameContentWidth, frameContentHeight);

          // 4c. Draw the outer 1px border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.stroke(framePath);

          ctx.restore(); // Restore from frame clip

          // 5. Draw the video itself, clipped to its own inner path
          ctx.save();
          ctx.clip(videoPath);
          ctx.drawImage(video, borderWidth, borderWidth, frameContentWidth - 2 * borderWidth, frameContentHeight - 2 * borderWidth);
          ctx.restore(); // Restore from video clip

          ctx.restore(); // Restore from main transform

          // 6. Draw webcam (outside of main transform)
          if (isWebcamVisible && webcamVideo) {
            ctx.save();
            const webcamPath = new Path2D();
            webcamPath.roundRect(webcamX, webcamY, webcamWidth, webcamHeight, webcamSquircleRadius);
            
            // Apply webcam shadow
            ctx.shadowColor = webcamStyles.shadowColor;
            ctx.shadowBlur = webcamStyles.shadow * 1.5;
            ctx.shadowOffsetY = 0;
            
            ctx.fillStyle = 'rgba(0,0,0,0.001)';
            ctx.fill(webcamPath);
            
            // Reset shadow and draw webcam video
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            ctx.clip(webcamPath);
            ctx.drawImage(webcamVideo, webcamX, webcamY, webcamWidth, webcamHeight);
            ctx.restore();
          }

          // RENDER LOGIC ENDS

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
        window.electronAPI.finishRender(); // Tell main process we're done, even if it's an error
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