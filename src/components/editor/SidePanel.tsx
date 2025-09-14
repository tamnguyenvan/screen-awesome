// src/components/editor/SidePanel.tsx
import React, { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { cn } from '../../lib/utils';
import { WALLPAPERS } from '../../lib/constants';
import { RegionSettingsPanel } from './RegionSettingsPanel';

type BackgroundTab = 'color' | 'gradient' | 'image' | 'wallpaper';

function FrameSettingsPanel() {
  const { frameStyles, updateFrameStyle, updateBackground } = useEditorStore();
  const [activeTab, setActiveTab] = useState<BackgroundTab>(frameStyles.background.type);
  
  const handleStyleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    updateFrameStyle({
      [name]: type === 'number' ? parseFloat(value) : value,
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
    if (tab === 'wallpaper' && !WALLPAPERS.map(w=>w.thumbnailUrl).includes(frameStyles.background.thumbnailUrl || '')) {
      updateBackground({ type: 'wallpaper', thumbnailUrl: WALLPAPERS[0].thumbnailUrl, imageUrl: WALLPAPERS[0].imageUrl });
    } else {
      updateBackground({ type: tab });
    }
  };

  return (
    <div className="p-4 space-y-6 text-sm text-foreground">
      <h2 className={cn("text-xl text-foreground font-bold border-b pb-2 mb-4")}>
        Frame Customization
      </h2>
      
      <ControlGroup label="Background">
        <div className={cn("flex border-b mb-4")}>
          <TabButton name="Wallpaper" active={activeTab === 'wallpaper'} onClick={() => selectTab('wallpaper')} />
          <TabButton name="Gradient" active={activeTab === 'gradient'} onClick={() => selectTab('gradient')} />
          <TabButton name="Color" active={activeTab === 'color'} onClick={() => selectTab('color')} />
          <TabButton name="Image" active={activeTab === 'image'} onClick={() => selectTab('image')} />
        </div>
        {activeTab === 'color' && (
          <input 
            type="color" 
            name="color" 
            value={frameStyles.background.color || '#ffffff'} 
            onChange={handleBackgroundChange} 
            className="w-full h-10 p-1 border rounded bg-input"
          />
        )}
        {activeTab === 'gradient' && (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Start</label>
            <input 
              type="color" 
              name="gradientStart" 
              value={frameStyles.background.gradientStart || '#2b3a67'} 
              onChange={handleBackgroundChange} 
              className="w-full h-10 p-1 border rounded bg-input"
            />
            <label className="text-xs text-muted-foreground">End</label>
            <input 
              type="color" 
              name="gradientEnd" 
              value={frameStyles.background.gradientEnd || '#0b0f2b'} 
              onChange={handleBackgroundChange} 
              className="w-full h-10 p-1 border rounded bg-input"
            />
          </div>
        )}
        {activeTab === 'image' && (
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageUpload} 
            className={cn(
              "w-full text-xs text-muted-foreground",
              "file:mr-4 file:py-2 file:px-4 file:rounded-md",
              "file:border-0 file:text-sm file:font-semibold",
              "file:bg-primary file:text-primary-foreground",
              "hover:file:bg-primary/90"
            )} 
          />
        )}
        {activeTab === 'wallpaper' && (
          <div className="grid grid-cols-2 gap-2">
            {WALLPAPERS.map(url => (
              <button 
                key={url.thumbnailUrl} 
                onClick={() => updateBackground({ thumbnailUrl: url.thumbnailUrl, imageUrl: url.imageUrl })} 
                className={cn(
                  "h-16 rounded-md bg-cover bg-center border-2",
                  frameStyles.background.thumbnailUrl === url.thumbnailUrl 
                    ? "border-primary" 
                    : "border-transparent"
                )}
              >
                <img 
                  src={url.thumbnailUrl} 
                  alt={url.thumbnailUrl} 
                  className="w-full h-full object-cover rounded" 
                />
              </button>
            ))}
          </div>
        )}
      </ControlGroup>
      
      <ControlGroup label={`Padding: ${frameStyles.padding}%`}>
        <input
          type="range"
          name="padding"
          min="0"
          max="30"
          value={frameStyles.padding}
          onChange={handleStyleChange}
          className="w-full"
        />
      </ControlGroup>

      <ControlGroup label="Frame">
        <div className="space-y-4">
          <div>
            <label className="block text-xs mb-1 text-muted-foreground">
              Border Radius: {frameStyles.borderRadius}px
            </label>
            <input
              type="range" name="borderRadius" min="0" max="50"
              value={frameStyles.borderRadius} onChange={handleStyleChange}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs mb-1 text-muted-foreground">
              Shadow: {frameStyles.shadow}px
            </label>
            <input
              type="range" name="shadow" min="0" max="50"
              value={frameStyles.shadow} onChange={handleStyleChange}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs mb-1 text-muted-foreground">
              Border Width: {frameStyles.borderWidth}px
            </label>
            <input
              type="range" name="borderWidth" min="0" max="20"
              value={frameStyles.borderWidth} onChange={handleStyleChange}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs mb-1 text-muted-foreground">
              Border Color
            </label>
            <input
              type="color" name="borderColor" value={frameStyles.borderColor}
              onChange={handleStyleChange}
              className="w-10 h-10 p-1 border rounded bg-input"
            />
          </div>
        </div>
      </ControlGroup>
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
const ControlGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div>
    <label className="block font-medium mb-2 text-foreground">{label}</label>
    {children}
  </div>
)

const TabButton = ({ name, active, onClick }: { name: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className={cn(
      "px-4 py-2 text-sm font-medium transition-colors",
      active 
        ? "border-b-2 border-primary text-primary" 
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    {name}
  </button>
)