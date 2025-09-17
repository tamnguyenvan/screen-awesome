// src/hooks/useKeyboardShortcuts.ts
import { useEffect, useCallback } from 'react';

// Key format: 'key' or 'modifier+key' e.g., 'Delete', 'ctrl+z'
type ShortcutMap = { [key: string]: (event: KeyboardEvent) => void };

export function useKeyboardShortcuts(shortcuts: ShortcutMap, deps: React.DependencyList = []) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const key = event.key.toLowerCase();
    const platformModifier = event.metaKey || event.ctrlKey; // metaKey for Cmd on Mac, ctrlKey for Ctrl

    let shortcutKey: string | null = null;
    
    if (platformModifier && key !== 'control' && key !== 'meta') {
      shortcutKey = `ctrl+${key}`; // Normalize to 'ctrl' for simplicity
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      shortcutKey = key;
    }

    if (shortcutKey && shortcuts[shortcutKey]) {
      event.preventDefault();
      shortcuts[shortcutKey](event);
    }
  }, [shortcuts, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}