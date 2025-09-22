import { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { PresetPreview } from './PresetPreview';
import { cn } from '../../lib/utils';
import { Plus, Trash2, Check, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';


interface PresetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PresetModal({ isOpen, onClose }: PresetModalProps) {
  const { presets, activePresetId, applyPreset, saveCurrentStyleAsPreset, deletePreset } = useEditorStore(
    useShallow(state => ({
      presets: state.presets,
      activePresetId: state.activePresetId,
      applyPreset: state.applyPreset,
      saveCurrentStyleAsPreset: state.saveCurrentStyleAsPreset,
      deletePreset: state.deletePreset,
    }))
  );
  
  // Internal state of the modal to manage the currently selected preset for preview
  const [previewId, setPreviewId] = useState<string | null>(activePresetId);
  const [newPresetName, setNewPresetName] = useState('');

  // Reset previewId when modal is opened or active preset changes
  useEffect(() => {
    if (isOpen) {
      setPreviewId(activePresetId);
    }
  }, [isOpen, activePresetId]);
  
  // Find the default preset
  const defaultPreset = Object.values(presets).find(p => p.isDefault);
  
  // When active ID becomes null, set preview to default
  useEffect(() => {
    if (isOpen && !activePresetId && defaultPreset) {
      setPreviewId(defaultPreset.id);
    }
  }, [isOpen, activePresetId, defaultPreset]);

  if (!isOpen) return null;

  const presetList = Object.values(presets);
  const previewPreset = previewId ? presets[previewId] : (defaultPreset || null);

  const handleSaveNew = () => {
    if (newPresetName.trim()) {
      saveCurrentStyleAsPreset(newPresetName.trim());
      setNewPresetName('');
    }
  };
  
  const handleSelect = () => {
    if (previewId) {
      applyPreset(previewId);
      onClose();
    }
  };
  
  const handleDelete = (idToDelete: string) => {
    deletePreset(idToDelete);
    // If the deleted preset was being previewed, reset preview to default
    if (previewId === idToDelete) {
      setPreviewId(defaultPreset?.id || null);
    }
  };

  return (
    <div className="modal-backdrop z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="card-clean w-full max-w-4xl h-[80vh] max-h-[700px] flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex-shrink-0">
          <h2 className="text-xl font-bold text-foreground">Manage Presets</h2>
          <p className="text-sm text-muted-foreground">Select, create, or delete your frame style presets.</p>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Left Column: Preset List */}
          <div className="w-1/3 border-r border-border p-4 flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {presetList.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPreviewId(p.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors",
                    previewId === p.id ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent/50'
                  )}
                >
                  <span className="font-medium flex items-center gap-2">
                    {p.name}
                    {p.isDefault && <Lock className="w-3 h-3 text-muted-foreground" />}
                  </span>
                  {activePresetId === p.id && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))}
            </div>
            <div className="pt-4 border-t border-border mt-2">
              <div className="flex items-center gap-2">
                <Input
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="New preset name..."
                  className="h-9"
                />
                <Button size="sm" onClick={handleSaveNew} disabled={!newPresetName.trim()}>
                  <Plus className="w-4 h-4 mr-1"/> Save
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Preview */}
          <div className="w-2/3 p-6 bg-muted/30 flex flex-col items-center justify-center">
            {previewPreset ? (
              <div className="w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg text-foreground font-semibold flex items-center gap-2">
                    {previewPreset.name}
                    {previewPreset.isDefault && <Lock className="w-4 h-4 text-muted-foreground" />}
                  </h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* Wrapper div is necessary for tooltip on disabled button */}
                        <div>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => handleDelete(previewPreset.id)}
                            disabled={previewPreset.isDefault}
                          >
                            <Trash2 className="w-4 h-4 mr-2"/> Delete
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {previewPreset.isDefault && (
                        <TooltipContent>
                          <p>The default preset cannot be deleted.</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <PresetPreview 
                  styles={previewPreset.styles}
                  aspectRatio={previewPreset.aspectRatio}
                />
              </div>
            ) : (
              <p className="text-muted-foreground">Select a preset to preview</p>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-3 flex-shrink-0">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSelect} disabled={!previewId}>Select Preset</Button>
        </div>
      </div>
    </div>
  );
}