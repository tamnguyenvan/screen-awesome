// src/pages/EditorPage.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Preview } from '../components/editor/Preview';
import { SidePanel } from '../components/editor/SidePanel';
import { Timeline } from '../components/editor/Timeline';
import { PreviewControls } from '../components/editor/PreviewControls';
import { ExportButton } from '../components/editor/ExportButton';
import { ExportModal, ExportSettings } from '../components/editor/ExportModal';
// REMOVE THIS IMPORT
// import { ExportProgressOverlay } from '../components/editor/ExportProgressOverlay';
import { WindowControls } from '../components/editor/WindowControls';
import { Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export function EditorPage() {
  // Lấy state và actions từ store
  const { loadProject, toggleTheme, deleteRegion } = useEditorStore.getState();
  const duration = useEditorStore(state => state.duration);
  const { undo, redo } = useEditorStore.temporal.getState();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExportModalOpen, setExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  // ADD NEW STATE FOR EXPORT RESULT
  const [exportResult, setExportResult] = useState<{ success: boolean; outputPath?: string; error?: string } | null>(null);
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null);

  const handleDeleteSelectedRegion = useCallback(() => {
    // Dùng getState() để lấy selectedRegionId mới nhất bên trong callback
    const currentSelectedId = useEditorStore.getState().selectedRegionId;
    if (currentSelectedId) {
      deleteRegion(currentSelectedId);
    }
  }, [deleteRegion]);

  useKeyboardShortcuts(
    {
      'delete': handleDeleteSelectedRegion,
      'backspace': handleDeleteSelectedRegion,
      'ctrl+z': (e) => { e.preventDefault(); undo(); },
      'ctrl+y': (e) => { e.preventDefault(); redo(); },
      'ctrl+shift+z': (e) => { e.preventDefault(); redo(); }, // Common alternative for redo
    },
    [handleDeleteSelectedRegion, undo, redo]
  );

  useEffect(() => {
    window.electronAPI.getPlatform().then(setPlatform);

    const cleanup = window.electronAPI.onProjectOpen(async (payload) => {
      console.log('Received project to open:', payload);
      await loadProject(payload);
    });

    const cleanProgressListener = window.electronAPI.onExportProgress(({ progress }) => {
      setExportProgress(progress);
    });

    // --- MODIFIED EXPORT COMPLETE LISTENER ---
    const cleanCompleteListener = window.electronAPI.onExportComplete(({ success, outputPath, error }) => {
      setIsExporting(false); // Quá trình cốt lõi đã xong
      setExportProgress(100); // Đảm bảo thanh tiến trình đầy
      setExportResult({ success, outputPath, error }); // Đặt kết quả để hiển thị màn hình thành công/lỗi trong modal
    });

    return () => {
      cleanup();
      cleanProgressListener();
      cleanCompleteListener();
    };
  }, [loadProject]);

  const handleStartExport = useCallback(async (settings: ExportSettings) => {
    // Don't close the modal, just start the export process.
    // The modal will change its own view based on the `isExporting` prop.

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
      // If user cancels save, we don't start exporting. Modal remains in settings view.
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

    // Reset state for the new export
    setExportResult(null);
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
      // If starting the export fails, show an error in the modal
      setExportResult({ success: false, error: `An error occurred while starting the export: ${e}` });
      setIsExporting(false);
    }
  }, []);

  const handleCancelExport = () => {
    window.electronAPI.cancelExport();
  };

  const currentTheme = useEditorStore(state => state.theme);

  // --- ADD A HANDLER TO RESET STATE WHEN MODAL IS CLOSED ---
  const handleCloseExportModal = () => {
    setExportModalOpen(false);
    // Delay reset to avoid UI flicker during closing animation
    setTimeout(() => {
      setIsExporting(false);
      setExportProgress(0);
      setExportResult(null);
    }, 250);
  };

  return (
    <main className="h-screen w-screen bg-background flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header
        className="relative h-14 flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          {platform !== 'darwin' && <WindowControls />}
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">ScreenAwesome</h1>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={cn('h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background')}
          >
            {currentTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <ExportButton
            isExporting={isExporting}
            onClick={() => setExportModalOpen(true)}
            disabled={duration <= 0}
          />
        </div>
      </header>

      {/* Main Layout (No Changes) */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-96 flex-shrink-0 bg-sidebar border-r border-sidebar-border overflow-hidden">
          <SidePanel />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex items-center justify-center m-6 overflow-hidden rounded-xl bg-muted/20 border border-border/50">
              <Preview videoRef={videoRef} />
            </div>
            <div className="flex-shrink-0">
              <PreviewControls videoRef={videoRef} />
            </div>
          </div>
          <div className="h-48 flex-shrink-0 bg-card/30 border-t border-border backdrop-blur-sm overflow-hidden">
            <Timeline videoRef={videoRef} />
          </div>
        </div>
      </div>

      {/* --- UPDATED MODAL AND REMOVED OVERLAY --- */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={handleCloseExportModal}
        onStartExport={handleStartExport}
        onCancelExport={handleCancelExport}
        isExporting={isExporting}
        progress={exportProgress}
        result={exportResult}
      />
    </main>
  );
}