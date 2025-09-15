// src/components/editor/SidePanel.tsx
import React, { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { cn } from '../../lib/utils';
import { WALLPAPERS } from '../../lib/constants';
import { RegionSettingsPanel } from './RegionSettingsPanel';
import {
  Palette, Image, Sparkles, ImageIcon, Check, UploadCloud, X, Zap,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowDownRight, ArrowUpLeft, ArrowDownLeft
} from 'lucide-react';
import { Input } from '../ui/input';
import Slider from '../ui/slider';

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

// Gradient presets with proper gradient display
const GRADIENT_PRESETS = [
  {
    name: 'Top to Bottom',
    direction: 'to bottom',
    icon: ArrowDown
  },
  {
    name: 'Bottom to Top',
    direction: 'to top',
    icon: ArrowUp
  },
  {
    name: 'Left to Right',
    direction: 'to right',
    icon: ArrowRight
  },
  {
    name: 'Right to Left',
    direction: 'to left',
    icon: ArrowLeft
  },
  {
    name: 'Top-Left to Bottom-Right',
    direction: 'to bottom right',
    icon: ArrowDownRight
  },
  {
    name: 'Bottom-Right to Top-Left',
    direction: 'to top left',
    icon: ArrowUpLeft
  },
  {
    name: 'Top-Right to Bottom-Left',
    direction: 'to bottom left',
    icon: ArrowDownLeft
  },
  {
    name: 'Center Out',
    direction: 'circle',
    icon: Zap
  },
];

// Quick color presets with hex values
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

function FrameSettingsPanel() {
  const { frameStyles, updateFrameStyle, updateBackground } = useEditorStore();
  const [activeTab, setActiveTab] = useState<BackgroundTab>(frameStyles.background.type);

  const handleStyleChange = (name: string, value: string | number) => {
    updateFrameStyle({
      [name]: value,
    });
  };

  const handleBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateBackground({ [name]: value });
  };

  const handleColorPresetClick = (color: string) => {
    updateBackground({ type: 'color', color: color });
  };

  const handleGradientPresetClick = (direction: string) => {
    const gradientStart = frameStyles.background.gradientStart || '#6366f1'; // Darker purple for better contrast
    const gradientEnd = frameStyles.background.gradientEnd || '#a5b4fc'; // Lighter version of #6366f1

    updateBackground({
      type: 'gradient',
      gradientStart,
      gradientEnd,
      gradientDirection: direction
    });
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
    updateBackground({ type: 'image', imageUrl: undefined });
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border bg-gradient-to-r from-sidebar to-sidebar-accent/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-inner border border-primary/10">
            <Palette className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-sidebar-foreground">Frame Style</h2>
            <p className="text-sm text-muted-foreground">Customize your video appearance</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-8">
          {/* Background Section */}
          <ControlGroup
            label="Background"
            icon={<Image className="w-4 h-4 text-primary" />}
            description="Choose how your video background looks"
          >
            {/* Compact Tab Navigation */}
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

            {/* Compact Tab Content */}
            <div className="min-h-[200px]">
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
                  {WALLPAPERS.length > 12 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{WALLPAPERS.length - 12} more wallpapers
                    </p>
                  )}
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

                  <div className="space-y-3">
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
                    <ColorPickerCircle
                      label="Start"
                      color={frameStyles.background.gradientStart || '#ffffff'} // Darker color for better contrast
                      name="gradientStart"
                      onChange={handleBackgroundChange}
                    />
                    <div className="flex-1 h-px bg-gradient-to-r from-sidebar-border to-transparent max-w-6" />
                    <ColorPickerCircle
                      label="End"
                      color={frameStyles.background.gradientEnd || '#6366f1'} // Lighter color for better contrast
                      name="gradientEnd"
                      onChange={handleBackgroundChange}
                    />
                  </div>

                  <div className="space-y-3">
                    <h5 className="text-xs font-semibold text-muted-foreground text-center uppercase tracking-wider">Direction</h5>
                    <div className="grid grid-cols-4 gap-2">
                      {GRADIENT_PRESETS.map((preset, index) => {
                        const startColor = '#ffffff';
                        const endColor = '#6366f1';

                        const gradientStyle = preset.direction === 'circle'
                          ? { background: `radial-gradient(circle, ${startColor}, ${endColor})` }
                          : { background: `linear-gradient(${preset.direction}, ${startColor}, ${endColor})` };

                        return (
                          <button
                            key={index}
                            className="group relative aspect-square rounded-md overflow-hidden border-2 transition-all duration-300 flex items-center justify-center text-white/60 hover:text-white border-sidebar-border hover:border-primary/50"
                            style={gradientStyle}
                            onClick={() => handleGradientPresetClick(preset.direction)}
                            title={preset.name}
                          >
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'image' && (
                <div className="space-y-4">
                  {frameStyles.background.imageUrl && frameStyles.background.type === 'image' ? (
                    <div className="relative group rounded-lg overflow-hidden">
                      <img
                        src={frameStyles.background.imageUrl}
                        alt="Uploaded background"
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <button
                        onClick={removeUploadedImage}
                        className="absolute top-2 right-2 w-6 h-6 bg-destructive/90 backdrop-blur-sm text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-destructive"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
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
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          </ControlGroup>

          {/* Enhanced Padding Control */}
          <ControlGroup
            label={`Padding (${frameStyles.padding}%)`}
            description="Space around your video content"
          >
            <div className="space-y-4">
              <Slider
                min={0}
                max={30}
                value={frameStyles.padding}
                onChange={(value) => handleStyleChange("padding", value)}
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary slider"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>No padding</span>
                <span>Maximum</span>
              </div>
            </div>
          </ControlGroup>

          {/* Enhanced Frame Effects */}
          <ControlGroup
            label="Frame Effects"
            description="Visual enhancements for your video"
          >
            <div className="space-y-8">
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-sidebar-foreground mb-4">
                  <span>Corner Radius</span>
                  <span className="text-xs text-muted-foreground">{frameStyles.borderRadius}px</span>
                </label>
                <Slider
                  min={0}
                  max={50}
                  value={frameStyles.borderRadius}
                  onChange={(value) => handleStyleChange("borderRadius", value)}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary slider"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Sharp corners</span>
                  <span>Rounded</span>
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-sm font-medium text-sidebar-foreground mb-4">
                  <span>Drop Shadow</span>
                  <span className="text-xs text-muted-foreground">{frameStyles.shadow}px</span>
                </label>
                <Slider
                  min={0}
                  max={50}
                  value={frameStyles.shadow}
                  onChange={(value) => handleStyleChange("shadow", value)}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary slider"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>No shadow</span>
                  <span>Strong shadow</span>
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-sm font-medium text-sidebar-foreground mb-4">
                  <span>Border Thickness</span>
                  <span className="text-xs text-muted-foreground">{frameStyles.borderWidth}px</span>
                </label>
                <Slider
                  min={0}
                  max={20}
                  value={frameStyles.borderWidth}
                  onChange={(value) => handleStyleChange("borderWidth", value)}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary slider"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>No border</span>
                  <span>Thick border</span>
                </div>
              </div>

              {frameStyles.borderWidth > 0 && (
                <div className="pt-4 border-t border-sidebar-border/50">
                  <label className="block text-sm font-medium text-sidebar-foreground mb-4">
                    Border Color
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      name="borderColor"
                      value={frameStyles.borderColor}
                      onChange={(e) => handleStyleChange("borderColor", e.target.value)}
                      className="w-16 h-10 p-1 border border-sidebar-border rounded-lg bg-input cursor-pointer"
                    />
                    <div className="flex-1">
                      <Input
                        type="text"
                        value={frameStyles.borderColor}
                        onChange={(e) => handleStyleChange("borderColor", e.target.value)}
                        className="text-xs font-mono"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ControlGroup>
        </div>
      </div>
    </div>
  );
}

export function SidePanel() {
  const { selectedRegionId, zoomRegions, cutRegions } = useEditorStore();

  const selectedRegion =
    zoomRegions.find(r => r.id === selectedRegionId) ||
    cutRegions.find(r => r.id === selectedRegionId);

  if (selectedRegion) {
    return <RegionSettingsPanel region={selectedRegion} />;
  }

  return <FrameSettingsPanel />;
}

// Enhanced Helper Components
const ControlGroup = ({
  label,
  children,
  icon,
  description
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  description?: string;
}) => (
  <div className="space-y-4">
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold text-sidebar-foreground uppercase tracking-wide">
          {label}
        </h3>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
    <div className="pl-0">
      {children}
    </div>
  </div>
);