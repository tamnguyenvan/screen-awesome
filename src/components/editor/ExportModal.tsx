// src/components/editor/ExportModal.tsx
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ExportSettings = {
  format: 'mp4' | 'gif';
  resolution: '720p' | '1080p' | '2k';
  fps: 30; // Only 30 FPS is supported
  quality: 'low' | 'medium' | 'high';
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartExport: (settings: ExportSettings) => void;
  // New props to manage state
  isExporting: boolean;
  progress: number;
  result: { success: boolean; outputPath?: string; error?: string } | null;
}

// --- Sub-components for different views ---

const SettingsView = ({ onStartExport, onClose }: { onStartExport: (settings: ExportSettings) => void, onClose: () => void }) => {
  const [settings, setSettings] = useState<ExportSettings>({
    format: 'mp4',
    resolution: '1080p',
    fps: 30,
    quality: 'medium',
  });

  const handleValueChange = (key: keyof ExportSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Upload className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Export Settings</h2>
          <p className="text-sm text-muted-foreground">Configure your export options</p>
        </div>
      </div>
      <div className="space-y-4">
        {/* Setting Rows (unchanged) */}
        <SettingRow label="Format">
          <Select value={settings.format} onValueChange={(value) => handleValueChange('format', value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mp4">MP4 (Video)</SelectItem>
              <SelectItem value="gif">GIF (Animation)</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Resolution">
          <Select value={settings.resolution} onValueChange={(value) => handleValueChange('resolution', value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="720p">HD (720p)</SelectItem>
              <SelectItem value="1080p">Full HD (1080p)</SelectItem>
              <SelectItem value="2k">2K (1440p)</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Quality">
          <Select value={settings.quality} onValueChange={(value) => handleValueChange('quality', value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="FPS">
          <Select value={String(settings.fps)} disabled>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="30">30 FPS</SelectItem></SelectContent>
          </Select>
        </SettingRow>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} className="btn-clean">Cancel</Button>
        <Button onClick={() => onStartExport(settings)} className="btn-clean">Start Export</Button>
      </div>
    </>
  );
};

const ProgressView = ({ progress }: { progress: number }) => (
  <div className="flex flex-col items-center text-center">
    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
    <h2 className="text-lg font-semibold text-foreground mb-1">Exporting...</h2>
    <p className="text-sm text-muted-foreground mb-6">Please wait while we process your video.</p>
    <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
    <p className="text-sm font-medium text-primary mt-3">{Math.round(progress)}%</p>
  </div>
);

const ResultView = ({ result, onClose }: { result: NonNullable<ExportModalProps['result']>, onClose: () => void }) => (
  <div className="flex flex-col items-center text-center">
    <div className={cn(
      "w-12 h-12 rounded-full flex items-center justify-center mb-4",
      result.success ? 'bg-green-500/10' : 'bg-red-500/10'
    )}>
      {result.success ? (
        <CheckCircle2 className="w-6 h-6 text-green-500" />
      ) : (
        <XCircle className="w-6 h-6 text-red-500" />
      )}
    </div>
    <h2 className="text-lg font-semibold text-foreground mb-1">
      {result.success ? 'Export Successful' : 'Export Failed'}
    </h2>
    <p className="text-sm text-muted-foreground mb-6 max-w-xs break-words">
      {result.success
        ? `Your video has been saved to the selected location.`
        : `An error occurred: ${result.error || 'Unknown error'}`
      }
    </p>
    <Button onClick={onClose} className="btn-clean w-full">Close</Button>
  </div>
);

// --- Main Modal Component ---

export function ExportModal({ isOpen, onClose, onStartExport, isExporting, progress, result }: ExportModalProps) {
  if (!isOpen) return null;

  const renderContent = () => {
    if (result) {
      return <ResultView result={result} onClose={onClose} />;
    }
    if (isExporting) {
      return <ProgressView progress={progress} />;
    }
    return <SettingsView onStartExport={onStartExport} onClose={onClose} />;
  };

  return (
    <div
      className="modal-backdrop z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="card-clean p-6 w-full max-w-md m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {renderContent()}
      </div>
    </div>
  );
}

// Helper component
const SettingRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="flex items-center justify-between">
    <label className="text-sm font-medium text-foreground">{label}</label>
    <div className="w-1/2">{children}</div>
  </div>
);