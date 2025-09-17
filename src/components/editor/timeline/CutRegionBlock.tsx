import { memo, MouseEvent as ReactMouseEvent } from 'react';
import { TimelineRegion, CutRegion } from '../../../store/editorStore';
import { cn } from '../../../lib/utils';
import { Scissors } from 'lucide-react';

interface CutRegionBlockProps {
  region: CutRegion;
  left: number;
  width: number;
  isSelected: boolean;
  isDraggable?: boolean;
  onMouseDown: (e: ReactMouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => void;
  setRef: (el: HTMLDivElement | null) => void;
}

export const CutRegionBlock = memo(function CutRegionBlock({
  region,
  left,
  width,
  isSelected,
  isDraggable = true,
  onMouseDown,
  setRef
}: CutRegionBlockProps) {
  const isTrimRegion = region.trimType === 'start' || region.trimType === 'end';

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>, type: 'move' | 'resize-left' | 'resize-right') => {
    // Nếu là vùng trim đặc biệt, không cho phép di chuyển 'move'
    if (isTrimRegion && type === 'move') return;

    if (!isDraggable) return;
    onMouseDown(e, region, type);
  }

  const canResizeLeft = isDraggable && (!isTrimRegion || region.trimType === 'end');
  const canResizeRight = isDraggable && (!isTrimRegion || region.trimType === 'start');

  return (
    <div
      ref={setRef}
      data-region-id={region.id}
      className={cn(
        "absolute h-14 flex items-center transition-all duration-75",
        // Apply border radius based on trim type and resize handles
        'rounded-lg', // Default rounded corners for non-trim regions
        isDraggable && "border shadow-xs",
        isDraggable && (isSelected
          ? "bg-destructive/10 border-2 border-destructive/60"
          : "bg-muted/60 border-2 border-border/60 hover:bg-muted/80 hover:border-border/80"),
        // Thay đổi con trỏ dựa trên loại region
        isDraggable && (isTrimRegion ? "cursor-default" : "cursor-pointer"),
        isDraggable
          ? [ // Styles cho region tương tác được
            "border-2 shadow-xs",
            isSelected
              ? "bg-destructive/10 border-2 border-destructive/60"
              : "bg-muted/60 border-2 border-border/60 hover:bg-muted/80 hover:border-border/80",
            isTrimRegion ? "cursor-default" : "cursor-pointer"
          ]
          : [ // Styles cho PREVIEW region (không tương tác được)
            "bg-destructive/10 border-2 border-dashed border-destructive/40 backdrop-blur-sm",
            "cursor-default pointer-events-none"
          ],
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      {/* Hiển thị handle resize bên trái có điều kiện */}
      {canResizeLeft && (
        <div
          className="absolute left-0 top-0 w-1 h-full bg-destructive/60 rounded-l-lg cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity duration-200"
          onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
        />
      )}

      {/* Ẩn các handle resize nếu không draggable */}
      {isDraggable && !isTrimRegion && (
        <>
          {/* Left resize handle */}
          <div
            className="absolute left-0 top-0 w-1 h-full bg-destructive/60 rounded-l-lg cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity duration-200"
            onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
          />
          {/* Right resize handle */}
          <div
            className="absolute right-0 top-0 w-1 h-full bg-destructive/60 rounded-r-lg cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity duration-200"
            onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
          />
        </>
      )}

      {/* Content area */}
      <div className="w-full flex items-center justify-center gap-2 px-3 pointer-events-none">
        <Scissors className={cn("w-4 h-4", isDraggable ? "text-destructive/80" : "text-destructive/60")} />
        <span className={cn("text-sm font-medium", isDraggable ? "text-destructive/80" : "text-destructive/60")}>Trim</span>
      </div>

      {/* Hiển thị handle resize bên phải có điều kiện */}
      {canResizeRight && (
        <div
          className="absolute right-0 top-0 w-1 h-full bg-destructive/60 rounded-r-lg cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity duration-200"
          onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
        />
      )}
    </div>
  );
});