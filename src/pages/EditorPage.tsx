// src/pages/EditorPage.tsx
import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Preview } from '../components/editor/Preview';
import { SidePanel } from '../components/editor/SidePanel';
import { Timeline } from '../components/editor/Timeline';
import { PreviewControls } from '../components/editor/PreviewControls';
import { ExportButton } from '../components/editor/ExportButton';
import { ExportModal, ExportSettings } from '../components/editor/ExportModal';
import { ExportProgressOverlay } from '../components/editor/ExportProgressOverlay';
import { WindowControls } from '../components/editor/WindowControls';
import { Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils';

export function EditorPage() {
  const { loadProject, theme, toggleTheme } = useEditorStore((state) => state);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExportModalOpen, setExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null);

  useEffect(() => {
    window.electronAPI.getPlatform().then(setPlatform);

    const cleanup = window.electronAPI.onProjectOpen(async (payload) => {
      console.log('Received project to open:', payload);
      await loadProject(payload);
    });

    return cleanup;
  }, [loadProject]);

  useEffect(() => {
    const cleanProgressListener = window.electronAPI.onExportProgress(({ progress }) => {
      setExportProgress(progress);
    });

    const cleanCompleteListener = window.electronAPI.onExportComplete(({ success, outputPath, error }) => {
      setIsExporting(false);
      setExportProgress(100);
      if (success) {
        alert(`Export successful! Saved to:\n${outputPath}`);
      } else {
        alert(`Export failed:\n${error}`);
      }
    });

    return () => {
      cleanProgressListener();
      cleanCompleteListener();
    };
  }, []);

  const handleStartExport = async (settings: ExportSettings) => {
    setExportModalOpen(false);

    const defaultPath = `ScreenAwesome-Export-${Date.now()}.${settings.format}`;
    const result = await window.electronAPI.showSaveDialog({
      title: 'Save Video',
      defaultPath,
      filters: settings.format === 'mp4'
        ? [{ name: 'MP4 Video', extensions: ['mp4'] }]
        : [{ name: 'GIF Animation', extensions: ['gif'] }],
    });

    if (result.canceled || !result.filePath) {
      console.log('User cancelled the save dialog.');
      return;
    }

    const fullState = useEditorStore.getState();

    const plainState = {
      videoPath: fullState.videoPath,
      metadata: fullState.metadata,
      videoDimensions: fullState.videoDimensions,
      duration: fullState.duration,
      frameStyles: fullState.frameStyles,
      aspectRatio: fullState.aspectRatio,
      zoomRegions: fullState.zoomRegions,
      cutRegions: fullState.cutRegions,
    };

    setIsExporting(true);
    setExportProgress(0);

    try {
      await window.electronAPI.startExport({
        projectState: plainState,
        exportSettings: settings,
        outputPath: result.filePath,
      });
    } catch (e) {
      console.error("Export invocation failed", e);
      alert(`An error occurred while starting the export: ${e}`);
      setIsExporting(false);
    }
  };

  return (
    <main className="h-screen w-screen bg-background flex flex-col overflow-hidden select-none">
      {/* Custom Draggable Title Bar */}
      <header
        className="relative h-14 flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm"
        style={{ WebkitAppRegion: 'drag' }}
      >
        {/* Left Side: Custom controls for Win/Linux */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          {platform !== 'darwin' && <WindowControls />}
        </div>

        {/* Center: Title */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">ScreenAwesome</h1>
        </div>

        {/* Right Side: Export Button */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={cn(
              'h-9 w-9 rounded-full',
              'flex items-center justify-center',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-accent/50 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-ring focus-visible:ring-offset-2',
              'ring-offset-background'
            )}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <ExportButton
            isExporting={isExporting}
            onClick={() => setExportModalOpen(true)}
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Side Panel */}
        <div className="w-96 flex-shrink-0 bg-sidebar border-r border-sidebar-border overflow-hidden">
          <SidePanel />
        </div>

        {/* Center Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Preview Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex items-center justify-center m-6 overflow-hidden rounded-xl bg-muted/20 border border-border/50">
              <Preview videoRef={videoRef} />
            </div>
            <div className="flex-shrink-0">
              <PreviewControls videoRef={videoRef} />
            </div>
          </div>

          {/* Timeline Area */}
          <div className="h-48 flex-shrink-0 bg-card/30 border-t border-border backdrop-blur-sm overflow-hidden">
            <Timeline videoRef={videoRef} />
          </div>
        </div>
      </div>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onStartExport={handleStartExport}
      />
      <ExportProgressOverlay
        isExporting={isExporting}
        progress={exportProgress}
      />
    </main>
  );
}