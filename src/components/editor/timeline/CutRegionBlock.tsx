// src/components/editor/timeline/CutRegionBlock.tsx

import { memo } from 'react';
import { TimelineRegion, CutRegion } from '../../../types/store';
import { cn } from '../../../lib/utils';
import { Scissors } from 'lucide-react';

interface CutRegionBlockProps {
  region: CutRegion;
  isSelected: boolean;
  isDragging: boolean; // Prop mới
  isDraggable?: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => void;
  setRef: (el: HTMLDivElement | null) => void;
}

export const CutRegionBlock = memo(({
  region,
  isSelected,
  isDragging,
  isDraggable = true,
  onMouseDown,
  setRef
}: CutRegionBlockProps) => {
  const isTrimRegion = !!region.trimType;
  const canMove = isDraggable && !isTrimRegion;
  const canResizeLeft = isDraggable && region.trimType !== 'start';
  const canResizeRight = isDraggable && region.trimType !== 'end';

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    if (!isDraggable) return;
    onMouseDown(e, region, type);
  };

  return (
    <div
      ref={setRef}
      data-region-id={region.id}
      className={cn(
        'w-full h-full pointer-events-none',
        'bg-gray-100/30 dark:bg-gray-700/50',
      )}
      style={{ willChange: 'transform, width' }}
    >
      <div
        className={cn(
          'relative w-full h-14 mt-[72px] flex items-center justify-center rounded-lg',
          'border-2 border-gray-400 dark:border-gray-500',
          'bg-gray-200/80 dark:bg-gray-600/80',
          'backdrop-blur-sm',
          'pointer-events-auto',
          'transition-colors duration-200',
          canMove ? 'cursor-grab' : 'cursor-default',
          isSelected && !isDragging && [
            'transform -translate-y-2',
            'shadow-lg shadow-gray-400/20 dark:shadow-gray-700/50',
            'border-gray-500 dark:border-gray-400',
            'bg-gray-300/90 dark:bg-gray-500/90'
          ],
          isSelected ? 'z-20' : 'z-10'
        )}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        {canResizeLeft && (
          <div
            className="absolute left-0 top-0 w-4 h-full cursor-ew-resize rounded-l-md flex items-center justify-center z-30 group"
            onMouseDown={(e) => handleMouseDown(e, 'resize-left')}>
            <div className="w-0.5 h-1/2 bg-gray-500/70 dark:bg-gray-300/70 rounded-full group-hover:bg-gray-600 dark:group-hover:bg-white transition-colors" />
          </div>
        )}
        <div className="pointer-events-none flex items-center gap-2 px-2">
          <Scissors className="w-4 h-4 text-gray-700/90 dark:text-gray-200/90" />
        </div>
        {canResizeRight && (
          <div
            className="absolute right-0 top-0 w-4 h-full cursor-ew-resize rounded-r-md flex items-center justify-center z-30 group"
            onMouseDown={(e) => handleMouseDown(e, 'resize-right')}>
            <div className="w-0.5 h-1/2 bg-gray-500/70 dark:bg-gray-300/70 rounded-full group-hover:bg-gray-600 dark:group-hover:bg-white transition-colors" />
          </div>
        )}
      </div>
    </div>
  );
});
CutRegionBlock.displayName = 'CutRegionBlock';