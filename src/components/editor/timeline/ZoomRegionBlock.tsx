import { memo } from 'react';
import { TimelineRegion, ZoomRegion } from '../../../store/editorStore';
import { cn } from '../../../lib/utils';
import { Search } from 'lucide-react';

interface ZoomRegionBlockProps {
  region: ZoomRegion;
  left: number;
  width: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => void;
  setRef: (el: HTMLDivElement | null) => void;
}

export const ZoomRegionBlock = memo(({
  region,
  left,
  width,
  isSelected,
  onMouseDown,
  setRef
}: ZoomRegionBlockProps) => (
  <div
    ref={setRef}
    data-region-id={region.id}
    className={cn(
      'absolute h-14 flex items-center justify-center rounded-lg overflow-hidden',
      'cursor-move border-2', // Simplified classes
      isSelected 
        ? 'bg-primary/20 border-primary' // Use a solid border for selection
        : 'bg-muted/80 border-border'
    )}
    style={{ left: `${left}px`, width: `${width}px` }}
    onMouseDown={(e) => onMouseDown(e, region, 'move')}
  >
    <div 
      className="absolute left-0 top-0 w-2 h-full cursor-ew-resize rounded-l-md flex items-center justify-center"
      onMouseDown={(e) => onMouseDown(e, region, 'resize-left')}
    >
        <div className="w-0.5 h-1/2 bg-primary/80 rounded-full" />
    </div>
    
    <div className="pointer-events-none flex items-center gap-2 px-2">
      <Search className="w-4 h-4 text-primary/90" />
      {width > 80 && (
        <span className="text-xs font-medium text-primary/90">Zoom</span>
      )}
    </div>
    
    <div 
      className="absolute right-0 top-0 w-2 h-full cursor-ew-resize rounded-r-md flex items-center justify-center"
      onMouseDown={(e) => onMouseDown(e, region, 'resize-right')}
    >
        <div className="w-0.5 h-1/2 bg-primary/80 rounded-full" />
    </div>
  </div>
));

ZoomRegionBlock.displayName = 'ZoomRegionBlock';