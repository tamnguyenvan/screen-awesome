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
    // Current implementation only supports fullscreen recording.
    // The UI reflects this by disabling other options.
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
    <main
      className="flex items-center justify-center h-screen bg-transparent select-none p-4"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div
        className="flex items-center p-3 gap-5 bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {/* Group 1: Recording Source */}
        <div className="flex items-center p-2 bg-black/25 rounded-full">
          <SourceButton
            label="Select Area"
            icon={<Crop className="w-5 h-5" />}
            isActive={source === 'area'}
            onClick={() => setSource('area')}
            disabled={true}
          />
          <SourceButton
            label="Full Screen"
            icon={<Monitor className="w-5 h-5" />}
            isActive={source === 'fullscreen'}
            onClick={() => setSource('fullscreen')}
          />
          <SourceButton
            label="Window"
            icon={<RectangleHorizontal className="w-5 h-5" />}
            isActive={source === 'window'}
            onClick={() => setSource('window')}
            disabled={true}
          />
        </div>

        <div className="w-px h-10 bg-white/20"></div>

        {/* Group 2: Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleStart}
            className="flex items-center gap-3 px-8 h-12 text-base font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Radio className="w-6 h-6" />
            <span>Record</span>
          </Button>

          <DeviceButton
            label="Microphone"
            icon={<Mic className="w-6 h-6" />}
            isActive={mic === 'on'}
            onClick={() => setMic(mic === 'on' ? 'off' : 'on')}
            disabled={true} // Functionality not implemented
          />
          <DeviceButton
            label="Webcam"
            icon={<Webcam className="w-6 h-6" />}
            isActive={webcam === 'on'}
            onClick={() => setWebcam(webcam === 'on' ? 'off' : 'on')}
            disabled={true} // Functionality not implemented
          />
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
  <button
    {...props}
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed",
      isActive ? "bg-blue-600 text-white shadow-md" : "text-gray-300 hover:bg-white/10",
    )}
  >
    {icon}
    <span>{label}</span>
  </button>
);

// Helper component for device buttons (Mic, Webcam)
const DeviceButton = ({ label, icon, isActive, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string,
  icon: React.ReactNode,
  isActive: boolean,
}) => (
  <button
    {...props}
    aria-label={label}
    className={cn(
      "p-3 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed",
      isActive ? "bg-blue-600/90 text-white" : "bg-black/25 text-gray-300 hover:bg-white/10",
    )}
  >
    {icon}
  </button>
);