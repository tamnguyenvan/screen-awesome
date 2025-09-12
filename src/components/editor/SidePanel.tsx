// src/components/editor/SidePanel.tsx
import { useEditorStore } from '../../store/editorStore';

export function SidePanel() {
  const { frameStyles, updateFrameStyle } = useEditorStore();

  const handleStyleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    updateFrameStyle({
      [name]: type === 'number' ? parseFloat(value) : value,
    });
  };

  return (
    <div className="p-4 space-y-6 text-sm text-gray-700 dark:text-gray-300">
      <h2 className="text-xl font-bold border-b pb-2 mb-4 dark:text-white">Frame Customization</h2>

      {/* Background */}
      <ControlGroup label="Background">
        <input
          type="text"
          name="background"
          value={frameStyles.background}
          onChange={handleStyleChange}
          className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-700 dark:border-gray-600"
          placeholder="e.g., #ffffff or linear-gradient(...)"
        />
      </ControlGroup>

      {/* Padding */}
      <ControlGroup label={`Padding: ${frameStyles.padding}px`}>
        <input
          type="range"
          name="padding"
          min="0"
          max="200"
          value={frameStyles.padding}
          onChange={handleStyleChange}
          className="w-full"
        />
      </ControlGroup>

      {/* Border Radius */}
      <ControlGroup label={`Border Radius: ${frameStyles.borderRadius}px`}>
        <input
          type="range"
          name="borderRadius"
          min="0"
          max="100"
          value={frameStyles.borderRadius}
          onChange={handleStyleChange}
          className="w-full"
        />
      </ControlGroup>

       {/* Shadow */}
      <ControlGroup label={`Shadow: ${frameStyles.shadow}`}>
        <input
          type="range"
          name="shadow"
          min="0"
          max="10"
          value={frameStyles.shadow}
          onChange={handleStyleChange}
          className="w-full"
        />
      </ControlGroup>

      {/* Border */}
      <ControlGroup label="Border">
         <div className="flex items-center gap-2">
            <input
                type="number"
                name="borderWidth"
                min="0"
                max="20"
                value={frameStyles.borderWidth}
                onChange={handleStyleChange}
                className="w-20 p-2 border rounded bg-gray-100 dark:bg-gray-700 dark:border-gray-600"
            />
            <input
                type="color"
                name="borderColor"
                value={frameStyles.borderColor}
                onChange={handleStyleChange}
                className="w-10 h-10 p-1 border rounded bg-gray-100 dark:bg-gray-700 dark:border-gray-600"
            />
         </div>
      </ControlGroup>

    </div>
  );
}

const ControlGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div>
        <label className="block font-medium mb-2">{label}</label>
        {children}
    </div>
)