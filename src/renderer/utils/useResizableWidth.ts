import { useCallback, useEffect, useRef, useState } from 'react';

interface UseResizableWidthOptions {
  defaultWidth: number;
  min?: number;
  /** Left margin kept clear of the resized panel, in px. */
  edgeMargin?: number;
  /** When set, the width is persisted to localStorage and restored on mount. */
  storageKey?: string;
}

/**
 * Drag-to-resize width for a right-anchored panel (e.g. a MUI Drawer).
 * Width grows as the pointer moves left, matching `anchor="right"`.
 */
export function useResizableWidth({
  defaultWidth,
  min = 360,
  edgeMargin = 100,
  storageKey,
}: UseResizableWidthOptions) {
  const [width, setWidth] = useState(() => {
    if (storageKey) {
      const saved = Number(localStorage.getItem(storageKey));
      if (saved) return Math.max(min, saved);
    }
    return defaultWidth;
  });

  const widthRef = useRef(width);
  const draggingRef = useRef(false);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const max = window.innerWidth - edgeMargin;
      const next = Math.min(max, Math.max(min, window.innerWidth - e.clientX));
      widthRef.current = next;
      setWidth(next);
    };
    const handleMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (storageKey) localStorage.setItem(storageKey, String(widthRef.current));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [min, edgeMargin, storageKey]);

  return { width, onResizeStart };
}
