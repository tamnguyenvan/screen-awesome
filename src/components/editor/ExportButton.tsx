// src/components/editor/ExportButton.tsx
import { Upload } from 'lucide-react';
import { Button } from '../ui/button';

interface ExportButtonProps {
  onClick: () => void;
  isExporting: boolean;
}

export function ExportButton({ onClick, isExporting }: ExportButtonProps) {
  return (
    <Button onClick={onClick} disabled={isExporting}>
      <Upload className="w-4 h-4 mr-2" />
      Export
    </Button>
  );
}