// src/components/editor/sidepanel/CameraSettings.tsx
import { useEditorStore } from '../../../store/editorStore';
import { ControlGroup } from './ControlGroup';
import { CornerUpLeft, CornerUpRight, CornerDownLeft, CornerDownRight, Video, Eye, EyeOff, Image } from 'lucide-react';
import { Button } from '../../ui/button';
import Slider from '../../ui/slider';
import { useShallow } from 'zustand/react/shallow';

export function CameraSettings() {
  // MODIFIED: Lấy thêm state và action cho webcam styles
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
    // MODIFIED: Cấu trúc lại toàn bộ component với header và content đẹp hơn
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
          <div className="space-y-6">
            <div>
              <label className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-sidebar-foreground">Size</span>
                <span className="text-sm font-mono text-primary font-semibold bg-primary/10 px-2 py-1 rounded">
                  {webcamStyles.size}%
                </span>
              </label>
              <Slider
                min={5} max={40} step={1}
                value={webcamStyles.size}
                onChange={(value) => updateWebcamStyle({ size: value })}
              />
            </div>
            <div>
              <label className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-sidebar-foreground">Shadow</span>
                <span className="text-sm font-mono text-primary font-semibold bg-primary/10 px-2 py-1 rounded">
                  {webcamStyles.shadow}
                </span>
              </label>
              <Slider
                min={0} max={40} step={1}
                value={webcamStyles.shadow}
                onChange={(value) => updateWebcamStyle({ shadow: value })}
              />
            </div>
          </div>
        </ControlGroup>
      </div>
    </div>
  );
}