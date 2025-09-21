import { useEditorStore } from '../store/editorStore';
// import { AnchorPoint } from '../types/store';

const ZOOM_TRANSITION_DURATION = 0.8;
const PAN_SMOOTHING_FACTOR = 0.08;

// Biến này lưu vị trí trung tâm của "camera" theo tọa độ chuẩn hóa [-0.5, 0.5]
let cameraPan = { x: 0, y: 0 };

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t;
}

export const calculateZoomTransform = (currentTime: number) => {
  const { zoomRegions, activeZoomRegionId } = useEditorStore.getState();
  const activeRegion = activeZoomRegionId ? zoomRegions[activeZoomRegionId] : undefined;
  
  const defaultTransform = { scale: 1, translateX: 0, translateY: 0 };
  if (!activeRegion) {
    cameraPan = { x: 0, y: 0 };
    return defaultTransform;
  }
  
  const { startTime, duration, zoomLevel, mode, targetX, targetY, anchors } = activeRegion;
  const elapsed = currentTime - startTime;
  const zoomOutStartTime = duration - ZOOM_TRANSITION_DURATION;
  
  let scale = 1.0;

  // --- 1. Calculate Scale ---
  if (elapsed >= 0 && elapsed <= ZOOM_TRANSITION_DURATION) {
    const t = easeInOutCubic(elapsed / ZOOM_TRANSITION_DURATION);
    scale = lerp(1, zoomLevel, t);
  } else if (elapsed > ZOOM_TRANSITION_DURATION && elapsed < zoomOutStartTime) {
    scale = zoomLevel;
  } else if (elapsed >= zoomOutStartTime && elapsed <= duration) {
    const t = easeInOutCubic((elapsed - zoomOutStartTime) / ZOOM_TRANSITION_DURATION);
    scale = lerp(zoomLevel, 1, t);
  } else {
    cameraPan = { x: 0, y: 0 };
    return defaultTransform;
  }
  
  // --- 2. Determine Target Pan Position ---
  let targetPan = { x: 0, y: 0 };
  
  // --- DEBUG: TẠM THỜI VÔ HIỆU HÓA TRACKING CHUỘT ---
  // Camera sẽ luôn nhắm vào điểm targetX, targetY cố định của vùng zoom.
  targetPan = { x: targetX, y: targetY };
  
  if (mode === 'fixed' || !anchors || anchors.length === 0) {
    targetPan = { x: targetX, y: targetY };
  } else { // 'auto' mode with anchors
    // const panStartTime = startTime + ZOOM_TRANSITION_DURATION;
    const panEndTime = startTime + duration - ZOOM_TRANSITION_DURATION;

    if (elapsed <= ZOOM_TRANSITION_DURATION) {
      // Giai đoạn 1: Zoom-in
      // Lia từ trung tâm (0,0) đến anchor đầu tiên
      const t = easeInOutCubic(elapsed / ZOOM_TRANSITION_DURATION);
      targetPan = {
        x: lerp(0, anchors[0].x, t),
        y: lerp(0, anchors[0].y, t),
      };
    } else if (elapsed >= panEndTime - startTime) {
      // Giai đoạn 3: Zoom-out
      // Lia từ anchor cuối cùng về trung tâm (0,0)
      const lastAnchor = anchors[anchors.length - 1];
      const t = easeInOutCubic((elapsed - (panEndTime - startTime)) / ZOOM_TRANSITION_DURATION);
      targetPan = {
        x: lerp(lastAnchor.x, 0, t),
        y: lerp(lastAnchor.y, 0, t),
      };
    } else {
      // Giai đoạn 2: Lia giữa các điểm neo
      // Tìm segment anchor hiện tại
      let currentAnchorIndex = -1;
      for (let i = 0; i < anchors.length - 1; i++) {
        if (currentTime >= anchors[i].time && currentTime < anchors[i+1].time) {
          currentAnchorIndex = i;
          break;
        }
      }

      if (currentAnchorIndex !== -1) {
        const startAnchor = anchors[currentAnchorIndex];
        const endAnchor = anchors[currentAnchorIndex + 1];
        
        const segmentDuration = endAnchor.time - startAnchor.time;
        const progressInSegment = (currentTime - startAnchor.time) / segmentDuration;
        const t = easeInOutCubic(progressInSegment);

        targetPan = {
          x: lerp(startAnchor.x, endAnchor.x, t),
          y: lerp(startAnchor.y, endAnchor.y, t),
        };
      } else {
        // Nếu không nằm trong segment nào (ví dụ, sau anchor cuối), giữ ở anchor cuối
        targetPan = anchors[anchors.length - 1];
      }
    }
  }
  
  // --- 3. Apply Smoothing and Clamping ---
  cameraPan.x = lerp(cameraPan.x, targetPan.x, PAN_SMOOTHING_FACTOR);
  cameraPan.y = lerp(cameraPan.y, targetPan.y, PAN_SMOOTHING_FACTOR);

  const viewportHalfWidth = 0.5 / scale;
  const viewportHalfHeight = 0.5 / scale;
  cameraPan.x = Math.max(-0.5 + viewportHalfWidth, Math.min(cameraPan.x, 0.5 - viewportHalfWidth));
  cameraPan.y = Math.max(-0.5 + viewportHalfHeight, Math.min(cameraPan.y, 0.5 - viewportHalfHeight));
  
  // --- 4. Calculate Final CSS Translate ---
  const translateX = -cameraPan.x * 100;
  const translateY = -cameraPan.y * 100;
  
  return { scale, translateX, translateY };
};