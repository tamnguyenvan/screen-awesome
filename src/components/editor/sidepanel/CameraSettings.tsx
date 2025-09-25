import { useEditorStore } from '../../../store/editorStore';
import { ControlGroup } from './ControlGroup';
import {
  CornerUpLeft, CornerUpRight, CornerDownLeft, CornerDownRight,
  Video, Eye, EyeOff, Image
} from 'lucide-react';
import { Button } from '../../ui/button';
import Slider from '../../ui/slider';
import { useShallow } from 'zustand/react/shallow';

export function CameraSettings() {
  const { isWebcamVisible, webcamPosition, webcamStyles, setWebcamVisibility, setWebcamPosition, updateWebcamStyle } = useEditorStore(
    useShallow(state => ({
      isWebcamVisible: state.isWebcamVisible,
      webcamPosition: state.webcamPosition,
      webcamStyles: state.webcamStyles,
      setWebcamVisibility: state.setWebcamVisibility,
      setWebcamPosition: state.setWebcamPosition,
      updateWebcamStyle: state.updateWebcamStyle,
    }))
  );

  const positions = [
    { pos: 'top-left' as const, icon: <CornerUpLeft className="w-5 h-5" />, label: 'Top Left' },
    { pos: 'top-right' as const, icon: <CornerUpRight className="w-5 h-5" />, label: 'Top Right' },
    { pos: 'bottom-left' as const, icon: <CornerDownLeft className="w-5 h-5" />, label: 'Bottom Left' },
    { pos: 'bottom-right' as const, icon: <CornerDownRight className="w-5 h-5" />, label: 'Bottom Right' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Video className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-sidebar-foreground">Camera Settings</h2>
            <p className="text-sm text-muted-foreground">Adjust your webcam overlay</p>
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 p-6 space-y-8 overflow-y-auto">
        <ControlGroup
          label="Visibility"
          icon={<Eye className="w-4 h-4 text-primary" />}
          description="Show or hide the webcam overlay"
        >
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-lg">
            <Button
              variant={isWebcamVisible ? 'secondary' : 'ghost'}
              onClick={() => setWebcamVisibility(true)}
              className="h-auto py-2 flex items-center gap-2"
            >
              <Eye className="w-4 h-4" /> Show
            </Button>
            <Button
              variant={!isWebcamVisible ? 'secondary' : 'ghost'}
              onClick={() => setWebcamVisibility(false)}
              className="h-auto py-2 flex items-center gap-2"
            >
              <EyeOff className="w-4 h-4" /> Hide
            </Button>
          </div>
        </ControlGroup>

        <ControlGroup
          label="Position"
          icon={<CornerUpLeft className="w-4 h-4 text-primary" />}
          description="Place the webcam in a corner"
        >
          <div className="grid grid-cols-2 gap-2">
            {positions.map(p => (
              <Button
                key={p.pos}
                variant={webcamPosition.pos === p.pos ? 'secondary' : 'ghost'}
                onClick={() => setWebcamPosition({ pos: p.pos })}
                className="h-12 flex flex-col items-center justify-center gap-1"
              >
                {p.icon}
                <span className="text-xs">{p.label}</span>
              </Button>
            ))}
          </div>
        </ControlGroup>

        <ControlGroup
          label="Appearance"
          icon={<Image className="w-4 h-4 text-primary" />}
          description="Adjust size and shadow"
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor" className="text-primary">
                <path d="M160-80q-33 0-56.5-23.5T80-160v-480q0-33 23.5-56.5T160-720h80v-80q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240h-80v80q0 33-23.5 56.5T640-80H160Zm160-240h480v-480H320v480Z" />
              </svg>
              <span>Shadow</span>
            </div>

            {/* Grid layout cho Shadow controls */}
            <div className="grid grid-cols-1 gap-4">
              {/* Shadow Size */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Size</span>
                  <span className="text-xs text-muted-foreground font-medium">{webcamStyles.shadow}px</span>
                </div>
                <Slider
                  min={0} max={40} step={1}
                  value={webcamStyles.shadow}
                  onChange={(value) => updateWebcamStyle({ shadow: value })}
                />
              </div>

              {/* Shadow Color & Opacity trong grid 2 cột */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Color</span>
                    <input
                      type="color"
                      value={webcamStyles.shadowColor.substring(0, 7)}
                      onChange={(e) =>
                        updateWebcamStyle({
                          shadowColor: e.target.value + webcamStyles.shadowColor.substring(7),
                        })
                      }
                      className="w-6 h-6 rounded border border-border cursor-pointer transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Opacity</span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {Math.round((parseFloat(webcamStyles.shadowColor.split(',')[3] || '0.4') * 100))}%
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={parseFloat(webcamStyles.shadowColor.split(',')[3] || '0.4')}
                    onChange={(value) => {
                      const parts = webcamStyles.shadowColor.match(
                        /^rgba?\((\d+),\s*(\d+),\s*(\d+)(,\s*\d*\.?\d+)?\)$/
                      );
                      if (parts) {
                        const newColor = `rgba(${parts[1]}, ${parts[2]}, ${parts[3]}, ${value})`;
                        updateWebcamStyle({ shadowColor: newColor });
                      } else {
                        updateWebcamStyle({ shadowColor: `rgba(0, 0, 0, ${value})` });
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </ControlGroup>
      </div>
    </div>
  );
}