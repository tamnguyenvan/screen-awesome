// src/pages/EditorPage.tsx
import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Preview } from '../components/editor/Preview';
import { SidePanel } from '../components/editor/SidePanel';
import { Timeline } from '../components/editor/Timeline';
import { PreviewControls } from '../components/editor/PreviewControls';

export function EditorPage() {
  const loadProject = useEditorStore((state) => state.loadProject);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const cleanup = window.electronAPI.onProjectOpen(async (payload) => {
      console.log('Received project to open:', payload);
      await loadProject(payload);
    });

    return cleanup;
  }, [loadProject]);

  return (
    <main className="h-screen w-screen bg-background flex flex-col overflow-hidden select-none">
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
    </main>
  );
}