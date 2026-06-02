import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className = '' }: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 gap-4 text-center ${className}`}>
      <div className="w-12 h-12 bg-error-container rounded-full flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-error" />
      </div>
      <div>
        <p className="font-semibold text-on-surface">Terjadi Kesalahan</p>
        <p className="text-sm text-on-surface-variant mt-1">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2 mt-1">
          <RefreshCw className="w-4 h-4" />
          Muat Ulang
        </Button>
      )}
    </div>
  );
}
