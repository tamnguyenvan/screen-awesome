import React, { useState, useRef, useCallback } from 'react';

export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

const Slider: React.FC<SliderProps> = ({
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue = 50,
  onChange,
  disabled = false,
  label,
  className = ''
}) => {
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const currentValue = value ?? internalValue;
  const percentage = ((currentValue - min) / (max - min)) * 100;

  const handleChange = useCallback(
    (newValue: number) => {
      const clampedValue = Math.min(Math.max(newValue, min), max);
      const steppedValue = Math.round(clampedValue / step) * step;

      setInternalValue(steppedValue);
      onChange?.(steppedValue);
    },
    [min, max, step, onChange]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      setIsDragging(true);

      const updateValue = (clientX: number) => {
        if (!sliderRef.current) return;

        const rect = sliderRef.current.getBoundingClientRect();
        const percentage = Math.min(
          Math.max((clientX - rect.left) / rect.width, 0),
          1
        );
        const newValue = min + percentage * (max - min);
        handleChange(newValue);
      };

      updateValue(e.clientX);

      const handleMouseMove = (e: MouseEvent) => updateValue(e.clientX);
      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [disabled, min, max, handleChange]
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <div className="relative">
        <div
          ref={sliderRef}
          className={`relative h-1 bg-gray-200 dark:bg-gray-400 rounded-full cursor-pointer ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onMouseDown={handleMouseDown}
        >
          {/* Track Fill */}
          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-150"
            style={{ width: `${percentage}%` }}
          />
          {/* Handle */}
          <div
            className={`absolute top-1/2 w-5 h-5 bg-white border-2 border-primary rounded-full transform -translate-y-1/2 -translate-x-1/2 transition-all duration-200 ease-out shadow-md
              ${isDragging ? 'scale-125 shadow-xl ring-4 ring-primary/40' : 'hover:scale-110 hover:shadow-lg'}
              ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-grab active:cursor-grabbing'}
            `}
            style={{ left: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default Slider;
