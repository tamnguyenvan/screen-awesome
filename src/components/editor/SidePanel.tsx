// src/components/editor/SidePanel.tsx
import React, { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { cn } from '../../lib/utils';
import { WALLPAPERS, WALLPAPERS_THUMBNAILS } from '../../lib/constants';

type BackgroundTab = 'color' | 'gradient' | 'image' | 'wallpaper';

export function SidePanel() {
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
    // Cập nhật type trong store khi người dùng chuyển tab
    if (tab === 'wallpaper' && !WALLPAPERS_THUMBNAILS.includes(frameStyles.background.thumbnailUrl || '')) {
      // Chọn wallpaper đầu tiên nếu chưa có
      updateBackground({ type: 'wallpaper', thumbnailUrl: WALLPAPERS[0].thumbnailUrl, imageUrl: WALLPAPERS[0].imageUrl });
    } else {
      updateBackground({ type: tab });
    }
  };

  return (
    <div className="p-4 space-y-6 text-sm text-gray-700 dark:text-gray-300">
      <h2 className={cn("text-xl font-bold border-b pb-2 mb-4", "dark:text-white")}>
        Frame Customization
      </h2>

      {/* Background Section with Tabs */}
      <ControlGroup label="Background">
        <div className={cn("flex border-b mb-4")}>
          <TabButton 
            name="Wallpaper" 
            active={activeTab === 'wallpaper'} 
            onClick={() => selectTab('wallpaper')} 
          />
          <TabButton 
            name="Gradient" 
            active={activeTab === 'gradient'} 
            onClick={() => selectTab('gradient')} 
          />
          <TabButton 
            name="Color" 
            active={activeTab === 'color'} 
            onClick={() => selectTab('color')} 
          />
          <TabButton 
            name="Image" 
            active={activeTab === 'image'} 
            onClick={() => selectTab('image')} 
          />
        </div>
        {activeTab === 'color' && (
          <input 
            type="color" 
            name="color" 
            value={frameStyles.background.color || '#ffffff'} 
            onChange={handleBackgroundChange} 
            className={cn(
              "w-full h-10 p-1 border rounded",
              "bg-gray-100 dark:bg-gray-700",
              "dark:border-gray-600"
            )} 
          />
        )}
        {activeTab === 'gradient' && (
          <div className={cn("space-y-2")}>
            <label className={cn("text-xs")}>Start</label>
            <input 
              type="color" 
              name="gradientStart" 
              value={frameStyles.background.gradientStart || '#2b3a67'} 
              onChange={handleBackgroundChange} 
              className={cn(
                "w-full h-10 p-1 border rounded",
                "bg-gray-100 dark:bg-gray-700",
                "dark:border-gray-600"
              )} 
            />
            <label className={cn("text-xs")}>End</label>
            <input 
              type="color" 
              name="gradientEnd" 
              value={frameStyles.background.gradientEnd || '#0b0f2b'} 
              onChange={handleBackgroundChange} 
              className={cn(
                "w-full h-10 p-1 border rounded",
                "bg-gray-100 dark:bg-gray-700",
                "dark:border-gray-600"
              )} 
            />
          </div>
        )}
        {activeTab === 'image' && (
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageUpload} 
            className={cn(
              "w-full text-xs",
              "file:mr-4 file:py-2 file:px-4 file:rounded-md",
              "file:border-0 file:text-sm file:font-semibold",
              "file:bg-blue-50 file:text-blue-700",
              "hover:file:bg-blue-100",
              "dark:file:bg-blue-900/50 dark:file:text-blue-300",
              "dark:hover:file:bg-blue-900"
            )} 
          />
        )}
        {activeTab === 'wallpaper' && (
          <div className={cn("grid grid-cols-2 gap-2")}>
            {WALLPAPERS.map(url => (
              <button 
                key={url.thumbnailUrl} 
                onClick={() => updateBackground({ thumbnailUrl: url.thumbnailUrl, imageUrl: url.imageUrl })} 
                className={cn(
                  "h-16 rounded-md bg-cover bg-center border-2",
                  frameStyles.background.thumbnailUrl === url.thumbnailUrl 
                    ? "border-blue-500" 
                    : "border-transparent"
                )}
              >
                <img 
                  src={url.thumbnailUrl} 
                  alt={url.thumbnailUrl} 
                  className={cn("w-full h-full object-cover rounded")} 
                />
              </button>
            ))}
          </div>
        )}
      </ControlGroup>

      {/* Padding to use % */}
      <ControlGroup label={`Padding: ${frameStyles.padding}%`}>
        <input
          type="range"
          name="padding"
          min="0"
          max="30" // Giới hạn từ 0-30%
          value={frameStyles.padding}
          onChange={handleStyleChange}
          className={cn("w-full")}
        />
      </ControlGroup>

      {/* Frame */}
      <ControlGroup label="Frame">
        <div className={cn("space-y-4")}>
          <div>
            <label className={cn("block text-xs mb-1")}>
              Border Radius: {frameStyles.borderRadius}px
            </label>
            <input
              type="range"
              name="borderRadius"
              min="0"
              max="50"
              value={frameStyles.borderRadius}
              onChange={handleStyleChange}
              className={cn("w-full")}
            />
          </div>

          <div>
            <label className={cn("block text-xs mb-1")}>
              Shadow: {frameStyles.shadow}px
            </label>
            <input
              type="range"
              name="shadow"
              min="0"
              max="50"
              value={frameStyles.shadow}
              onChange={handleStyleChange}
              className={cn("w-full")}
            />
          </div>

          <div>
            <label className={cn("block text-xs mb-1")}>
              Border Width: {frameStyles.borderWidth}px
            </label>
            <input
              type="range"
              name="borderWidth"
              min="0"
              max="20"
              value={frameStyles.borderWidth}
              onChange={handleStyleChange}
              className={cn("w-full")}
            />
          </div>

          <div>
            <label className={cn("block text-xs mb-1")}>
              Border Color
            </label>
            <input
              type="color"
              name="borderColor"
              value={frameStyles.borderColor}
              onChange={handleStyleChange}
              className={cn(
                "w-10 h-10 p-1 border rounded",
                "bg-gray-100 dark:bg-gray-700",
                "dark:border-gray-600"
              )}
            />
          </div>
        </div>
      </ControlGroup>

    </div>
  );
}

// Helper components
const ControlGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div>
    <label className={cn("block font-medium mb-2")}>
      {label}
    </label>
    {children}
  </div>
)

const TabButton = ({ name, active, onClick }: { name: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className={cn(
      "px-4 py-2 text-sm font-medium transition-colors",
      active 
        ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400" 
        : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
    )}
  >
    {name}
  </button>
)