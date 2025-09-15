// src/components/editor/RegionSettingsPanel.tsx
import { useEditorStore, TimelineRegion } from '../../store/editorStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Trash2, Camera, Scissors } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import Slider from '../ui/slider';

interface RegionSettingsPanelProps {
  region: TimelineRegion;
}

export function RegionSettingsPanel({ region }: RegionSettingsPanelProps) {
  const { updateRegion, deleteRegion, setSelectedRegionId } = useEditorStore();

  const handleValueChange = (name: string, value: string | number) => {
    const finalValue = typeof value === 'string' ? parseFloat(value) : value;
    updateRegion(region.id, { [name]: finalValue });
  };
  
  const handleDelete = () => {
    deleteRegion(region.id);
    setSelectedRegionId(null);
  }

  const RegionIcon = region.type === 'zoom' ? Camera : Scissors;
  const regionColor = region.type === 'zoom' ? 'text-primary' : 'text-destructive';
  const regionBg = region.type === 'zoom' ? 'bg-primary/10' : 'bg-destructive/10';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", regionBg)}>
              <RegionIcon className={cn("w-5 h-5", regionColor)} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-sidebar-foreground capitalize">
                {region.type} Region
              </h2>
              <p className="text-sm text-muted-foreground">
                {region.type === 'zoom' ? 'Zoom and pan controls' : 'Cut segment settings'}
              </p>
            </div>
          </div>
          <Button 
            variant="destructive" 
            size="icon" 
            onClick={handleDelete}
            className="w-9 h-9 bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground transition-all duration-200"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Timing Controls */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-sidebar-foreground uppercase tracking-wide">Timing</h3>
          
          <div className="space-y-4">
            <Input
              type="number"
              label="Start Time"
              value={region.startTime.toFixed(2)}
              onChange={(e) => handleValueChange('startTime', e.target.value)}
              step="0.01"
              min="0"
              suffix="s"
            />
            
            <Input
              type="number"
              label="Duration"
              value={region.duration.toFixed(2)}
              onChange={(e) => handleValueChange('duration', e.target.value)}
              step="0.01"
              min="0.1"
              suffix="s"
            />
          </div>
        </div>

        {/* Zoom-specific Controls */}
        {region.type === 'zoom' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-sidebar-foreground uppercase tracking-wide">Zoom Settings</h3>
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-sidebar-foreground">Zoom Level</label>
                <span className="text-sm font-mono text-primary font-semibold bg-primary/10 px-2 py-1 rounded">
                  {region.zoomLevel.toFixed(1)}x
                </span>
              </div>
              <Slider
                min={1}
                max={5}
                step={0.1}
                value={region.zoomLevel}
                onChange={(value) => handleValueChange('zoomLevel', value)}
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary slider"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1x</span>
                <span>5x</span>
              </div>
            </div>
            
            <Select 
              value={region.easing} 
              onValueChange={(value) => handleValueChange('easing', value)}
            >
              <SelectTrigger label="Animation">
                <SelectValue placeholder="Select animation type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="ease-in-out">Ease In/Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Cut Region Info */}
        {region.type === 'cut' && (
          <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Scissors className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Cut Segment</p>
                <p className="text-xs text-muted-foreground">This portion will be removed from the final video</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}