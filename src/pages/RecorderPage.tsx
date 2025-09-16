// src/pages/RecorderPage.tsx
import { useState, useEffect } from 'react';
import { Mic, Webcam, Monitor, Crop, RectangleHorizontal, Radio, Loader2, RefreshCw, AlertTriangle, MousePointerClick } from 'lucide-react'; // Thêm RefreshCw, AlertTriangle
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import "../index.css";

const RECORDER_SIZE_DEFAULT = { width: 800, height: 80, center: true };
const RECORDER_SIZE_WINDOW_PICKER = { width: 800, height: 550, center: true };

type RecordingState = 'idle' | 'recording';
type RecordingSource = 'area' | 'fullscreen' | 'window';

// --- Cập nhật type ---
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

// --- Component mới cho cảnh báo ---
const LinuxToolsWarning = ({ missingTools }: { missingTools: string[] }) => {
  if (missingTools.length === 0) return null;

  const getInstallCommands = () => (
    <>
      <p className="font-semibold mt-3">Installation:</p>
      <p className="text-xs mt-1">
        <b>Debian/Ubuntu:</b>
        <code className="block mt-1 bg-black/30 px-2 py-1 rounded">
          sudo apt install wmctrl x11-utils imagemagick
        </code>
      </p>
      <p className="text-xs mt-2">
        <b>Fedora/CentOS/RHEL:</b>
        <code className="block mt-1 bg-black/30 px-2 py-1 rounded">
          sudo dnf install wmctrl xorg-x11-utils ImageMagick
        </code>
      </p>
      <p className="text-xs mt-2">
        <b>Arch Linux:</b>
        <code className="block mt-1 bg-black/30 px-2 py-1 rounded">
          sudo pacman -S wmctrl xorg-xwininfo imagemagick
        </code>
      </p>
    </>
  );

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-[450px] p-4 bg-yellow-500/20 border border-yellow-600/50 rounded-xl shadow-lg backdrop-blur-md text-yellow-100"
      style={{ WebkitAppRegion: 'no-drag' }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold">Missing Required Tools</h4>
          <p className="text-sm mt-1">
            Window recording on Linux requires: <b>{missingTools.join(', ')}</b>. Please install them to enable this feature.
          </p>
          {getInstallCommands()}
        </div>
      </div>
    </div>
  );
};


