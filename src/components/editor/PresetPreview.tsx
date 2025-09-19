// --- FILE: src/components/editor/PresetPreview.tsx ---

import { useMemo, useRef, useState, useEffect } from 'react';
import { WALLPAPERS } from '../../lib/constants';
import { FrameStyles, AspectRatio } from '../../types/store';

interface PresetPreviewProps {
  styles: FrameStyles;
  aspectRatio: AspectRatio;
}

const REFERENCE_WIDTH = 1280;

// Helper function để tạo style cho background
const generateBackgroundStyle = (backgroundState: FrameStyles['background']) => {
  switch (backgroundState.type) {
    case 'color':
      return { background: backgroundState.color || '#ffffff' };
    case 'gradient': {
      const start = backgroundState.gradientStart || '#000000';
      const end = backgroundState.gradientEnd || '#ffffff';
      const direction = backgroundState.gradientDirection || 'to right';
      return { background: `linear-gradient(${direction}, ${start}, ${end})` };
    }
    case 'image':
    case 'wallpaper': {
      // Sử dụng protocol media:// để trỏ đến file trong app
      const imageUrl = backgroundState.imageUrl?.startsWith('blob:')
        ? backgroundState.imageUrl
        : `media://${backgroundState.imageUrl || WALLPAPERS[0].imageUrl}`;
      return {
        backgroundImage: `url("${imageUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    default:
      return { background: '#111' };
  }
};

export function PresetPreview({ styles, aspectRatio }: PresetPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(0);

  // Đo chiều rộng thực tế của component khi nó được render
  useEffect(() => {
    if (previewRef.current) {
      setPreviewWidth(previewRef.current.offsetWidth);
    }
    // ResizeObserver có thể thêm vào đây để xử lý nếu layout thay đổi,
    // nhưng trong modal cố định thì useEffect là đủ.
  }, []);

  const { scaledStyles, cssAspectRatio } = useMemo(() => {
    // Tính toán tỷ lệ scale
    const scaleFactor = previewWidth > 0 ? previewWidth / REFERENCE_WIDTH : 0;

    const scaledShadowOpacity = Math.min(styles.shadow * 0.015, 0.4);
    const scaledShadowBlur = styles.shadow * 1.5 * scaleFactor;
    const scaledShadowY = styles.shadow * scaleFactor;

    return {
      cssAspectRatio: aspectRatio.replace(':', ' / '),
      scaledStyles: {
        padding: `${styles.padding}%`, // Padding là % nên không cần scale
        borderRadius: `${styles.borderRadius * scaleFactor}px`,
        borderWidth: `${styles.borderWidth * scaleFactor}px`,
        filter: `drop-shadow(0px ${scaledShadowY}px ${scaledShadowBlur}px rgba(0, 0, 0, ${scaledShadowOpacity}))`,
        // Dùng border thay vì borderWidth trong style của element con
        borderStyle: 'solid',
        borderColor: 'rgba(255, 255, 255, 0.3)',
      }
    };
  }, [styles, aspectRatio, previewWidth]);

  const backgroundStyle = useMemo(() => generateBackgroundStyle(styles.background), [styles.background]);

  return (
    <div
      ref={previewRef}
      className="w-full rounded-lg flex items-center justify-center transition-all duration-300 ease-out"
      // --- SỬA ĐỔI: Áp dụng background và aspectRatio ---
      style={{ ...backgroundStyle, aspectRatio: cssAspectRatio }}
    >
      <div className="w-full h-full" style={{ padding: scaledStyles.padding }}>
        <div
          className="w-full h-full bg-card/50 backdrop-blur-sm p-1"
          // --- SỬA ĐỔI: Áp dụng các style đã được scale ---
          style={{
            borderRadius: scaledStyles.borderRadius,
            border: `${scaledStyles.borderWidth} solid ${scaledStyles.borderColor}`,
            filter: scaledStyles.filter,
          }}
        >
          <div
            className="w-full h-full bg-muted/30"
            // --- SỬA ĐỔI: Radius bên trong cũng phải được scale ---
            style={{
              borderRadius: `max(0px, calc(${scaledStyles.borderRadius} - ${scaledStyles.borderWidth}))`
            }}
          >
            {/* Fake content */}
            <div className="p-3">
              <div className="w-1/2 h-2 bg-foreground/20 rounded-full mb-2"></div>
              <div className="w-3/4 h-2 bg-foreground/20 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}