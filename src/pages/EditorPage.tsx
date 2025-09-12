// src/pages/EditorPage.tsx
import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Preview } from '../components/editor/Preview';
import { SidePanel } from '../components/editor/SidePanel';
import { Timeline } from '../components/editor/Timeline';
import { Toolbar } from '../components/editor/Toolbar';
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
    <main className="h-screen w-screen bg-gray-100 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <Toolbar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Side Panel */}
        <div className="w-80 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <SidePanel />
        </div>

        {/* Center Area (Preview + Timeline) */}
        <div className="flex-1 flex flex-col">
          {/* Preview Area */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-200/50 dark:bg-gray-950/50 overflow-hidden relative">
             <Preview videoRef={videoRef} />
             <div className="absolute bottom-4 left-4 right-4 z-10">
                <PreviewControls videoRef={videoRef} />
             </div>
          </div>
          
          {/* Timeline Area */}
          <div className="h-48 flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <Timeline videoRef={videoRef} />
          </div>
        </div>
      </div>
    </main>
  );
}