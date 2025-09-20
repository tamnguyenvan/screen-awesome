// src/pages/EditorPage.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Preview } from '../components/editor/Preview';
import { SidePanel } from '../components/editor/SidePanel';
import { Timeline } from '../components/editor/Timeline';
import { PreviewControls } from '../components/editor/PreviewControls';
import { ExportButton } from '../components/editor/ExportButton';
import { ExportModal, ExportSettings } from '../components/editor/ExportModal';
import { WindowControls } from '../components/editor/WindowControls';
import { PresetModal } from '../components/editor/PresetModal';
import { Layers3, Moon, Sun, Loader2, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { Button } from '../components/ui/button';

export function EditorPage() {
  const { loadProject, toggleTheme, deleteRegion, initializePresets, initializeSettings } = useEditorStore.getState();
  const presetSaveStatus = useEditorStore(state => state.presetSaveStatus);
  const duration = useEditorStore(state => state.duration);
  const { undo, redo } = useEditorStore.temporal.getState();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExportModalOpen, setExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportResult, setExportResult] = useState<{ success: boolean; outputPath?: string; error?: string } | null>(null);
  const [isPresetModalOpen, setPresetModalOpen] = useState(false);
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

    initializeSettings();

    const cleanup = window.electronAPI.onProjectOpen(async (payload) => {
      console.log('Received project to open:', payload);
      await initializePresets();
      await loadProject(payload);
    });

    const cleanProgressListener = window.electronAPI.onExportProgress(({ progress }) => {
      setExportProgress(progress);
    });

    const cleanCompleteListener = window.electronAPI.onExportComplete(({ success, outputPath, error }) => {
      setIsExporting(false);
      setExportProgress(100);
      setExportResult({ success, outputPath, error });
    });

    return () => {
      cleanup();
      cleanProgressListener();
      cleanCompleteListener();
    };
    // MODIFIED: Thêm initializeSettings vào dependency array
  }, [loadProject, initializePresets, initializeSettings]);

  const handleStartExport = useCallback(async (settings: ExportSettings) => {
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
      webcamVideoPath: fullState.webcamVideoPath,
      webcamPosition: fullState.webcamPosition,
      webcamStyles: fullState.webcamStyles,
      isWebcamVisible: fullState.isWebcamVisible,
    };

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
      setExportResult({ success: false, error: `An error occurred while starting the export: ${e}` });
      setIsExporting(false);
    }
  }, []);

  const handleCancelExport = () => {
    window.electronAPI.cancelExport();
  };

  const currentTheme = useEditorStore(state => state.theme);

  const handleCloseExportModal = () => {
    setExportModalOpen(false);
  };

  const getPresetButtonContent = () => {
    switch (presetSaveStatus) {
      case 'saving':
        return <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>;
      case 'saved':
        return <><Check className="w-4 h-4 mr-2" /> Saved!</>;
      default:
        return <><Layers3 className="w-4 h-4 mr-2" /> Presets</>;
    }
  };

  return (
    <main className="h-screen w-screen bg-background flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header
        className="relative h-12 flex-shrink-0 border-b border-border bg-card/60 backdrop-blur-xl flex items-center justify-center"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          {platform !== 'darwin' && <WindowControls />}
        </div>

        <h1 className="text-sm font-semibold text-foreground pointer-events-none">ScreenAwesome</h1>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={cn('h-8 w-8 text-muted-foreground hover:text-foreground')}
          >
            {currentTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPresetModalOpen(true)}
            disabled={presetSaveStatus === 'saving'}
            className={cn(
              "transition-all duration-300 w-[110px]",
              presetSaveStatus === 'saved' && "bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400"
            )}
          >
            {getPresetButtonContent()}
          </Button>
          <ExportButton
            isExporting={isExporting}
            onClick={() => setExportModalOpen(true)}
            disabled={duration <= 0}
          />
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[28rem] flex-shrink-0 bg-sidebar border-r border-sidebar-border overflow-hidden">
          <SidePanel />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
              <Preview videoRef={videoRef} />
            </div>
            <div className="flex-shrink-0">
              <PreviewControls videoRef={videoRef} />
            </div>
          </div>
          <div className="h-48 flex-shrink-0 bg-card/50 border-t border-border backdrop-blur-sm overflow-hidden">
            <Timeline videoRef={videoRef} />
          </div>
        </div>
      </div>

      {/* Modals */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={handleCloseExportModal}
        onStartExport={handleStartExport}
        onCancelExport={handleCancelExport}
        isExporting={isExporting}
        progress={exportProgress}
        result={exportResult}
      />
      <PresetModal
        isOpen={isPresetModalOpen}
        onClose={() => setPresetModalOpen(false)}
      />
    </main>
  );
}