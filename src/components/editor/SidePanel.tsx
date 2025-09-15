// src/components/editor/SidePanel.tsx
import React, { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { cn } from '../../lib/utils';
import { WALLPAPERS } from '../../lib/constants';
import { RegionSettingsPanel } from './RegionSettingsPanel';
import { Palette, Image, Sparkles, ImageIcon, Check, UploadCloud, X, Zap } from 'lucide-react';
import { Input } from '../ui/input';
import Slider from '../ui/slider';

type BackgroundTab = 'color' | 'gradient' | 'image' | 'wallpaper';

// Helper component for circular color picker
const ColorPickerCircle = ({ 
  label, 
  color, 
  name, 
  onChange,
  size = 'md'
}: { 
  label: string;
  color: string;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div className="flex flex-col items-center gap-2">
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
            "w-full h-full rounded-full border-3 border-sidebar-border/30 group-hover:border-primary/60 transition-all duration-300 shadow-lg group-hover:shadow-xl group-hover:scale-110 group-active:scale-100",
            "ring-2 ring-background"
          )}
          style={{ backgroundColor: color }}
        />
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
      </label>
      <span className="text-xs font-medium text-muted-foreground capitalize">{label}</span>
    </div>
  );
};

// Enhanced gradient presets using design system colors
const GRADIENT_PRESETS = [
  { 
    name: 'Primary Fade',
    start: 'oklch(0.5854 0.2041 277.1173)', // --primary
    end: 'oklch(1.0000 0 0)' // white
  },
  { 
    name: 'Accent Fade',
    start: 'oklch(0.9299 0.0334 272.7879)', // --accent
    end: 'oklch(1.0000 0 0)' // white
  },
  { 
    name: 'Secondary Fade',
    start: 'oklch(0.9276 0.0058 264.5313)', // --secondary
    end: 'oklch(1.0000 0 0)' // white
  },
  { 
    name: 'Muted Fade',
    start: 'oklch(0.9670 0.0029 264.5419)', // --muted
    end: 'oklch(1.0000 0 0)' // white
  },
  { 
    name: 'Warm Gradient',
    start: 'oklch(0.6368 0.2078 25.3313)', // warm color
    end: 'oklch(1.0000 0 0)' // white
  },
  { 
    name: 'Cool Gradient',
    start: 'oklch(0.5854 0.2041 200)', // cool blue
    end: 'oklch(1.0000 0 0)' // white
  },
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const imageUrl = URL.createObjectURL(file);
      updateBackground({ type: 'image', imageUrl });
    }
  };
  
  const removeUploadedImage = () => {
    // Revoke the object URL to prevent memory leaks
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
    { id: 'wallpaper', name: 'Wallpapers', icon: Sparkles, description: 'Pre-made backgrounds' },
    { id: 'gradient', name: 'Gradient', icon: Zap, description: 'Smooth color transitions' },
    { id: 'color', name: 'Solid', icon: Palette, description: 'Single color background' },
    { id: 'image', name: 'Image', icon: ImageIcon, description: 'Custom images' },
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
            {/* Tab Navigation */}
            <div className="flex border border-sidebar-border rounded-lg p-1 mb-6 bg-sidebar-accent/20">
              {tabs.map((tab) => {
                return (
                  <button
                    key={tab.id}
                    onClick={() => selectTab(tab.id as BackgroundTab)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                      "active:scale-95", // Added light click effect
                      activeTab === tab.id
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content with Fixed Height to Prevent Layout Shift */}
            <div className="min-h-[280px] flex flex-col">
              {activeTab === 'color' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                  <div className="text-center mb-4">
                    <h4 className="text-sm font-semibold text-sidebar-foreground mb-2">Solid Color</h4>
                    <p className="text-xs text-muted-foreground">Pick a single color for your background</p>
                  </div>
                  <ColorPickerCircle
                    label="Background Color"
                    color={frameStyles.background.color || '#ffffff'}
                    name="color"
                    onChange={handleBackgroundChange}
                    size="lg"
                  />
                </div>
              )}

              {activeTab === 'gradient' && (
                <div className="flex-1 space-y-6">
                  <div className="text-center">
                    <h4 className="text-sm font-semibold text-sidebar-foreground mb-2">Custom Gradient</h4>
                    <p className="text-xs text-muted-foreground mb-6">Create smooth color transitions</p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-12">
                    <ColorPickerCircle
                      label="Start Color"
                      color={frameStyles.background.gradientStart || '#5854ec'}
                      name="gradientStart"
                      onChange={handleBackgroundChange}
                    />
                    <div className="flex-1 h-px bg-gradient-to-r from-sidebar-border to-transparent max-w-8" />
                    <ColorPickerCircle
                      label="End Color"
                      color={frameStyles.background.gradientEnd || '#ffffff'}
                      name="gradientEnd"
                      onChange={handleBackgroundChange}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="text-center">
                      <h5 className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider uppercase">Quick Presets</h5>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {GRADIENT_PRESETS.map((preset, index) => (
                        <button
                          key={index}
                          className={cn(
                            "group relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-300",
                            "hover:scale-105 hover:shadow-lg active:scale-100",
                            "border-sidebar-border hover:border-primary/50"
                          )}
                          style={{ background: `linear-gradient(135deg, ${preset.start}, ${preset.end})` }}
                          onClick={() => updateBackground({ 
                            type: 'gradient', 
                            gradientStart: preset.start, 
                            gradientEnd: preset.end 
                          })}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <div className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'image' && (
                <div className="flex-1 space-y-4">
                  <div className="text-center">
                    <h4 className="text-sm font-semibold text-sidebar-foreground mb-2">Custom Image</h4>
                    <p className="text-xs text-muted-foreground mb-6">Upload your own background image</p>
                  </div>
                  
                  {frameStyles.background.imageUrl && frameStyles.background.type === 'image' ? (
                    <div className="relative group rounded-lg overflow-hidden">
                      <img
                        src={frameStyles.background.imageUrl}
                        alt="Uploaded background"
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <button
                        onClick={removeUploadedImage}
                        className="absolute top-3 right-3 w-8 h-8 bg-destructive/90 backdrop-blur-sm text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-destructive hover:scale-110"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className={cn(
                      "flex flex-col items-center justify-center w-full h-48 rounded-xl",
                      "border-2 border-dashed border-sidebar-border/50 text-muted-foreground",
                      "hover:border-primary/50 hover:text-primary hover:bg-primary/5",
                      "transition-all duration-300 cursor-pointer group"
                    )}>
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold">Drop image here</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 10MB</p>
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

              {activeTab === 'wallpaper' && (
                <div className="flex-1 space-y-4">
                  <div className="text-center">
                    <h4 className="text-sm font-semibold text-sidebar-foreground mb-2">Wallpaper Collection</h4>
                    <p className="text-xs text-muted-foreground mb-6">Professional backgrounds ready to use</p>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    {WALLPAPERS.map((wallpaper, index) => (
                      <button
                        key={`${wallpaper.thumbnailUrl}-${index}`}
                        onClick={() => updateBackground({ thumbnailUrl: wallpaper.thumbnailUrl, imageUrl: wallpaper.imageUrl })}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-300 group",
                          frameStyles.background.thumbnailUrl === wallpaper.thumbnailUrl
                            ? "border-primary shadow-lg ring-2 ring-primary/20 scale-105"
                            : "border-sidebar-border hover:border-primary/50 hover:shadow-md hover:scale-105"
                        )}
                      >
                        <img
                          src={wallpaper.thumbnailUrl}
                          alt={`Wallpaper ${index + 1}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        {frameStyles.background.thumbnailUrl === wallpaper.thumbnailUrl && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                              <Check className="w-3 h-3 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
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