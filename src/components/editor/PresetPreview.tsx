import { useMemo, useRef, useState, useEffect } from 'react';
import { WALLPAPERS } from '../../lib/constants';
import { FrameStyles, AspectRatio, WebcamStyles, WebcamPosition } from '../../types/store';
import { Video } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PresetPreviewProps {
  styles: FrameStyles;
  aspectRatio: AspectRatio;
  isWebcamVisible?: boolean;
  webcamPosition?: WebcamPosition;
  webcamStyles?: WebcamStyles;
}

const REFERENCE_WIDTH = 1280;

// Helper function to create styles for the background
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
      // Use media:// protocol to point to files within the app
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

export function PresetPreview({ styles, aspectRatio, isWebcamVisible, webcamPosition, webcamStyles }: PresetPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(0);

  // Measure the actual width of the component when it is rendered
  useEffect(() => {
    if (previewRef.current) {
      setPreviewWidth(previewRef.current.offsetWidth);
    }
    // ResizeObserver can be added here to handle layout changes,
    // but in a fixed modal, useEffect is sufficient.
  }, []);

  const { scaledStyles, cssAspectRatio } = useMemo(() => {
    // Calculate scale factor
    const scaleFactor = previewWidth > 0 ? previewWidth / REFERENCE_WIDTH : 0;

    const scaledShadowBlur = styles.shadow * 1.5 * scaleFactor;
    const scaledShadowY = styles.shadow * scaleFactor;

    return {
      cssAspectRatio: aspectRatio.replace(':', ' / '),
      scaledStyles: {
        padding: `${styles.padding}%`, // Padding is % so no scaling is needed
        borderRadius: `${styles.borderRadius * scaleFactor}px`,
        borderWidth: `${styles.borderWidth * scaleFactor}px`,
        filter: `drop-shadow(0px ${scaledShadowY}px ${scaledShadowBlur}px ${styles.shadowColor})`,
        borderStyle: 'solid',
        borderColor: 'rgba(255, 255, 255, 0.3)',
      }
    };
  }, [styles, aspectRatio, previewWidth]);

  const fakeWebcamStyle = useMemo(() => {
    if (!webcamStyles) return {};
    const shadowBlur = webcamStyles.shadow * 1.5;
    const shadowOffsetY = webcamStyles.shadow;
    return {
      height: `${webcamStyles.size}%`,
      filter: `drop-shadow(0px ${shadowOffsetY}px ${shadowBlur}px ${webcamStyles.shadowColor})`,
    };
  }, [webcamStyles]);

  const fakeWebcamClasses = useMemo(() => {
    if (!webcamPosition) return '';
    return cn(
      'absolute z-20 aspect-square overflow-hidden rounded-[35%]',
      'transition-all duration-300 ease-in-out',
      {
        'top-4 left-4': webcamPosition.pos === 'top-left',
        'top-4 right-4': webcamPosition.pos === 'top-right',
        'bottom-4 left-4': webcamPosition.pos === 'bottom-left',
        'bottom-4 right-4': webcamPosition.pos === 'bottom-right',
      }
    );
  }, [webcamPosition]);

  const backgroundStyle = useMemo(() => generateBackgroundStyle(styles.background), [styles.background]);

  return (
    <div
      ref={previewRef}
      className="w-full rounded-lg flex items-center justify-center transition-all duration-300 ease-out"
      style={{ ...backgroundStyle, aspectRatio: cssAspectRatio }}
    >
      <div className="w-full h-full" style={{ padding: scaledStyles.padding, position: 'relative' }}>
        <div
          className="w-full h-full bg-card/50 backdrop-blur-sm p-1"
          style={{
            borderRadius: scaledStyles.borderRadius,
            border: `${scaledStyles.borderWidth} solid ${scaledStyles.borderColor}`,
            filter: scaledStyles.filter,
          }}
        >
          <div
            className="w-full h-full bg-muted/30"
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
          {/* Fake Webcam Preview */}
          {isWebcamVisible && webcamStyles && webcamPosition && (
            <div className={fakeWebcamClasses} style={fakeWebcamStyle}>
              <div className="w-full h-full bg-card/60 flex items-center justify-center">
                <Video className="w-1/2 h-1/2 text-foreground/40" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}