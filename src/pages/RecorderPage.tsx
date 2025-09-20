// src/pages/RecorderPage.tsx
import { useState, useEffect } from 'react';
import {
  Mic, Webcam, Monitor, SquareDashed, Loader2,
  RefreshCw, AlertTriangle, MousePointerClick, Video, AppWindowMac, X, GripVertical
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import "../index.css";

// MODIFIED: Increased default height for a more spacious feel.
const RECORDER_SIZE_DEFAULT = { width: 800, height: 90 };
const RECORDER_SIZE_WINDOW_PICKER = { width: 800, height: 800 };

type RecordingState = 'idle' | 'recording';
type RecordingSource = 'area' | 'fullscreen' | 'window';

type WindowSource = {
  id: string;
  name: string;
  thumbnailUrl: string;
  geometry?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const LinuxToolsWarning = ({ missingTools }: { missingTools: string[] }) => {
  if (missingTools.length === 0) return null;

  const getInstallCommands = () => (
    <>
      <p className="font-medium mt-3 text-amber-200">Installation:</p>
      <div className="space-y-2 mt-2">
        <div>
          <p className="text-xs font-medium text-amber-300">Debian/Ubuntu:</p>
          <code className="block mt-1 bg-black/40 px-3 py-2 rounded-md text-xs font-mono text-amber-100 border border-amber-500/20">
            sudo apt install wmctrl x11-utils imagemagick
          </code>
        </div>
        <div>
          <p className="text-xs font-medium text-amber-300">Fedora/CentOS/RHEL:</p>
          <code className="block mt-1 bg-black/40 px-3 py-2 rounded-md text-xs font-mono text-amber-100 border border-amber-500/20">
            sudo dnf install wmctrl xorg-x11-utils ImageMagick
          </code>
        </div>
        <div>
          <p className="text-xs font-medium text-amber-300">Arch Linux:</p>
          <code className="block mt-1 bg-black/40 px-3 py-2 rounded-md text-xs font-mono text-amber-100 border border-amber-500/20">
            sudo pacman -S wmctrl xorg-xwininfo imagemagick
          </code>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-[480px] p-6 bg-card/90 border border-amber-500/30 rounded-lg shadow-2xl backdrop-blur-xl"
      style={{ WebkitAppRegion: 'no-drag' }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground mb-2">Missing Required Tools</h4>
          <p className="text-sm text-muted-foreground leading-relaxed mb-1">
            Window recording on Linux requires: <span className="font-medium text-amber-400">{missingTools.join(', ')}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Please install them to enable this feature.
          </p>
          {getInstallCommands()}
        </div>
      </div>
    </div>
  );
};

function WindowPicker({ onSelect, onRefresh, sources, isLoading }: {
  onSelect: (source: WindowSource) => void,
  onRefresh: () => void,
  sources: WindowSource[],
  isLoading: boolean
}) {
  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-[720px] h-72 p-4 bg-card border border-border/50 rounded-lg shadow-2xl backdrop-blur-xl flex flex-col"
      style={{ WebkitAppRegion: 'no-drag' }}
    >
      <div className="flex items-center justify-between mb-3 flex-shrink-0 px-2">
        <h3 className="font-semibold text-foreground">Select a Window to Record</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading windows...</p>
        </div>
      ) : sources.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <AppWindowMac className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No windows found</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3 pr-2">
            {sources.map(source => (
              <button
                key={source.id}
                className="group relative aspect-video rounded-md overflow-hidden border-2 border-border/30 hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 bg-muted/50"
                onClick={() => onSelect(source)}
              >
                <img
                  src={source.thumbnailUrl}
                  alt={source.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <div className="absolute inset-x-0 bottom-0 p-2">
                  <p className="text-xs text-white font-medium truncate group-hover:text-white/90 transition-colors">
                    {source.name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RecorderPage() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [source, setSource] = useState<RecordingSource>('fullscreen');
  const [windowSources, setWindowSources] = useState<WindowSource[]>([]);
  const [isLoadingWindows, setIsLoadingWindows] = useState(false);
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null);
  const [missingLinuxTools, setMissingLinuxTools] = useState<string[]>([]);
  const [linuxToolsChecked, setLinuxToolsChecked] = useState(false);

  const checkAndFetchSources = async (currentPlatform: NodeJS.Platform) => {
    setLinuxToolsChecked(false);
    setMissingLinuxTools([]);
    setWindowSources([]);

    if (currentPlatform === 'linux') {
      const toolStatus = await window.electronAPI.linuxCheckTools();
      const missing = Object.entries(toolStatus)
        .filter(([, installed]) => !installed)
        .map(([tool]) => tool);

      setMissingLinuxTools(missing);
      setLinuxToolsChecked(true);

      if (missing.length > 0) {
        return;
      }
    }

    setIsLoadingWindows(true);
    try {
      const sources = await window.electronAPI.getDesktopSources();
      setWindowSources(sources);
    } catch (error) {
      console.error("Failed to get window sources:", error);
    } finally {
      setIsLoadingWindows(false);
    }
  };

  useEffect(() => {
    if (!platform) {
      window.electronAPI.getPlatform().then(setPlatform);
    }

    if (source === 'window') {
      window.electronAPI.setRecorderSize(RECORDER_SIZE_WINDOW_PICKER);
      if (platform) {
        checkAndFetchSources(platform);
      }
    } else {
      window.electronAPI.setRecorderSize(RECORDER_SIZE_DEFAULT);
    }

    const cleanup = window.electronAPI.onRecordingFinished(() => {
      window.electronAPI.setRecorderSize(RECORDER_SIZE_DEFAULT);
      setRecordingState('idle');
    });

    return () => cleanup();
  }, [source, platform]);

  const handleStart = async (options: { geometry?: WindowSource['geometry'], windowTitle?: string } = {}) => {
    try {
      setRecordingState('recording');
      const result = await window.electronAPI.startRecording({ source, ...options });
      if (result.canceled) {
        setRecordingState('idle');
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingState('idle');
    }
  };

  if (recordingState === 'recording') {
    return null;
  }

  const isWindowMode = source === 'window';
  const onLinux = platform === 'linux';
  const showLinuxWarning = isWindowMode && onLinux && linuxToolsChecked && missingLinuxTools.length > 0;
  const showWindowPicker = isWindowMode && !showLinuxWarning;

  let buttonIcon = <Video size={20} />;
  let isButtonDisabled = false;

  if (isWindowMode) {
    isButtonDisabled = true;
    if (showLinuxWarning) {
      buttonIcon = <AlertTriangle size={20} />;
    } else {
      buttonIcon = <MousePointerClick size={20} />;
    }
  }

  return (
    <main className="flex items-center justify-center h-screen bg-transparent select-none p-4">
      <div className="relative">
        {showLinuxWarning && <LinuxToolsWarning missingTools={missingLinuxTools} />}

        {showWindowPicker && (
          <WindowPicker
            sources={windowSources}
            isLoading={isLoadingWindows}
            onRefresh={() => platform && checkAndFetchSources(platform)}
            onSelect={(selectedSource) => handleStart({ geometry: selectedSource.geometry, windowTitle: selectedSource.name })}
          />
        )}

        <button
          onClick={() => window.electronAPI.closeWindow()}
          style={{ WebkitAppRegion: 'no-drag' }}
          className={cn(
            "absolute top-0 right-0 z-20 flex items-center justify-center w-6 h-6 rounded-full transition-colors duration-200",
            "translate-x-1/2 -translate-y-1/2",
            "bg-card/80 border border-border hover:bg-destructive/20 text-muted-foreground hover:text-destructive",
            "backdrop-blur-sm shadow-lg"
          )}
          aria-label="Close Recorder"
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className={cn(
            "relative flex items-stretch gap-4 p-2 rounded-xl",
            "bg-card/80 border border-border text-card-foreground",
            "shadow-lg backdrop-blur-xl"
          )}
          style={{ WebkitAppRegion: 'drag' }}
        >
          {/* NEW: Dedicated Drag Handle */}
          <div className="flex items-center justify-center pl-2 pr-1 cursor-grab" style={{ WebkitAppRegion: 'drag' }}>
            <GripVertical className="w-5 h-5 text-muted-foreground/50" />
          </div>

          {/* Source Selection */}
          <div className="flex items-center p-1 bg-muted rounded-lg border border-border" style={{ WebkitAppRegion: 'no-drag' }}>
            <SourceButton
              label="Full Screen"
              icon={<Monitor size={16} />}
              isActive={source === 'fullscreen'}
              onClick={() => setSource('fullscreen')}
            />
            <SourceButton
              label="Area"
              icon={<SquareDashed size={16} />}
              isActive={source === 'area'}
              onClick={() => setSource('area')}
            />
            <SourceButton
              label="Window"
              icon={<AppWindowMac size={16} />}
              isActive={source === 'window'}
              onClick={() => setSource('window')}
            />
          </div>

          {/* Divider */}
          <div className="w-px bg-border/50"></div>

          {/* Controls */}
          <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
            <Button
              onClick={() => handleStart()}
              disabled={isButtonDisabled}
              variant="default"
              size="icon"
              className={cn(
                "h-12 w-12", // Larger record button
                isButtonDisabled && showLinuxWarning && "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30",
                isButtonDisabled && !showLinuxWarning && "opacity-50"
              )}
            >
              {buttonIcon}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              disabled
              className="h-10 w-10 opacity-50" // Larger secondary buttons
            >
              <Mic size={18} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              disabled
              className="h-10 w-10 opacity-50" // Larger secondary buttons
            >
              <Webcam size={18} />
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

const SourceButton = ({ label, icon, isActive, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string,
  icon: React.ReactNode,
  isActive: boolean,
}) => (
  <button
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring",
      isActive
        ? "bg-card shadow-sm text-foreground"
        : "text-muted-foreground hover:text-foreground"
    )}
    {...props}
  >
    {icon}
    <span>{label}</span>
  </button>
);