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
 * A simple, efficient implementation of findLastIndex for arrays.
 * This is more performant than [...arr].reverse().findIndex().
 */
function findLastIndex<T>(array: T[], predicate: (value: T, index: number, obj: T[]) => unknown): number {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i], i, array)) {
      return i;
    }
  }
  return -1;
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


export const calculateZoomTransform = (currentTime: number) => {
  const {
    // Xóa 'currentTime' khỏi đây
    zoomRegions,
    metadata,
    videoDimensions,
    activeZoomRegionId
  } = useEditorStore.getState();

  const { width: videoWidth, height: videoHeight } = videoDimensions;

  const activeRegion = activeZoomRegionId
    ? zoomRegions.find(r => r.id === activeZoomRegionId)
    : undefined;

  const defaultTransform = { scale: 1, translateX: 0, translateY: 0 };

  if (!activeRegion || videoWidth === 0 || videoHeight === 0) {
    return defaultTransform;
  }
  
  // Các logic còn lại không thay đổi, vì chúng đã sử dụng 'currentTime' đúng cách
  const { startTime, duration, zoomLevel, targetX, targetY } = activeRegion;
  const elapsed = currentTime - startTime;

  // --- Phase 1: Zoom In (first 0.8s) ---
  const zoomInDuration = 0.8;
  if (elapsed <= zoomInDuration) {
    let t = elapsed / zoomInDuration;
    t = easeInOutCubic(t);
    const currentScale = lerp(1, zoomLevel, t);
    const focusX = lerp(videoWidth / 2, targetX, t);
    const focusY = lerp(videoHeight / 2, targetY, t);
    const { translateX, translateY } = calculatePan(currentScale, focusX, focusY, videoWidth, videoHeight);
    return { scale: currentScale, translateX, translateY };
  }

  // --- Phase 3: Zoom Out (last 0.8s) ---
  const zoomOutDuration = 0.8;
  const zoomOutStartTime = duration - zoomOutDuration;
  if (elapsed >= zoomOutStartTime) {
    let t = (elapsed - zoomOutStartTime) / zoomOutDuration;
    t = easeInOutCubic(t);
    
    const lastMousePos = [...metadata].reverse().find(m => m.timestamp <= startTime + zoomOutStartTime)
      || { x: targetX, y: targetY };

    const currentScale = lerp(zoomLevel, 1, t);
    const focusX = lerp(lastMousePos.x, videoWidth / 2, t);
    const focusY = lerp(lastMousePos.y, videoHeight / 2, t);

    const { translateX, translateY } = calculatePan(currentScale, focusX, focusY, videoWidth, videoHeight);
    return { scale: currentScale, translateX, translateY };
  }

  // --- Phase 2: Tracking (NEW SMOOTH LOGIC) ---
  const prevIndex = findLastIndex(metadata, m => m.timestamp <= currentTime);

  if (prevIndex === -1) {
    const { translateX, translateY } = calculatePan(zoomLevel, targetX, targetY, videoWidth, videoHeight);
    return { scale: zoomLevel, translateX, translateY };
  }
  
  const prevPos = metadata[prevIndex];
  const nextPos = metadata[prevIndex + 1];

  if (!nextPos || nextPos.timestamp > startTime + zoomOutStartTime) {
    const { translateX, translateY } = calculatePan(zoomLevel, prevPos.x, prevPos.y, videoWidth, videoHeight);
    return { scale: zoomLevel, translateX, translateY };
  }

  const timeDelta = nextPos.timestamp - prevPos.timestamp;

  if (timeDelta <= 0) {
    const { translateX, translateY } = calculatePan(zoomLevel, prevPos.x, prevPos.y, videoWidth, videoHeight);
    return { scale: zoomLevel, translateX, translateY };
  }

  const elapsedInDelta = currentTime - prevPos.timestamp;
  const t = elapsedInDelta / timeDelta;

  const focusX = lerp(prevPos.x, nextPos.x, t);
  const focusY = lerp(prevPos.y, nextPos.y, t);

  const { translateX, translateY } = calculatePan(zoomLevel, focusX, focusY, videoWidth, videoHeight);
  return { scale: zoomLevel, translateX, translateY };
};