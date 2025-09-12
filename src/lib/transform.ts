// src/lib/transform.ts
import { useEditorStore } from '../store/editorStore';

// --- Easing Functions ---
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- Linear Interpolation ---
function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t;
}

/**
 * Calculates the required CSS translate percentages to center the view on a specific point
 * after a given scale has been applied.
 * @param scale The current zoom level (e.g., 2 for 2x).
 * @param focusPointX The absolute X coordinate of the point to focus on.
 * @param focusPointY The absolute Y coordinate of the point to focus on.
 * @param videoWidth The total width of the video.
 * @param videoHeight The total height of the video.
 * @returns An object with { translateX, translateY } in CSS percentages.
 */
function calculatePan(scale: number, focusPointX: number, focusPointY: number, videoWidth: number, videoHeight: number) {
  // The amount the focus point is moved by the scale operation, in pixels.
  // We need to counteract this with a translation.
  const panX = -(focusPointX - videoWidth / 2) * (scale - 1);
  const panY = -(focusPointY - videoHeight / 2) * (scale - 1);

  // Convert pixel translation to CSS percentage translation.
  const translateX = (panX / videoWidth) * 100;
  const translateY = (panY / videoHeight) * 100;

  return { translateX, translateY };
}


export const calculateZoomTransform = () => {
  const { 
      currentTime, 
      zoomRegions, 
      metadata,
      videoDimensions 
  } = useEditorStore.getState();

  const { width: videoWidth, height: videoHeight } = videoDimensions;

  // Find the active zoom region for the current time
  const activeRegion = zoomRegions.find(
    r => currentTime >= r.startTime && currentTime <= r.startTime + r.duration
  );

  // Default transform (no zoom)
  const defaultTransform = { scale: 1, translateX: 0, translateY: 0 };

  if (!activeRegion || videoWidth === 0 || videoHeight === 0) {
    return defaultTransform;
  }

  const { startTime, duration, zoomLevel, targetX, targetY } = activeRegion;
  const elapsed = currentTime - startTime;

  // --- Phase 1: Zoom In (first 0.25s) ---
  const zoomInDuration = 0.25;
  if (elapsed <= zoomInDuration) {
    let t = elapsed / zoomInDuration;
    t = easeInOutCubic(t);
    
    // Scale interpolates from 1x to the target zoomLevel
    const currentScale = lerp(1, zoomLevel, t);
    
    // The focus point also interpolates from the center of the screen to the click target
    const focusX = lerp(videoWidth / 2, targetX, t);
    const focusY = lerp(videoHeight / 2, targetY, t);

    const { translateX, translateY } = calculatePan(currentScale, focusX, focusY, videoWidth, videoHeight);
    return { scale: currentScale, translateX, translateY };
  }

  // --- Phase 3: Zoom Out (last 0.5s) ---
  const zoomOutDuration = 0.5;
  const zoomOutStartTime = duration - zoomOutDuration;
  if (elapsed >= zoomOutStartTime) {
    let t = (elapsed - zoomOutStartTime) / zoomOutDuration;
    t = easeInOutCubic(t);

    // Find last known mouse position before zoom-out starts to ensure a smooth transition
    const lastMousePos = [...metadata].reverse().find(m => m.timestamp <= startTime + zoomOutStartTime) 
        || { x: targetX, y: targetY };
    
    // Scale interpolates from zoomLevel back down to 1x
    const currentScale = lerp(zoomLevel, 1, t);
    
    // The focus point interpolates from the last mouse position back to the center of the screen
    const focusX = lerp(lastMousePos.x, videoWidth / 2, t);
    const focusY = lerp(lastMousePos.y, videoHeight / 2, t);

    const { translateX, translateY } = calculatePan(currentScale, focusX, focusY, videoWidth, videoHeight);
    return { scale: currentScale, translateX, translateY };
  }

  // --- Phase 2: Tracking ---
  // Find the most recent mouse position up to the current time
  const currentMousePos = [...metadata].reverse().find(m => m.timestamp <= currentTime) 
      || { x: targetX, y: targetY }; // Fallback to initial click if no move data

  const { translateX, translateY } = calculatePan(zoomLevel, currentMousePos.x, currentMousePos.y, videoWidth, videoHeight);
  return { scale: zoomLevel, translateX, translateY };
};