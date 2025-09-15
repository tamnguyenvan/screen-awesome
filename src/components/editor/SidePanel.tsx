// src/components/editor/SidePanel.tsx
import { useEditorStore } from '../../store/editorStore';
import { RegionSettingsPanel } from './RegionSettingsPanel';
import { Palette } from 'lucide-react';
import { BackgroundSettings } from './sidepanel/BackgroundSettings';
import { FrameEffectsSettings } from './sidepanel/FrameEffectsSettings';

function FrameSettingsPanel() {
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
          <BackgroundSettings />
          <FrameEffectsSettings />
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