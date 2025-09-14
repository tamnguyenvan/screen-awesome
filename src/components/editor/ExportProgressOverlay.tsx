// src/components/editor/ExportProgressOverlay.tsx
import { Loader2 } from 'lucide-react';

interface ExportProgressOverlayProps {
  isExporting: boolean;
  progress: number;
}

export function ExportProgressOverlay({ isExporting, progress }: ExportProgressOverlayProps) {
  if (!isExporting) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card text-card-foreground rounded-lg shadow-xl p-8 w-full max-w-sm flex flex-col items-center border border-border">
        
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        
        <h2 className="text-xl font-semibold text-foreground mb-2">Exporting Video...</h2>
        <p className="text-sm text-muted-foreground mb-6 text-center">Please wait, this may take a while.</p>

        <div className="w-full bg-muted/50 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <p className="mt-3 text-sm font-mono text-primary font-medium">{progress}%</p>
      </div>
    </div>
  );
}