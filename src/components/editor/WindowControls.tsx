// src/components/editor/WindowControls.tsx
import { Minus, Maximize2, X } from 'lucide-react';

export function WindowControls() {
  const handleMinimize = () => window.electronAPI.minimizeWindow();
  const handleMaximize = () => window.electronAPI.maximizeWindow();
  const handleClose = () => window.electronAPI.closeWindow();

  return (
    <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
      <button
        onClick={handleClose}
        className="group w-3.5 h-3.5 bg-red-500 rounded-full flex justify-center items-center border border-red-600/50 transition-colors hover:bg-red-600"
        aria-label="Close"
      >
        <X className="w-2 h-2 text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <button
        onClick={handleMinimize}
        className="group w-3.5 h-3.5 bg-yellow-500 rounded-full flex justify-center items-center border border-yellow-600/50 transition-colors hover:bg-yellow-600"
        aria-label="Minimize"
      >
        <Minus className="w-2 h-2 text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <button
        onClick={handleMaximize}
        className="group w-3.5 h-3.5 bg-green-500 rounded-full flex justify-center items-center border border-green-600/50 transition-colors hover:bg-green-600"
        aria-label="Maximize"
      >
        <Maximize2 className="w-2 h-2 text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}