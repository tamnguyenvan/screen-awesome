// src/pages/RendererPage.tsx
import { useEffect, useRef } from 'react';
import { CutRegion, useEditorStore } from '../store/editorStore';
import { calculateZoomTransform } from '../lib/transform';
import { ExportSettings } from '../components/editor/ExportModal';

const RESOLUTIONS = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '2k': { width: 2560, height: 1440 },
};

// Hàm vẽ background, tái sử dụng logic từ Preview.tsx
// (Hàm này không thay đổi, nhưng vẫn cần có)
const drawBackground = async (ctx: CanvasRenderingContext2D, width: number, height: number, backgroundState: ReturnType<typeof useEditorStore.getState>['frameStyles']['background']) => {
  ctx.clearRect(0, 0, width, height);

  switch (backgroundState.type) {
    case 'color':
      ctx.fillStyle = backgroundState.color || '#000000';
      ctx.fillRect(0, 0, width, height);
      break;
    case 'gradient': {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, backgroundState.gradientStart || '#000000');
      gradient.addColorStop(1, backgroundState.gradientEnd || '#ffffff');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'image':
    case 'wallpaper': {
      if (!backgroundState.imageUrl) {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);
        return;
      }
      // Bọc việc load ảnh trong một Promise để đảm bảo nó được vẽ xong
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // Logic để vẽ ảnh với tỷ lệ `cover`
          const imgRatio = img.width / img.height;
          const canvasRatio = width / height;
          let sx, sy, sWidth, sHeight;
          if (imgRatio > canvasRatio) { // ảnh rộng hơn canvas
              sHeight = img.height;
              sWidth = sHeight * canvasRatio;
              sx = (img.width - sWidth) / 2;
              sy = 0;
          } else { // ảnh cao hơn hoặc bằng canvas
              sWidth = img.width;
              sHeight = sWidth / canvasRatio;
              sx = 0;
              sy = (img.height - sHeight) / 2;
          }
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
          resolve();
        };
        if (!backgroundState.imageUrl) {
          reject(new Error('Image URL is not defined'));
          return;
        }
        img.onerror = reject;
        img.src = backgroundState.imageUrl;
      });
      break;
    }
    default:
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);
  }
};


type RenderStartPayload = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  projectState: any;
  exportSettings: ExportSettings;
}