// --- Cập nhật WindowPicker ---
function WindowPicker({ onSelect, onRefresh, sources, isLoading }: {
  onSelect: (source: WindowSource) => void, // Thay đổi onSelect
  onRefresh: () => void,
  sources: WindowSource[],
  isLoading: boolean
}) {
  return (
    <div
      // --- START: FIX ---
      // Thay đổi w-[600px] h-[400px] thành w-[720px] h-64 (256px)
      // w-[720px] (~45rem) cho 3 cột rộng rãi hơn.
      // h-64 (256px) đủ để chứa header và khoảng 1.5 hàng thumbnail, buộc overflow-y-auto phải hoạt động.
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-[720px] h-64 p-4 bg-card/95 border border-border/60 rounded-xl shadow-2xl backdrop-blur-2xl flex flex-col"
      // --- END: FIX ---
      style={{ WebkitAppRegion: 'no-drag' }}
    >
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="font-semibold text-foreground">Select a Window to Record</h3>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-3 gap-3">
            {sources.map(source => (
              <button
                key={source.id}
                className="group relative aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none transition-all duration-200 hover:scale-105"
                onClick={() => onSelect(source)} // Truyền cả object source
              >
                <img src={source.thumbnailUrl} alt={source.name} className="w-full h-full object-cover bg-muted" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <p className="absolute bottom-1 left-2 right-2 text-xs text-white font-medium truncate text-left">
                  {source.name}
                </p>
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
    // Reset state trước khi kiểm tra
    setLinuxToolsChecked(false);
    setMissingLinuxTools([]);
    setWindowSources([]);

    if (currentPlatform === 'linux') {
      const toolStatus = await window.electronAPI.linuxCheckTools();
      const missing = Object.entries(toolStatus)
        .filter(([, installed]) => !installed)
        .map(([tool]) => tool);

      setMissingLinuxTools(missing);
      setLinuxToolsChecked(true); // Đánh dấu đã kiểm tra xong

      if (missing.length > 0) {
        console.log("Missing tools, aborting fetch.");
        return; // Không fetch nếu thiếu tool
      }
    }

    setIsLoadingWindows(true);
    try {
      const sources = await window.electronAPI.getDesktopSources();
      console.log("Window sources:", sources);
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

    // Logic thay đổi kích thước cửa sổ
    if (source === 'window') {
      // Khi chuyển sang chế độ Window, mở rộng cửa sổ
      window.electronAPI.setRecorderSize(RECORDER_SIZE_WINDOW_PICKER);
      if (platform) {
        checkAndFetchSources(platform);
      }
    } else {
      // Khi ở các chế độ khác, thu nhỏ lại
      window.electronAPI.setRecorderSize(RECORDER_SIZE_DEFAULT);
    }

    const cleanup = window.electronAPI.onRecordingFinished(() => {
      // Reset về kích thước mặc định sau khi ghi xong (nếu cần)
      window.electronAPI.setRecorderSize(RECORDER_SIZE_DEFAULT);
      setRecordingState('idle');
    });

    return () => cleanup();
  }, [source, platform]); // Phụ thuộc vào source và platform

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

  // --- START: LOGIC RENDER ĐÃ ĐƯỢC ĐƠN GIẢN HÓA ---

  const isWindowMode = source === 'window';
  const onLinux = platform === 'linux';

  // Chỉ hiển thị cảnh báo khi: ở chế độ window, trên linux, đã kiểm tra xong, và có tool bị thiếu.
  const showLinuxWarning = isWindowMode && onLinux && linuxToolsChecked && missingLinuxTools.length > 0;

  // Hiển thị WindowPicker khi: ở chế độ window VÀ không có cảnh báo nào.
  const showWindowPicker = isWindowMode && !showLinuxWarning;

  let buttonText = 'Record';
  let buttonIcon = <Radio size={20} />;
  let isButtonDisabled = false;

  if (isWindowMode) {
    isButtonDisabled = true; // Luôn vô hiệu hóa nút chính ở chế độ window
    if (showLinuxWarning) {
      buttonText = 'Tools Missing';
      buttonIcon = <AlertTriangle size={20} />;
    } else {
      buttonText = 'Select a Window';
      buttonIcon = <MousePointerClick size={20} />;
    }
  }

  // --- DEBUG LOGGING ---
  console.log({
    isWindowMode,
    onLinux,
    linuxToolsChecked,
    missingLinuxTools,
    showLinuxWarning,
    showWindowPicker,
    windowSourcesCount: windowSources.length,
    isLoadingWindows,
  });

  // --- END: LOGIC RENDER ---

  return (
    <main
      className="flex items-center justify-center h-screen bg-transparent select-none p-4"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* --- START: SỬA LỖI CSS --- */}
      {/* 
        Tạo một wrapper div với 'position: relative' để WindowPicker 
        có thể định vị 'absolute' một cách chính xác so với thanh điều khiển.
      */}
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

        {/* Thanh điều khiển chính */}
        <div
          className={cn(
            "relative flex items-center p-2 gap-4 rounded-xl border",
            "bg-card/90 border-border/60 text-card-foreground",
            "shadow-2xl backdrop-blur-2xl"
          )}
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <div className="flex items-center p-1 bg-background/50 rounded-lg border border-border/50">
            <SourceButton
              label="Area" icon={<Crop size={18} />}
              isActive={source === 'area'} onClick={() => setSource('area')}
            />
            <SourceButton
              label="Full Screen" icon={<Monitor size={18} />}
              isActive={source === 'fullscreen'} onClick={() => setSource('fullscreen')}
            />
            <SourceButton
              label="Window" icon={<RectangleHorizontal size={18} />}
              isActive={source === 'window'} onClick={() => setSource('window')}
            />
          </div>
          <div className="w-px h-8 bg-border"></div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-10 w-10" disabled><Mic size={20} /></Button>
            <Button variant="outline" size="icon" className="h-10 w-10" disabled><Webcam size={20} /></Button>
            <Button
              onClick={() => handleStart()}
              disabled={isButtonDisabled}
              className="flex items-center gap-2 px-6 h-10 text-base font-semibold min-w-[180px] justify-center"
              size="lg"
            >
              {buttonIcon}
              <span>{buttonText}</span>
            </Button>
          </div>
        </div>
      </div>
      {/* --- END: SỬA LỖI CSS --- */}
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