import { useEditorStore } from '../store/editorStore';

const ZOOM_TRANSITION_DURATION = 0.8;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t;
}

/**
 * Calculates the transform-origin based on a normalized anchor point [-0.5, 0.5].
 * Implements edge snapping. The output is a value from 0 to 1.
 */
function getTransformOrigin(anchorX: number, anchorY: number): { x: number; y: number } {
  const DEAD_ZONE = 0.4;
  let originX: number;
  let originY: number;

  if (anchorX > DEAD_ZONE) originX = 1;
  else if (anchorX < -DEAD_ZONE) originX = 0;
  else originX = anchorX + 0.5;

  if (anchorY > DEAD_ZONE) originY = 1;
  else if (anchorY < -DEAD_ZONE) originY = 0;
  else originY = anchorY + 0.5;
  
  return { x: originX, y: originY };
}

export const calculateZoomTransform = (currentTime: number) => {
  const { zoomRegions, activeZoomRegionId } = useEditorStore.getState();
  const activeRegion = activeZoomRegionId ? zoomRegions[activeZoomRegionId] : undefined;
  
  const defaultTransform = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    transformOrigin: '50% 50%',
  };

  if (!activeRegion || !activeRegion.anchors || activeRegion.anchors.length === 0) {
    return defaultTransform;
  }

  const { startTime, duration, zoomLevel, anchors } = activeRegion;
  const zoomOutStartTime = startTime + duration - ZOOM_TRANSITION_DURATION;
  const zoomInEndTime = startTime + ZOOM_TRANSITION_DURATION;

  // --- Phase 1: ZOOM-IN ---
  if (currentTime >= startTime && currentTime < zoomInEndTime) {
    const firstAnchor = anchors[0];
    const targetOrigin = getTransformOrigin(firstAnchor.x, firstAnchor.y);
    
    // Animate scale from 1 to zoomLevel.
    const t = easeInOutCubic((currentTime - startTime) / ZOOM_TRANSITION_DURATION);
    const scale = lerp(1, zoomLevel, t);

    // During zoom-in, we don't translate. The zoom effect is created by
    // setting the origin and scaling.
    return {
      scale,
      translateX: 0,
      translateY: 0,
      transformOrigin: `${targetOrigin.x * 100}% ${targetOrigin.y * 100}%`,
    };
  }
  
  // --- Phase 2: PAN ---
  if (currentTime >= zoomInEndTime && currentTime < zoomOutStartTime) {
    const scale = zoomLevel;

    // The transform-origin is now fixed to where we zoomed in.
    const firstAnchor = anchors[0];
    const fixedOrigin = getTransformOrigin(firstAnchor.x, firstAnchor.y);

    // Find current anchor segment for panning
    let startAnchor = firstAnchor;
    let endAnchor = anchors.length > 1 ? anchors[1] : firstAnchor;
    
    // Find the segment the currentTime falls into
    for (let i = 0; i < anchors.length - 1; i++) {
        const current = anchors[i];
        const next = anchors[i+1];
        if (currentTime >= current.time && currentTime < next.time) {
            startAnchor = current;
            endAnchor = next;
            break;
        }
    }
    // If we're past the last anchor's time, hold at the last anchor
    if(currentTime >= anchors[anchors.length - 1].time) {
        startAnchor = endAnchor = anchors[anchors.length - 1];
    }

    // Interpolation factor within the current segment
    const segmentDuration = endAnchor.time - startAnchor.time;
    const progressInSegment = segmentDuration > 0 ? (currentTime - startAnchor.time) / segmentDuration : 1;
    const t = easeInOutCubic(Math.min(1, progressInSegment));

    // Calculate translation. We need to move the view from the fixedOrigin point
    // to the interpolated anchor point.
    const targetX = lerp(startAnchor.x, endAnchor.x, t);
    const targetY = lerp(startAnchor.y, endAnchor.y, t);

    // The translation needed is the delta from the origin point (first anchor)
    // to the current target point.
    const deltaX = targetX - firstAnchor.x;
    const deltaY = targetY - firstAnchor.y;
    
    // Convert normalized delta [-1, 1] to percentage translation [-100%, 100%].
    const translateX = -deltaX * 100;
    const translateY = -deltaY * 100;

    return {
      scale,
      translateX,
      translateY,
      transformOrigin: `${fixedOrigin.x * 100}% ${fixedOrigin.y * 100}%`,
    };
  }

  // --- Phase 3: ZOOM-OUT ---
  if (currentTime >= zoomOutStartTime && currentTime <= startTime + duration) {
    const lastAnchor = anchors[anchors.length - 1];
    const firstAnchor = anchors[0];
    const fixedOrigin = getTransformOrigin(firstAnchor.x, firstAnchor.y);
    
    // Animate scale from zoomLevel back to 1.
    const t = easeInOutCubic((currentTime - zoomOutStartTime) / ZOOM_TRANSITION_DURATION);
    const scale = lerp(zoomLevel, 1, t);
    
    // We also need to reverse the pan to get back to the origin point
    const deltaX = lastAnchor.x - firstAnchor.x;
    const deltaY = lastAnchor.y - firstAnchor.y;
    
    const startTranslateX = -deltaX * 100;
    const startTranslateY = -deltaY * 100;
    
    const translateX = lerp(startTranslateX, 0, t);
    const translateY = lerp(startTranslateY, 0, t);

    return {
      scale,
      translateX,
      translateY,
      transformOrigin: `${fixedOrigin.x * 100}% ${fixedOrigin.y * 100}%`,
    };
  }

  // --- Phase 4: DEFAULT ---
  return defaultTransform;
};