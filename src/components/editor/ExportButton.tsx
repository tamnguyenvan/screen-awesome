// src/components/editor/ExportButton.tsx
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

interface ExportButtonProps {
  onClick: () => void;
  isExporting: boolean;
}

export function ExportButton({ onClick, isExporting }: ExportButtonProps) {
  return (
    <Button 
      onClick={onClick} 
      disabled={isExporting}
      className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 py-2.5 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Upload className="w-4 h-4 mr-2" />
      )}
      {isExporting ? 'Exporting...' : 'Export'}
    </Button>
  );
}