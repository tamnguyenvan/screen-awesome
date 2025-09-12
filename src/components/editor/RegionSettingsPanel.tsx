// src/components/editor/RegionSettingsPanel.tsx
import React from 'react';
import { useEditorStore, TimelineRegion } from '../../store/editorStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Trash2 } from 'lucide-react';

interface RegionSettingsPanelProps {
  region: TimelineRegion;
}

export function RegionSettingsPanel({ region }: RegionSettingsPanelProps) {
  const { updateRegion, deleteRegion, setSelectedRegionId } = useEditorStore();

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? parseFloat(value) : value;
    updateRegion(region.id, { [name]: finalValue });
  };
  
  const handleDelete = () => {
    deleteRegion(region.id);
    setSelectedRegionId(null);
  }

  return (
    <div className="p-4 space-y-6 text-sm text-gray-700 dark:text-gray-300">
      <div className="flex items-center justify-between">
        <h2 className={cn("text-xl font-bold border-b pb-2", "dark:text-white capitalize")}>
          {region.type} Region
        </h2>
        <Button variant="destructive" size="icon" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs mb-1">Start Time (s)</label>
          <input
            type="number"
            name="startTime"
            value={region.startTime.toFixed(2)}
            onChange={handleValueChange}
            className="w-full p-2 bg-gray-100 dark:bg-gray-700 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Duration (s)</label>
          <input
            type="number"
            name="duration"
            value={region.duration.toFixed(2)}
            onChange={handleValueChange}
            className="w-full p-2 bg-gray-100 dark:bg-gray-700 border rounded-md"
          />
        </div>

        {region.type === 'zoom' && (
          <>
            <div>
              <label className="block text-xs mb-1">Zoom Level: {region.zoomLevel}x</label>
              <input
                type="range"
                name="zoomLevel"
                min="1"
                max="5"
                step="0.1"
                value={region.zoomLevel}
                onChange={handleValueChange}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Easing</label>
              <select name="easing" value={region.easing} onChange={handleValueChange} className="w-full p-2 bg-gray-100 dark:bg-gray-700 border rounded-md">
                <option value="linear">Linear</option>
                <option value="ease-in-out">Ease In/Out</option>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}