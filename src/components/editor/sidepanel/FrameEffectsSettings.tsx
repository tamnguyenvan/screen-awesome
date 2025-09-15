// src/components/editor/sidepanel/FrameEffectsSettings.tsx
import { useEditorStore } from '../../../store/editorStore';
import { Input } from '../../ui/input';
import Slider from '../../ui/slider';
import { ControlGroup } from './ControlGroup';

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
        label={`Padding (${frameStyles.padding}%)`}
        description="Space around your video content"
      >
        <div className="space-y-4">
          <Slider
            min={0}
            max={30}
            value={frameStyles.padding}
            onChange={(value) => handleStyleChange("padding", value)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>No padding</span>
            <span>Maximum</span>
          </div>
        </div>
      </ControlGroup>

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
    </>
  );
}