import { useEditorStore } from '../store/editorStore';
import { ZOOM } from './constants';
import { EASING_MAP } from './easing';

function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t;
}

/**
 * Calculates the transform-origin based on a normalized anchor point [-0.5, 0.5].
 * Implements edge snapping. The output is a value from 0 to 1.
 */
function getTransformOrigin(anchorX: number, anchorY: number, zoomLevel: number, framePadding: number): { x: number; y: number } {
  const DEAD_ZONE = ZOOM.TRANSFORM_ORIGIN_DEAD_ZONE;
  let originX: number;
  let originY: number;

  const normalizedX = zoomLevel * anchorX * (1 - framePadding * 0.01);
  const normalizedY = zoomLevel * anchorY * (1 - framePadding * 0.01);

  if (normalizedX > DEAD_ZONE) originX = 1;
  else if (normalizedX < -DEAD_ZONE) originX = 0;
  else originX = anchorX + 0.5;

  if (normalizedY > DEAD_ZONE) originY = 1;
  else if (normalizedY < -DEAD_ZONE) originY = 0;
  else originY = anchorY + 0.5;
  
  return { x: originX, y: originY };
}

export const calculateZoomTransform = (currentTime: number) => {
  const { zoomRegions, activeZoomRegionId, frameStyles } = useEditorStore.getState();
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
  const zoomOutStartTime = startTime + duration - ZOOM.TRANSITION_DURATION;
  const zoomInEndTime = startTime + ZOOM.TRANSITION_DURATION;

  // --- Phase 1: ZOOM-IN ---
  if (currentTime >= startTime && currentTime < zoomInEndTime) {
    const firstAnchor = anchors[0];
    const targetOrigin = getTransformOrigin(firstAnchor.x, firstAnchor.y, zoomLevel, frameStyles.padding);
    
    // Animate scale from 1 to zoomLevel.
    const t = EASING_MAP[ZOOM.ZOOM_EASING as keyof typeof EASING_MAP]((currentTime - startTime) / ZOOM.TRANSITION_DURATION);
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
    const fixedOrigin = getTransformOrigin(firstAnchor.x, firstAnchor.y, zoomLevel, frameStyles.padding);

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
    const t = EASING_MAP[ZOOM.PAN_EASING as keyof typeof EASING_MAP](Math.min(1, progressInSegment));

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
    const fixedOrigin = getTransformOrigin(firstAnchor.x, firstAnchor.y, zoomLevel, frameStyles.padding);
    
    // Animate scale from zoomLevel back to 1.
    const t = EASING_MAP[ZOOM.ZOOM_EASING as keyof typeof EASING_MAP]((currentTime - zoomOutStartTime) / ZOOM.TRANSITION_DURATION);
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