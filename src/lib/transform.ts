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
 */
function calculatePan(scale: number, focusPointX: number, focusPointY: number, videoWidth: number, videoHeight: number) {
  const panX = -(focusPointX - videoWidth / 2) * (scale - 1);
  const panY = -(focusPointY - videoHeight / 2) * (scale - 1);
  const translateX = (panX / videoWidth) * 100;
  const translateY = (panY / videoHeight) * 100;
  return { translateX, translateY };
}


export const calculateZoomTransform = (currentTime: number) => {
  const {
    zoomRegions,
    metadata,
    videoDimensions,
    activeZoomRegionId
  } = useEditorStore.getState();

  const { width: videoWidth, height: videoHeight } = videoDimensions;

  // OPTIMIZATION: O(1) lookup for the active region
  const activeRegion = activeZoomRegionId ? zoomRegions[activeZoomRegionId] : undefined;
  
  const defaultTransform = { scale: 1, translateX: 0, translateY: 0 };
  if (!activeRegion || videoWidth === 0 || videoHeight === 0) {
    return defaultTransform;
  }
  
  const { startTime, duration, zoomLevel, targetX, targetY } = activeRegion;
  const elapsed = currentTime - startTime;

  // Phase 1: Zoom In (first 0.8s)
  const zoomInDuration = 0.8;
  if (elapsed <= zoomInDuration) {
    const t = easeInOutCubic(elapsed / zoomInDuration);
    const currentScale = lerp(1, zoomLevel, t);
    const focusX = lerp(videoWidth / 2, targetX, t);
    const focusY = lerp(videoHeight / 2, targetY, t);
    return { scale: currentScale, ...calculatePan(currentScale, focusX, focusY, videoWidth, videoHeight) };
  }

  // Phase 3: Zoom Out (last 0.8s)
  const zoomOutDuration = 0.8;
  const zoomOutStartTime = duration - zoomOutDuration;
  if (elapsed >= zoomOutStartTime) {
    const t = easeInOutCubic((elapsed - zoomOutStartTime) / zoomOutDuration);
    
    // Find the last known mouse position before the zoom-out starts
    const lastMousePos = findLastIndex(metadata, m => m.timestamp <= startTime + zoomOutStartTime);
    const lastKnownPos = lastMousePos !== -1 ? metadata[lastMousePos] : { x: targetX, y: targetY };

    const currentScale = lerp(zoomLevel, 1, t);
    const focusX = lerp(lastKnownPos.x, videoWidth / 2, t);
    const focusY = lerp(lastKnownPos.y, videoHeight / 2, t);

    return { scale: currentScale, ...calculatePan(currentScale, focusX, focusY, videoWidth, videoHeight) };
  }

  // Phase 2: Tracking mouse movement
  const prevIndex = findLastIndex(metadata, m => m.timestamp <= currentTime);
  if (prevIndex === -1) {
    return { scale: zoomLevel, ...calculatePan(zoomLevel, targetX, targetY, videoWidth, videoHeight) };
  }
  
  const prevPos = metadata[prevIndex];
  const nextPos = metadata[prevIndex + 1];

  // If there's no next position or it's outside the tracking window, just stick to the previous position
  if (!nextPos || nextPos.timestamp > startTime + zoomOutStartTime) {
    return { scale: zoomLevel, ...calculatePan(zoomLevel, prevPos.x, prevPos.y, videoWidth, videoHeight) };
  }

  // Interpolate between the previous and next mouse positions
  const timeDelta = nextPos.timestamp - prevPos.timestamp;
  if (timeDelta <= 0) {
    return { scale: zoomLevel, ...calculatePan(zoomLevel, prevPos.x, prevPos.y, videoWidth, videoHeight) };
  }

  const t = (currentTime - prevPos.timestamp) / timeDelta;
  const focusX = lerp(prevPos.x, nextPos.x, t);
  const focusY = lerp(prevPos.y, nextPos.y, t);

  return { scale: zoomLevel, ...calculatePan(zoomLevel, focusX, focusY, videoWidth, videoHeight) };
};