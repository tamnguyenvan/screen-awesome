// src/pages/EditorPage.tsx
import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Preview } from '../components/editor/Preview';
import { SidePanel } from '../components/editor/SidePanel';
import { Timeline } from '../components/editor/Timeline';

export function EditorPage() {
  const loadProject = useEditorStore((state) => state.loadProject);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const cleanup = window.electronAPI.onProjectOpen((payload) => {
      console.log('Received project to open:', payload);
      loadProject(payload);
    });

    return cleanup;
  }, [loadProject]);

  return (
    <main className="h-screen w-screen bg-gray-100 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Top Bar - Placeholder */}
      <div className="flex-shrink-0 h-12 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200">ScreenAwesome Editor</h1>
        {/* Export Button will go here */}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Side Panel */}
        <div className="w-80 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <SidePanel />
        </div>

        {/* Center Area (Preview + Timeline) */}
        <div className="flex-1 flex flex-col">
          {/* Preview Area */}
          <div className="flex-1 flex items-center justify-center p-8 bg-gray-200/50 dark:bg-gray-950/50 overflow-hidden">
             <Preview videoRef={videoRef} />
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