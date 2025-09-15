// src/pages/RecorderPage.tsx
import { useState, useEffect } from 'react';
import { Mic, Webcam, Monitor, Crop, RectangleHorizontal, Radio } from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import "../index.css";

type RecordingState = 'idle' | 'recording';
type RecordingSource = 'area' | 'fullscreen' | 'window';
type MicState = 'on' | 'off';
type WebcamState = 'on' | 'off';

export function RecorderPage() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [source, setSource] = useState<RecordingSource>('fullscreen');
  const [mic, setMic] = useState<MicState>('on');
  const [webcam, setWebcam] = useState<WebcamState>('off');

  useEffect(() => {
    const cleanup = window.electronAPI.onRecordingFinished((result) => {
      console.log('Recording finished event received in renderer:', result);
      setRecordingState('idle');
      if (result.canceled) {
        console.log('Recording was canceled from the tray menu.');
      }
    });
    return () => cleanup();
  }, []);

  const handleStart = async () => {
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
    return null; // The window is hidden by the main process during recording
  }

  return (
    // Set the main container to be transparent to allow the window's vibrancy/blur effect to show through.
    <main
      className="flex items-center justify-center h-screen bg-transparent select-none p-4"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div
        className={cn(
          "flex items-center p-2 gap-4 rounded-xl border",
          "bg-card/90 border-border/60 text-card-foreground",
          "shadow-2xl backdrop-blur-2xl"
        )}
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {/* Group 1: Recording Source */}
        <div className="flex items-center p-1 bg-background/50 rounded-lg border border-border/50">
          <SourceButton
            label="Area"
            icon={<Crop size={18} />}
            isActive={source === 'area'}
            onClick={() => setSource('area')}
            disabled={true}
          />
          <SourceButton
            label="Full Screen"
            icon={<Monitor size={18} />}
            isActive={source === 'fullscreen'}
            onClick={() => setSource('fullscreen')}
          />
          <SourceButton
            label="Window"
            icon={<RectangleHorizontal size={18} />}
            isActive={source === 'window'}
            onClick={() => setSource('window')}
            disabled={true}
          />
        </div>

        <div className="w-px h-8 bg-border"></div>

        {/* Group 2: Actions */}
        <div className="flex items-center gap-2">
          <DeviceButton
            label="Microphone"
            icon={<Mic size={20} />}
            isActive={mic === 'on'}
            onClick={() => setMic(mic === 'on' ? 'off' : 'on')}
            disabled={true} // Functionality not implemented
          />
          <DeviceButton
            label="Webcam"
            icon={<Webcam size={20} />}
            isActive={webcam === 'on'}
            onClick={() => setWebcam(webcam === 'on' ? 'off' : 'on')}
            disabled={true} // Functionality not implemented
          />
          <Button
            onClick={handleStart}
            className="flex items-center gap-2 px-6 h-10 text-base font-semibold"
            size="lg"
          >
            <Radio size={20} />
            <span>Record</span>
          </Button>
        </div>
      </div>
    </main>
  );
}

// Helper component for source selection buttons (Area, Full Screen, Window)
const SourceButton = ({ label, icon, isActive, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string,
  icon: React.ReactNode,
  isActive: boolean,
}) => (
  <Button
    variant={isActive ? 'default' : 'ghost'}
    size="sm"
    className={cn(
      "flex items-center gap-2 px-4 py-2 font-semibold transition-all duration-200",
      !isActive && "text-muted-foreground"
    )}
    {...props}
  >
    {icon}
    <span>{label}</span>
  </Button>
);

// Helper component for device buttons (Mic, Webcam)
const DeviceButton = ({ label, icon, isActive, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string,
  icon: React.ReactNode,
  isActive: boolean,
}) => (
  <Button
    variant="outline"
    size="icon"
    aria-label={label}
    className={cn(
      "h-10 w-10 bg-background/50 border-border/50",
      isActive && "bg-primary/20 text-primary border-primary/30 ring-2 ring-primary/20"
    )}
    {...props}
  >
    {icon}
  </Button>
);