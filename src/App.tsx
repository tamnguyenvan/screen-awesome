// src/App.tsx
import { useState, useEffect } from 'react';
import { Mic, Webcam, Monitor, Crop, SquareMousePointer, Radio } from 'lucide-react';
import { Button } from './components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip';
import { cn } from './lib/utils';
import "./index.css";

type RecordingState = 'idle' | 'recording';

function App() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [lastFilePath, setLastFilePath] = useState<string | null>(null);

  useEffect(() => {
    const cleanup = window.electronAPI.onRecordingFinished((result) => {
      console.log('Recording finished event received in renderer:', result);
      setRecordingState('idle');
      if (!result.canceled && result.filePath) {
        setLastFilePath(result.filePath);
      } else {
        setLastFilePath(null);
        console.log('Recording was canceled from the tray menu.');
      }
    });
    return () => cleanup();
  }, []);

  const handleStart = async () => {
    setLastFilePath(null);
    try {
      const result = await window.electronAPI.startRecording();
      if (!result.canceled && result.filePath) {
        setRecordingState('recording');
        console.log('Recording started, saving to:', result.filePath);
      } else {
        console.log('Recording start was canceled by user.');
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  if (recordingState === 'recording') {
      // Khi đang ghi hình, component không cần render gì cả vì cửa sổ chính đã bị ẩn
      return null;
  }

  return (
    <TooltipProvider delayDuration={100}>
      {/* Vùng div này cho phép kéo thả cửa sổ */}
      <main 
        className="flex flex-col items-center justify-center h-screen bg-transparent" 
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex items-center gap-2 p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-lg shadow-xl border border-white/20"
             style={{ WebkitAppRegion: 'no-drag' }} // Ngăn các control bên trong kích hoạt kéo thả
        >
          {/* Group 1: Recording Source */}
          <div className="flex p-1 bg-gray-200/50 dark:bg-gray-800/50 rounded-md">
            <IconButton tooltip="Select Area" disabled>
              <Crop className="w-5 h-5" />
            </IconButton>
            <IconButton tooltip="Select Window" disabled>
              <Monitor className="w-5 h-5" />
            </IconButton>
            <IconButton tooltip="Full Screen" active>
              <SquareMousePointer className="w-5 h-5" />
            </IconButton>
          </div>
          
          <div className="w-px h-8 bg-gray-300 dark:bg-gray-700 mx-2"></div> {/* Separator */}
          
          {/* Group 2: Recording Controls */}
          <div className="flex items-center gap-2">
             <Button 
                onClick={handleStart} 
                className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
             >
               <Radio className="w-5 h-5 animate-pulse" />
               <span className="font-bold">Record</span>
             </Button>
            <IconButton tooltip="Microphone On" disabled>
              <Mic className="w-5 h-5" />
            </IconButton>
            <IconButton tooltip="Webcam Off" disabled>
              <Webcam className="w-5 h-5" />
            </IconButton>
          </div>
        </div>
        
        {lastFilePath && (
          <div className="mt-4 p-2 text-xs text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md"
               style={{ WebkitAppRegion: 'no-drag' }}
          >
            <p className="text-gray-600 dark:text-gray-400">Last recording:</p>
            <code className="block mt-1 px-2 py-1 text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-gray-700 rounded-md">
              {lastFilePath}
            </code>
          </div>
        )}
      </main>
    </TooltipProvider>
  );
}

// Helper component for Icon Buttons
const IconButton = ({ children, tooltip, active = false, ...props }: { children: React.ReactNode, tooltip: string, active?: boolean, disabled?: boolean }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "text-gray-600 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-700/50",
              active && "bg-blue-500/20 text-blue-600 dark:text-blue-400"
            )}
            {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default App;