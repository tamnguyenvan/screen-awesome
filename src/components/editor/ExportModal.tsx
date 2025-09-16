// src/components/editor/ExportModal.tsx
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Upload } from 'lucide-react';

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
    <div className="modal-backdrop z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="card-clean p-6 w-full max-w-md m-4"
        onClick={(e) => e.stopPropagation()}
      >
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
          <SettingRow label="Format">
            <Select value={settings.format} onValueChange={(value) => handleValueChange('format', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select format..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp4">MP4 (Video)</SelectItem>
                <SelectItem value="gif">GIF (Animation)</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="Resolution">
            <Select value={settings.resolution} onValueChange={(value) => handleValueChange('resolution', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select resolution..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720p">HD (1280x720)</SelectItem>
                <SelectItem value="1080p">Full HD (1920x1080)</SelectItem>
                <SelectItem value="2k">2K (2560x1440)</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="Quality">
            <Select value={settings.quality} onValueChange={(value) => handleValueChange('quality', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select quality..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="FPS">
            <Select value={String(settings.fps)} disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select FPS..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 FPS</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="btn-clean">
            Cancel
          </Button>
          <Button onClick={handleStart} className="btn-clean">
            Start Export
          </Button>
        </div>
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