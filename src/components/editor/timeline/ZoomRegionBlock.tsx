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
      'transition-colors duration-200 cursor-move',
      isSelected 
        ? 'bg-zinc-900/10 border border-zinc-900/30' 
        : 'bg-zinc-900/5 hover:bg-zinc-900/10 border border-zinc-900/20'
    )}
    style={{ left: `${left}px`, width: `${width}px` }}
    onMouseDown={(e) => onMouseDown(e, region, 'move')}
  >
    <div 
      className="absolute left-0 top-0 w-1 h-full bg-zinc-900/60 cursor-ew-resize"
      onMouseDown={(e) => onMouseDown(e, region, 'resize-left')}
    />
    
    <div className="flex items-center gap-2 px-2">
      <Search className="w-3.5 h-3.5 text-zinc-900/80" />
      {width > 80 && (
        <span className="text-xs font-medium text-zinc-900/80">Zoom</span>
      )}
    </div>
    
    <div 
      className="absolute right-0 top-0 w-1 h-full bg-zinc-900/60 cursor-ew-resize"
      onMouseDown={(e) => onMouseDown(e, region, 'resize-right')}
    />
  </div>
));

ZoomRegionBlock.displayName = 'ZoomRegionBlock';