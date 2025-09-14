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


export function EditorPage() {
  const loadProject = useEditorStore((state) => state.loadProject);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExportModalOpen, setExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  useEffect(() => {
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
      setExportProgress(100); // Hoặc 0
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

  const handleStartExport = async (settings: ExportSettings) => { // Sửa type
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
    
    // --- SỬA LỖI CLONE Ở ĐÂY ---
    // Lấy toàn bộ state từ store
    const fullState = useEditorStore.getState();

    // Tạo một đối tượng mới chỉ chứa dữ liệu, không chứa hàm (actions)
    const plainState = {
      videoPath: fullState.videoPath,
      videoDimensions: fullState.videoDimensions,
      duration: fullState.duration,
      frameStyles: fullState.frameStyles,
      aspectRatio: fullState.aspectRatio, // Tỷ lệ khung hình của preview canvas
      zoomRegions: fullState.zoomRegions,
      cutRegions: fullState.cutRegions,
    };

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Gửi đi cả state "sạch" và các cài đặt export
      await window.electronAPI.startExport({
        projectState: plainState,
        exportSettings: settings, // THÊM MỚI
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
      <header className="h-14 flex-shrink-0 border-b bg-card flex items-center justify-between px-4">
        <h1 className="text-lg font-bold">ScreenAwesome Editor</h1>
        <ExportButton
          isExporting={isExporting}
          onClick={() => setExportModalOpen(true)}
        />
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Side Panel */}
        <div className="w-80 flex-shrink-0 bg-card border-r overflow-y-auto">
          <SidePanel />
        </div>

        {/* Center Area (Preview + Timeline) */}
        <div className="flex-1 flex flex-col overflow-hidden">

          <div className="flex-1 flex flex-col p-4 bg-muted/50 overflow-hidden">
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <Preview videoRef={videoRef} />
            </div>
            <div className="flex-shrink-0 pt-4">
              <PreviewControls videoRef={videoRef} />
            </div>
          </div>

          {/* Timeline Area (không đổi) */}
          <div className="h-48 flex-shrink-0 bg-card border-t overflow-x-auto">
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