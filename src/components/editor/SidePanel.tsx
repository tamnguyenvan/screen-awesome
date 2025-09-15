// src/components/editor/SidePanel.tsx
import React, { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { cn } from '../../lib/utils';
import { WALLPAPERS } from '../../lib/constants';
import { RegionSettingsPanel } from './RegionSettingsPanel';
import { Palette, Image, Sparkles, ImageIcon, Check } from 'lucide-react';
import { Input } from '../ui/input';
import Slider from '../ui/slider';

type BackgroundTab = 'color' | 'gradient' | 'image' | 'wallpaper';

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
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const imageUrl = URL.createObjectURL(file);
      updateBackground({ type: 'image', imageUrl });
    }
  }

  const selectTab = (tab: BackgroundTab) => {
    setActiveTab(tab);
    updateBackground({ type: tab });
  };

  const tabs = [
    { id: 'wallpaper', name: 'Wallpapers', icon: Sparkles },
    { id: 'gradient', name: 'Gradient', icon: Palette },
    { id: 'color', name: 'Solid', icon: Palette },
    { id: 'image', name: 'Image', icon: ImageIcon },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-sidebar-foreground">Frame Style</h2>
            <p className="text-sm text-muted-foreground">Customize your video frame</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-8">
          {/* Background Section */}
          <ControlGroup label="Background" icon={<Image className="w-4 h-4" />}>
            {/* Tab Navigation */}
            <div className="flex border border-sidebar-border rounded-lg p-1 mb-6 bg-sidebar-accent/20">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => selectTab(tab.id as BackgroundTab)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                      activeTab === tab.id
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="min-h-[120px]">
              {activeTab === 'color' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-sidebar-foreground mb-2">Color</label>
                  <div className="relative">
                    <Input 
                      type="color" 
                      name="color" 
                      value={frameStyles.background.color || '#ffffff'} 
                      onChange={handleBackgroundChange} 
                      className="w-full h-12 p-1 border border-sidebar-border rounded-lg bg-input cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'gradient' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-sidebar-foreground mb-2">Start Color</label>
                    <Input 
                      type="color" 
                      name="gradientStart" 
                      value={frameStyles.background.gradientStart || '#2b3a67'} 
                      onChange={handleBackgroundChange} 
                      className="w-full h-12 p-1 border border-sidebar-border rounded-lg bg-input cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sidebar-foreground mb-2">End Color</label>
                    <Input 
                      type="color" 
                      name="gradientEnd" 
                      value={frameStyles.background.gradientEnd || '#0b0f2b'} 
                      onChange={handleBackgroundChange} 
                      className="w-full h-12 p-1 border border-sidebar-border rounded-lg bg-input cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'image' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-sidebar-foreground mb-2">Upload Image</label>
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    className={cn(
                      "w-full text-sm text-muted-foreground",
                      "file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0",
                      "file:text-sm file:font-medium file:bg-primary file:text-primary-foreground",
                      "hover:file:bg-primary/90 file:transition-all file:duration-200",
                      "border border-dashed border-sidebar-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                    )} 
                  />
                </div>
              )}

              {activeTab === 'wallpaper' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-sidebar-foreground mb-2">Choose Wallpaper</label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WALLPAPERS.map((wallpaper, index) => (
                      <button 
                        key={`${wallpaper.thumbnailUrl}-${index}`} 
                        onClick={() => updateBackground({ thumbnailUrl: wallpaper.thumbnailUrl, imageUrl: wallpaper.imageUrl })} 
                        className={cn(
                          "relative aspect-square rounded-md bg-cover bg-center border-2 transition-all duration-200 overflow-hidden group",
                          frameStyles.background.thumbnailUrl === wallpaper.thumbnailUrl 
                            ? "border-primary shadow-md ring-2 ring-primary/20" 
                            : "border-border hover:border-primary/50 hover:shadow-sm"
                        )}
                      >
                        <img 
                          src={wallpaper.thumbnailUrl} 
                          alt={`Wallpaper ${index + 1}`} 
                          className="w-full h-full object-cover rounded-sm transition-transform duration-200 group-hover:scale-105" 
                        />
                        {frameStyles.background.thumbnailUrl === wallpaper.thumbnailUrl && (
                          <div className="absolute inset-0 bg-primary/20 rounded-sm flex items-center justify-center">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ControlGroup>
          
          {/* Padding Control */}
          <ControlGroup label={`Padding (${frameStyles.padding}%)`}>
            <div className="space-y-3">
              <Slider
                min={0}
                max={30}
                value={frameStyles.padding}
                onChange={(value) => handleStyleChange("padding", value)}
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary slider"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>30%</span>
              </div>
            </div>
          </ControlGroup>

          {/* Frame Effects */}
          <ControlGroup label="Frame Effects">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-3">
                  Border Radius ({frameStyles.borderRadius}px)
                </label>
                <Slider
                  min={0} 
                  max={50}
                  value={frameStyles.borderRadius} 
                  onChange={(value) => handleStyleChange("borderRadius", value)}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary slider"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Sharp</span>
                  <span>Rounded</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-3">
                  Shadow ({frameStyles.shadow}px)
                </label>
                <Slider
                  min={0} 
                  max={50}
                  value={frameStyles.shadow} 
                  onChange={(value) => handleStyleChange("shadow", value)}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary slider"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>None</span>
                  <span>Strong</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-3">
                  Border Width ({frameStyles.borderWidth}px)
                </label>
                <Slider
                  min={0} 
                  max={20}
                  value={frameStyles.borderWidth} 
                  onChange={(value) => handleStyleChange("borderWidth", value)}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary slider"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>None</span>
                  <span>Thick</span>
                </div>
              </div>
              
              {frameStyles.borderWidth > 0 && (
                <div>
                  <label className="block text-sm font-medium text-sidebar-foreground mb-3">
                    Border Color
                  </label>
                  <Input
                    type="color" 
                    name="borderColor" 
                    value={frameStyles.borderColor}
                    onChange={(e) => handleStyleChange("borderColor", e.target.value)}
                    className="w-full h-12 p-1 border border-sidebar-border rounded-lg bg-input cursor-pointer"
                  />
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

// Helper components
const ControlGroup = ({ 
  label, 
  children, 
  icon 
}: { 
  label: string; 
  children: React.ReactNode; 
  icon?: React.ReactNode;
}) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-semibold text-sidebar-foreground uppercase tracking-wide">
        {label}
      </h3>
    </div>
    {children}
  </div>
)