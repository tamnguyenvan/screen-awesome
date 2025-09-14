// src/components/editor/ExportModal.tsx
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export type ExportSettings = {
  format: 'mp4' | 'gif';
  resolution: '720p' | '1080p' | '2k';
  fps: 30; // Hiện tại chỉ có 30
  quality: 'low' | 'medium' | 'high';
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartExport: (settings: ExportSettings) => void;
}

export function ExportModal({ isOpen, onClose, onStartExport }: ExportModalProps) {
  const [settings, setSettings] = useState<ExportSettings>({
    format: 'mp4',
    resolution: '1080p',
    fps: 30,
    quality: 'medium',
  });

  if (!isOpen) return null;

  const handleValueChange = (key: keyof ExportSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  
  const handleStart = () => {
    onStartExport(settings);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-card text-card-foreground rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-6">Export Settings</h2>
        
        <div className="space-y-4">
          <SettingRow label="Format">
            <Select value={settings.format} onChange={e => handleValueChange('format', e.target.value)}>
              <option value="mp4">MP4 (Video)</option>
              <option value="gif">GIF (Animation)</option>
            </Select>
          </SettingRow>

          <SettingRow label="Resolution">
            <Select value={settings.resolution} onChange={e => handleValueChange('resolution', e.target.value)}>
              <option value="720p">HD (1280x720)</option>
              <option value="1080p">Full HD (1920x1080)</option>
              <option value="2k">2K (2560x1440)</option>
            </Select>
          </SettingRow>
          
          <SettingRow label="Quality">
            <Select value={settings.quality} onChange={e => handleValueChange('quality', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </SettingRow>
          
          <SettingRow label="FPS">
            <Select value={settings.fps} disabled>
              <option value={30}>30 FPS</option>
            </Select>
          </SettingRow>
        </div>

        <div className="mt-8 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleStart}>Start Export</Button>
        </div>
      </div>
    </div>
  );
}

// Helper components cho gọn
const SettingRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="flex items-center justify-between">
    <label className="text-sm font-medium">{label}</label>
    <div className="w-1/2">{children}</div>
  </div>
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={cn(
      "w-full p-2 bg-input border rounded-md focus:outline-none focus:ring-2 focus:ring-ring",
      "disabled:opacity-50 disabled:cursor-not-allowed"
    )}
  />
);