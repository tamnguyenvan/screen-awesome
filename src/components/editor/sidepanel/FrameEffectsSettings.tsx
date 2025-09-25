import { useEditorStore } from '../../../store/editorStore';
import { OpacityIcon } from '../../ui/icons';
import Slider from '../../ui/slider';
import { ControlGroup } from './ControlGroup';
import { Palette } from 'lucide-react';

export function FrameEffectsSettings() {
  const { frameStyles, updateFrameStyle } = useEditorStore();

  const handleStyleChange = (name: string, value: string | number) => {
    updateFrameStyle({
      [name]: typeof value === 'string' ? parseFloat(value) || 0 : value,
    });
  };

  return (
    <>
      <ControlGroup
        label="Padding"
        description="Space around your video content"
      >
        <div>
          <label className="flex items-center justify-between text-sm font-medium text-sidebar-foreground mb-4">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                <path d="M320-600q17 0 28.5-11.5T360-640q0-17-11.5-28.5T320-680q-17 0-28.5 11.5T280-640q0 17 11.5 28.5T320-600Zm160 0q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm160 0q17 0 28.5-11.5T680-640q0-17-11.5-28.5T640-680q-17 0-28.5 11.5T600-640q0 17 11.5 28.5T640-600ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z" />
              </svg>
              <span>Padding</span>
            </div>
            <span className="text-xs text-muted-foreground">{frameStyles.padding}%</span>
          </label>
          <Slider
            min={0}
            max={30}
            value={frameStyles.padding}
            onChange={(value) => handleStyleChange("padding", value)}
          />
        </div>
      </ControlGroup>

      <ControlGroup
        label="Frame Effects"
        description="Visual enhancements for your video"
      >
        <div className="space-y-8">
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-sidebar-foreground mb-4">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                  <path d="M120-120v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm160 640v-80h80v80h-80Zm0-640v-80h80v80h-80Zm160 640v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm0-160v-80h80v80h-80Zm80-160h-80v-200q0-50-35-85t-85-35H440v-80h200q83 0 141.5 58.5T840-640v200Z" />
                </svg>
                <span>Corner Radius</span>
              </div>
              <span className="text-xs text-muted-foreground">{frameStyles.borderRadius}px</span>
            </label>
            <Slider
              min={0}
              max={50}
              value={frameStyles.borderRadius}
              onChange={(value) => handleStyleChange("borderRadius", value)}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                <path d="M160-80q-33 0-56.5-23.5T80-160v-480q0-33 23.5-56.5T160-720h80v-80q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240h-80v80q0 33-23.5 56.5T640-80H160Zm160-240h480v-480H320v480Z" />
              </svg>
              <span>Shadow</span>
            </label>

            {/* Shadow Size */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-sidebar-foreground">Size</span>
                <span className="text-xs text-muted-foreground">{frameStyles.shadow}px</span>
              </div>
              <Slider
                min={0}
                max={50}
                step={1}
                value={frameStyles.shadow}
                onChange={(value) => handleStyleChange("shadow", value)}
              />
            </div>

            {/* Shadow Color */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-sidebar-foreground flex items-center gap-2">
                  <Palette className="w-4 h-4" /> Color
                </span>
                <input
                  type="color"
                  value={frameStyles.shadowColor.substring(0, 7)}
                  onChange={(e) =>
                    updateFrameStyle({
                      shadowColor: e.target.value + frameStyles.shadowColor.substring(7),
                    })
                  }
                  className="w-8 h-8 rounded-full border border-border cursor-pointer transition-all duration-200"
                />
              </div>
            </div>

            {/* Shadow Opacity */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-sidebar-foreground flex items-center gap-2">
                  <OpacityIcon />
                  Opacity
                </span>
                <span className="text-xs text-muted-foreground">
                  {Math.round((parseFloat(frameStyles.shadowColor.split(',')[3] || '0.4') * 100))}%
                </span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                className="w-full"
                value={parseFloat(frameStyles.shadowColor.split(',')[3] || '0.4')}
                onChange={(value) => {
                  const parts = frameStyles.shadowColor.match(
                    /^rgba?\((\d+),\s*(\d+),\s*(\d+)(,\s*\d*\.?\d+)?\)$/
                  );
                  if (parts) {
                    const newColor = `rgba(${parts[1]}, ${parts[2]}, ${parts[3]}, ${value})`;
                    updateFrameStyle({ shadowColor: newColor });
                  } else {
                    updateFrameStyle({ shadowColor: `rgba(0, 0, 0, ${value})` });
                  }
                }}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center justify-between text-sm font-medium text-sidebar-foreground mb-4">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                  <path d="M120-120v-720h720v720H120Zm640-80v-240H520v240h240Zm0-560H520v240h240v-240Zm-560 0v240h240v-240H200Zm0 560h240v-240H200v240Z" />
                </svg>
                <span>Border Thickness</span>
              </div>
              <span className="text-xs text-muted-foreground">{frameStyles.borderWidth}px</span>
            </label>
            <Slider
              min={0}
              max={20}
              value={frameStyles.borderWidth}
              onChange={(value) => handleStyleChange("borderWidth", value)}
            />
          </div>
        </div>
      </ControlGroup>
    </>
  );
}