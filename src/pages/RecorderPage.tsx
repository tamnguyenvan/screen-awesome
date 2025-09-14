// src/pages/RecorderPage.tsx
import { useState, useEffect } from 'react';
import { Mic, Webcam, Monitor, Crop, SquareMousePointer, Radio } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../lib/utils';
import "../index.css";

type RecordingState = 'idle' | 'recording';

export function RecorderPage() {
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
      return null;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <main 
        className="flex flex-col items-center justify-center h-screen bg-transparent" 
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex items-center gap-2 p-2 bg-card/80 backdrop-blur-md rounded-lg shadow-xl border border-border/20"
             style={{ WebkitAppRegion: 'no-drag' }}
        >
          <div className="flex p-1 bg-muted/50 rounded-md">
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
          
          <div className="w-px h-8 bg-border mx-2"></div>
          
          <div className="flex items-center gap-2">
             <Button 
                variant="destructive"
                onClick={handleStart} 
                className="flex items-center gap-2 px-4 py-2"
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
          <div className="mt-4 p-2 text-xs text-center bg-card border rounded-lg shadow-md"
               style={{ WebkitAppRegion: 'no-drag' }}
          >
            <p className="text-muted-foreground">Last recording:</p>
            <code className="block mt-1 px-2 py-1 text-primary-foreground bg-primary/20 rounded-md">
              {lastFilePath}
            </code>
          </div>
        )}
      </main>
    </TooltipProvider>
  );
}

const IconButton = ({ children, tooltip, active = false, ...props }: { children: React.ReactNode, tooltip: string, active?: boolean, disabled?: boolean }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "text-muted-foreground",
              active && "bg-primary/20 text-primary"
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