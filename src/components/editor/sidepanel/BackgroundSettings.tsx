// src/components/editor/sidepanel/BackgroundSettings.tsx
import React, { useState } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { cn } from '../../../lib/utils';
import { WALLPAPERS } from '../../../lib/constants';
import {
  Palette, Image, Sparkles, ImageIcon, Check, UploadCloud, X, Zap,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowDownRight, ArrowUpLeft, ArrowDownLeft
} from 'lucide-react';
import { Input } from '../../ui/input';
import { ControlGroup } from './ControlGroup';

type BackgroundTab = 'color' | 'gradient' | 'image' | 'wallpaper';

// Helper component for circular color picker
const ColorPickerCircle = ({
  label,
  color,
  name,
  onChange,
  size = 'sm'
}: {
  label: string;
  color: string;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <label className={cn("relative cursor-pointer group", sizeClasses[size])}>
        <input
          type="color"
          name={name}
          value={color}
          onChange={onChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className={cn(
            "w-full h-full rounded-full border-2 border-sidebar-border/30 group-hover:border-primary/60 transition-all duration-300 shadow-sm"
          )}
          style={{ backgroundColor: color }}
        />
      </label>
      <span className="text-xs text-muted-foreground text-center leading-none">{label}</span>
    </div>
  );
};

const GRADIENT_PRESETS = [
  { name: 'Top to Bottom', direction: 'to bottom', icon: ArrowDown },
  { name: 'Bottom to Top', direction: 'to top', icon: ArrowUp },
  { name: 'Left to Right', direction: 'to right', icon: ArrowRight },
  { name: 'Right to Left', direction: 'to left', icon: ArrowLeft },
  { name: 'Top-Left to Bottom-Right', direction: 'to bottom right', icon: ArrowDownRight },
  { name: 'Bottom-Right to Top-Left', direction: 'to top left', icon: ArrowUpLeft },
  { name: 'Top-Right to Bottom-Left', direction: 'to bottom left', icon: ArrowDownLeft },
  { name: 'Center Out', direction: 'circle', icon: Zap },
];

const COLOR_PRESETS = [
  { name: 'Primary', color: '#7c3aed' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Green', color: '#10b981' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Purple', color: '#8b5cf6' },
  { name: 'Teal', color: '#14b8a6' },
  { name: 'Yellow', color: '#eab308' },
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Black', color: '#000000' },
];

export function BackgroundSettings() {
  const { frameStyles, updateBackground } = useEditorStore();
  const [activeTab, setActiveTab] = useState<BackgroundTab>(frameStyles.background.type);

  const handleBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateBackground({ [name]: value });
  };

  const handleColorPresetClick = (color: string) => {
    updateBackground({ type: 'color', color: color });
  };
  
  const handleGradientPresetClick = (direction: string) => {
    updateBackground({ gradientDirection: direction });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const imageUrl = URL.createObjectURL(file);
      updateBackground({ type: 'image', imageUrl });
    }
  };

  const removeUploadedImage = () => {
    if (frameStyles.background.imageUrl && frameStyles.background.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(frameStyles.background.imageUrl);
    }
    // Reset to default wallpaper
    updateBackground({ type: 'image', imageUrl: WALLPAPERS[0].imageUrl, thumbnailUrl: WALLPAPERS[0].thumbnailUrl });
  };

  const selectTab = (tab: BackgroundTab) => {
    setActiveTab(tab);
    updateBackground({ type: tab });
  };

  const tabs = [
    { id: 'wallpaper', name: 'Wallpaper', icon: Sparkles },
    { id: 'color', name: 'Color', icon: Palette },
    { id: 'gradient', name: 'Gradient', icon: Zap },
    { id: 'image', name: 'Image', icon: ImageIcon },
  ];
  
  return (
    <ControlGroup
      label="Background"
      icon={<Image className="w-4 h-4 text-primary" />}
      description="Choose how your video background looks"
    >
      <div className="grid grid-cols-4 gap-1 p-1 bg-sidebar-accent/20 rounded-lg mb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id as BackgroundTab)}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-2 text-xs font-medium rounded-md transition-all duration-200",
                activeTab === tab.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs">{tab.name}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[240px]">
        {activeTab === 'wallpaper' && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {WALLPAPERS.slice(0, 12).map((wallpaper, index) => (
                <button
                  key={`${wallpaper.thumbnailUrl}-${index}`}
                  onClick={() => updateBackground({ thumbnailUrl: wallpaper.thumbnailUrl, imageUrl: wallpaper.imageUrl, type: 'wallpaper' })}
                  className={cn(
                    "relative aspect-square rounded-md overflow-hidden border-2 transition-all duration-300 group",
                    frameStyles.background.thumbnailUrl === wallpaper.thumbnailUrl
                      ? "border-primary shadow-md ring-1 ring-primary/20"
                      : "border-sidebar-border hover:border-primary/50"
                  )}
                >
                  <img
                    src={wallpaper.thumbnailUrl}
                    alt={`Wallpaper ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {frameStyles.background.thumbnailUrl === wallpaper.thumbnailUrl && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow-sm">
                        <Check className="w-2 h-2 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'color' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <ColorPickerCircle
                label="Custom"
                color={frameStyles.background.color || '#ffffff'}
                name="color"
                onChange={handleBackgroundChange}
                size="md"
              />
            </div>
            <h5 className="text-xs font-semibold text-muted-foreground text-center uppercase tracking-wider">Presets</h5>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handleColorPresetClick(preset.color)}
                  className="w-full aspect-square rounded-md border border-sidebar-border/30 transition-all duration-200 hover:border-primary/60 hover:scale-105"
                  style={{ backgroundColor: preset.color }}
                  title={preset.name}
                />
              ))}
            </div>
            <Input
              type="text"
              value={frameStyles.background.color || ''}
              onChange={(e) => handleColorPresetClick(e.target.value)}
              className="text-xs font-mono h-8"
              placeholder="#FFFFFF"
            />
          </div>
        )}

        {activeTab === 'gradient' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-6">
              <ColorPickerCircle label="Start" color={frameStyles.background.gradientStart || '#ffffff'} name="gradientStart" onChange={handleBackgroundChange} />
              <div className="flex-1 h-px bg-gradient-to-r from-sidebar-border to-transparent max-w-6" />
              <ColorPickerCircle label="End" color={frameStyles.background.gradientEnd || '#6366f1'} name="gradientEnd" onChange={handleBackgroundChange} />
            </div>
            <h5 className="text-xs font-semibold text-muted-foreground text-center uppercase tracking-wider">Direction</h5>
            <div className="grid grid-cols-4 gap-2">
              {GRADIENT_PRESETS.map((preset, index) => {
                const startColor = frameStyles.background.gradientStart || '#ffffff';
                const endColor = frameStyles.background.gradientEnd || '#6366f1';
                const gradientStyle = preset.direction === 'circle'
                  ? { background: `radial-gradient(circle, ${startColor}, ${endColor})` }
                  : { background: `linear-gradient(${preset.direction}, ${startColor}, ${endColor})` };
                return (
                  <button
                    key={index}
                    className={cn(
                      "group relative aspect-square rounded-md overflow-hidden border-2 transition-all duration-300 flex items-center justify-center",
                      frameStyles.background.gradientDirection === preset.direction ? "ring-2 ring-primary border-primary/50" : "border-sidebar-border hover:border-primary/50"
                    )}
                    style={gradientStyle}
                    onClick={() => handleGradientPresetClick(preset.direction)}
                    title={preset.name}
                  >
                    <preset.icon className="w-5 h-5 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'image' && (
          <div className="space-y-4">
            {frameStyles.background.imageUrl ? (
              <div className="relative group rounded-lg overflow-hidden">
                <img src={frameStyles.background.imageUrl} alt="Background" className="w-full h-32 object-cover" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {frameStyles.background.imageUrl.startsWith('blob:') && (
                  <button onClick={removeUploadedImage} className="absolute top-2 right-2 w-6 h-6 bg-destructive/90 backdrop-blur-sm text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-destructive">
                    <X size={12} />
                  </button>
                )}
              </div>
            ) : null}
            <label className={cn(
              "flex flex-col items-center justify-center w-full h-32 rounded-lg",
              "border-2 border-dashed border-sidebar-border/50 text-muted-foreground",
              "hover:border-primary/50 hover:text-primary hover:bg-primary/5",
              "transition-all duration-300 cursor-pointer group"
            )}>
              <div className="flex flex-col items-center gap-2">
                <UploadCloud className="w-8 h-8" />
                <div className="text-center">
                  <p className="text-xs font-medium">Upload Image</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, GIF</p>
                </div>
              </div>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>
        )}
      </div>
    </ControlGroup>
  );
}