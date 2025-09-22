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
  
  // NOTE: Get the additional 'mode' property
  const { startTime, duration, zoomLevel, targetX, targetY, mode } = activeRegion;
  const elapsed = currentTime - startTime;
  const zoomInDuration = 0.8;
  const zoomOutDuration = 0.8;
  const zoomOutStartTime = duration - zoomOutDuration;
  
  // --- Phase 1: Zoom In (first 0.8 seconds) ---
  if (elapsed <= zoomInDuration) {
    const t = easeInOutCubic(elapsed / zoomInDuration);
    const currentScale = lerp(1, zoomLevel, t);
    const focusX = lerp(videoWidth / 2, targetX, t);
    const focusY = lerp(videoHeight / 2, targetY, t);
    return { scale: currentScale, ...calculatePan(currentScale, focusX, focusY, videoWidth, videoHeight) };
  }

  // --- Phase 3: Zoom Out (last 0.8 seconds) ---
  if (elapsed >= zoomOutStartTime) {
    const t = easeInOutCubic((elapsed - zoomOutStartTime) / zoomOutDuration);
    
    // NOTE: Determine the starting point for zoom-out based on mode
    let startFocusX = targetX;
    let startFocusY = targetY;

    // If 'auto', find the last known mouse position before zoom-out
    if (mode === 'auto') {
      const lastMousePosIndex = findLastIndex(metadata, m => m.timestamp <= startTime + zoomOutStartTime);
      const lastKnownPos = lastMousePosIndex !== -1 ? metadata[lastMousePosIndex] : { x: targetX, y: targetY };
      startFocusX = lastKnownPos.x;
      startFocusY = lastKnownPos.y;
    }
    // NOTE: If 'fixed', the starting point is the targetX/Y already set.

    const currentScale = lerp(zoomLevel, 1, t);
    const focusX = lerp(startFocusX, videoWidth / 2, t);
    const focusY = lerp(startFocusY, videoHeight / 2, t);

    return { scale: currentScale, ...calculatePan(currentScale, focusX, focusY, videoWidth, videoHeight) };
  }
  
  // --- Phase 2: Tracking (between zoom-in and zoom-out) ---
  
  // NOTE: If 'fixed', just keep the zoom position
  if (mode === 'fixed') {
    return { scale: zoomLevel, ...calculatePan(zoomLevel, targetX, targetY, videoWidth, videoHeight) };
  }
  
  // NOTE: Logic below runs only for mode 'auto'
  const prevIndex = findLastIndex(metadata, m => m.timestamp <= currentTime);
  if (prevIndex === -1) {
    return { scale: zoomLevel, ...calculatePan(zoomLevel, targetX, targetY, videoWidth, videoHeight) };
  }
  
  const prevPos = metadata[prevIndex];
  const nextPos = metadata[prevIndex + 1];

  if (!nextPos || nextPos.timestamp > startTime + duration) {
    return { scale: zoomLevel, ...calculatePan(zoomLevel, prevPos.x, prevPos.y, videoWidth, videoHeight) };
  }

  const timeDelta = nextPos.timestamp - prevPos.timestamp;
  if (timeDelta <= 0) {
    return { scale: zoomLevel, ...calculatePan(zoomLevel, prevPos.x, prevPos.y, videoWidth, videoHeight) };
  }

  const t = (currentTime - prevPos.timestamp) / timeDelta;
  const focusX = lerp(prevPos.x, nextPos.x, t);
  const focusY = lerp(prevPos.y, nextPos.y, t);

  return { scale: zoomLevel, ...calculatePan(zoomLevel, focusX, focusY, videoWidth, videoHeight) };
};