export function RendererPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    console.log('[RendererPage] Component mounted. Setting up listeners.');

    const cleanup = window.electronAPI.onRenderStart(async ({ projectState, exportSettings }: RenderStartPayload) => {
      console.log('[RendererPage] Received "render:start" event with job data:', { projectState, exportSettings });
      
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) {
        console.error('[RendererPage] Canvas or Video ref is not available.');
        return;
      }

      const { resolution, fps } = exportSettings;
      const { width: outputWidth, height: outputHeight } = RESOLUTIONS[resolution];
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
         console.error('[RendererPage] Failed to get 2D context from canvas.');
         return;
      }
      
      // Load state vào Zustand store của worker này
      useEditorStore.setState(projectState);

      // Chuẩn bị video element
      video.src = `media://${projectState.videoPath}`;
      video.muted = true;
      
      // Wrapper Promise-based cho việc seek video
      const seek = (time: number): Promise<void> => {
        // SỬA LỖI: Nếu video đã ở đúng vị trí (hoặc rất gần),
        // resolve ngay lập tức để tránh bị kẹt vì sự kiện 'seeked' không được bắn ra.
        if (Math.abs(video.currentTime - time) < 0.01) {
            // THÊM LOG
            // console.log(`[RendererPage] Seek shortcut: Already at time ${time.toFixed(3)}s.`);
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                video.removeEventListener('error', onError);
                resolve();
            };
            const onError = (e: Event) => {
                video.removeEventListener('seeked', onSeeked);
                video.removeEventListener('error', onError);
                console.error('[RendererPage] Video seek error:', e);
                reject(new Error('Failed to seek video'));
            };

            video.addEventListener('seeked', onSeeked);
            video.addEventListener('error', onError);
            video.currentTime = time;
        });
      };
      
      // --- VÒNG LẶP RENDER MỚI, CÓ KIỂM SOÁT ---
      const totalFrames = Math.floor(projectState.duration * fps);
      console.log(`[RendererPage] Starting render for ${totalFrames} frames at ${fps} FPS.`);
      
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        const currentTime = frameIndex / fps;
        
        // Logic xử lý Cut Regions
        const activeCutRegion = projectState.cutRegions.find(
          (r: CutRegion) => currentTime >= r.startTime && currentTime < r.startTime + r.duration
        );
        
        if (activeCutRegion) {
          const endOfCut = activeCutRegion.startTime + activeCutRegion.duration;
          const newFrameIndex = Math.floor(endOfCut * fps) - 1;
          console.log(`[RendererPage] Skipping cut region. Jumping from frame ${frameIndex} to ${newFrameIndex + 1}`);
          frameIndex = newFrameIndex;
          continue; 
        }

        // THÊM LOG: Báo hiệu bắt đầu xử lý frame
        console.log(`[RendererPage] Processing frame ${frameIndex + 1}/${totalFrames} at time ${currentTime.toFixed(3)}s...`);
        
        // 1. Seek video đến đúng vị trí
        await seek(currentTime);
        
        // Cập nhật state của store để `calculateZoomTransform` hoạt động đúng
        useEditorStore.getState().setCurrentTime(currentTime);
        const state = useEditorStore.getState();

        // 2. Render lên Canvas
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

        const videoX = (outputWidth - videoDisplayWidth) / 2;
        const videoY = (outputHeight - videoDisplayHeight) / 2;
        
        ctx.shadowColor = `rgba(0,0,0,${state.frameStyles.shadow / 100})`;
        ctx.shadowBlur = state.frameStyles.shadow;
        ctx.strokeStyle = state.frameStyles.borderColor;
        ctx.lineWidth = state.frameStyles.borderWidth;
        
        ctx.beginPath();
        ctx.roundRect(videoX, videoY, videoDisplayWidth, videoDisplayHeight, state.frameStyles.borderRadius);
        ctx.closePath();
        
        if (state.frameStyles.borderWidth > 0) ctx.stroke();
        ctx.clip();
        
        const { scale, translateX, translateY } = calculateZoomTransform(currentTime);
        
        const scaledVideoRenderWidth = videoDisplayWidth * scale;
        const scaledVideoRenderHeight = videoDisplayHeight * scale;
        const panX = (translateX / 100) * videoDisplayWidth;
        const panY = (translateY / 100) * videoDisplayHeight;
        const renderX = videoX - (scaledVideoRenderWidth - videoDisplayWidth) / 2 + panX;
        const renderY = videoY - (scaledVideoRenderHeight - videoDisplayHeight) / 2 + panY;

        ctx.drawImage(video, renderX, renderY, scaledVideoRenderWidth, scaledVideoRenderHeight);
        
        ctx.restore();
        
        // 3. Trích xuất frame và gửi về main process
        const imageData = ctx.getImageData(0, 0, outputWidth, outputHeight);
        const frameBuffer = Buffer.from(imageData.data.buffer);
        const progress = Math.round(((frameIndex + 1) / totalFrames) * 100);
        
        window.electronAPI.sendFrameToMain({ frame: frameBuffer, progress });

        // THÊM LOG: Báo hiệu đã xử lý xong frame
        // console.log(`[RendererPage] Frame ${frameIndex + 1} sent to main process.`);
      }
      
      console.log('[RendererPage] All frames rendered. Sending "finishRender" signal.');
      window.electronAPI.finishRender();
    });

    console.log('[RendererPage] Sending "render:ready" signal to main process.');
    window.electronAPI.rendererReady();

    return () => {
      console.log('[RendererPage] Component unmounted. Cleaning up listener.');
      if (typeof cleanup === 'function') {
        cleanup();
      }
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