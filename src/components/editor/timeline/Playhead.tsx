// src/components/editor/Playhead.tsx
import React, { useEffect, useRef, useMemo } from "react";

interface PlayheadProps {
  height: number;       // chiều cao canvas (theo track area)
  isDragging: boolean;  // trạng thái kéo playhead
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const Playhead: React.FC<PlayheadProps> = React.memo(
  ({ height, isDragging, onMouseDown }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Memo hóa style cho playhead
    const { triangleSize, lineColor, triangleColor } = useMemo(() => {
      return {
        triangleSize: { base: 10, height: 14 },
        lineColor: "rgba(99,101,241,0.9)", // tailwind primary/blue-500
        triangleColor: isDragging ? "rgba(99,101,241,1)" : "rgba(99,101,241,1)",
      };
    }, [isDragging]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Vẽ line ---
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, height);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // --- Vẽ triangle ở trên cùng, hướng xuống dưới ---
      const triW = triangleSize.base;
      const triH = triangleSize.height;
      const x = canvas.width / 2;
      const y = 0;  // Vị trí trên cùng

      ctx.beginPath();
      ctx.moveTo(x, y + triH);  // Điểm dưới cùng
      ctx.lineTo(x - triW, y);  // Vẽ lên trên bên trái
      ctx.lineTo(x + triW, y);  // Vẽ lên trên bên phải
      ctx.closePath();
      ctx.fillStyle = triangleColor;
      ctx.fill();
      ctx.shadowColor = "rgba(0,0,0,0.2)";
      ctx.shadowBlur = isDragging ? 8 : 4;
      ctx.shadowOffsetY = 2;  // Thêm bóng đổ cho đẹp hơn
    }, [height, triangleSize, lineColor, triangleColor, isDragging]);

    return (
      <div 
        style={{
          position: 'relative',
          width: '20px',
          height: '100%',
          marginLeft: '-10px',
          pointerEvents: 'auto',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={onMouseDown}
      >
        <canvas
          ref={canvasRef}
          width={20}
          height={height}
          style={{
            display: 'block',
            pointerEvents: 'none'
          }}
        />
      </div>
    );
  }
);
