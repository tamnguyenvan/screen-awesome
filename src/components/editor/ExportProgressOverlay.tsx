// src/components/editor/ExportProgressOverlay.tsx

interface ExportProgressOverlayProps {
  isExporting: boolean;
  progress: number;
}

export function ExportProgressOverlay({ isExporting, progress }: ExportProgressOverlayProps) {
  if (!isExporting) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-center text-white">
      <h2 className="text-2xl font-bold mb-4">Exporting Video...</h2>
      <div className="w-1/2 bg-gray-600 rounded-full h-4">
        <div
          className="bg-primary h-4 rounded-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <p className="mt-2 text-lg">{progress}%</p>
      <p className="mt-4 text-sm text-muted-foreground">Please wait, this may take a while.</p>
    </div>
  );
}