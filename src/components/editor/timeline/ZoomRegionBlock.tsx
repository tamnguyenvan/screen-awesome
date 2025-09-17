// src/components/editor/timeline/ZoomRegionBlock.tsx
import { memo } from 'react';
import { TimelineRegion, ZoomRegion } from '../../../store/editorStore';
import { cn } from '../../../lib/utils';
import { Search } from 'lucide-react';

interface ZoomRegionBlockProps {
  region: ZoomRegion;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => void;
  setRef: (el: HTMLDivElement | null) => void;
}

export const ZoomRegionBlock = memo(({
  region,
  isSelected,
  onMouseDown,
  setRef
}: ZoomRegionBlockProps) => (
  <div
    ref={setRef}
    data-region-id={region.id}
    className={cn(
      'w-full h-full flex items-center justify-center rounded-lg overflow-hidden relative', // Take full space
      'cursor-move border-2 border-border',
      'bg-muted/80' // Base gray background
    )}
    onMouseDown={(e) => onMouseDown(e, region, 'move')}
  >
    <div 
      className="absolute left-0 top-0 w-2 h-full cursor-ew-resize rounded-l-md flex items-center justify-center"
      onMouseDown={(e) => onMouseDown(e, region, 'resize-left')} >
        <div className="w-0.5 h-1/2 bg-primary/80 rounded-full" />
    </div>
    {/* Overlay layer that shows when selected */}
    {isSelected && (
      <div className="absolute inset-0 bg-primary/80" />
    )}
    <div className="pointer-events-none flex items-center gap-2 px-2 relative z-10">
      <Search className="w-4 h-4 text-primary-foreground" />
      <span className="text-xs font-medium text-primary-foreground">Zoom</span>
    </div>
    <div 
      className="absolute right-0 top-0 w-2 h-full cursor-ew-resize rounded-r-md flex items-center justify-center"
      onMouseDown={(e) => onMouseDown(e, region, 'resize-right')} >
        <div className="w-0.5 h-1/2 bg-primary/80 rounded-full" />
    </div>
  </div>
));
ZoomRegionBlock.displayName = 'ZoomRegionBlock';