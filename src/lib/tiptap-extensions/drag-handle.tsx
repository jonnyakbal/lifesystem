'use client';

import { ReactNode, useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DragHandleProps {
  editor: any;
  className?: string;
}

export function DragHandle({ editor, className }: DragHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<any>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.DragEvent, node: any, pos: number) => {
    setIsDragging(true);
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ pos, nodeType: node.type.name }));
    
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setIsDragging(false);
    setDraggedNode(null);
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
  }, []);

  if (!editor || !editor.isEditable) return null;

  return null; // Drag handles are rendered inline in the editor
}

export function BlockDragHandle({ 
  onDragStart, 
  onDragEnd, 
  className 
}: { 
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  className?: string;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'absolute -left-6 top-0.5 z-10',
        'w-5 h-5 flex items-center justify-center',
        'rounded cursor-grab active:cursor-grabbing',
        'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50',
        'opacity-0 group-hover:opacity-100 transition-opacity',
        'select-none touch-none',
        className
      )}
      contentEditable={false}
    >
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
        <circle cx="3" cy="2" r="1.2" />
        <circle cx="7" cy="2" r="1.2" />
        <circle cx="3" cy="7" r="1.2" />
        <circle cx="7" cy="7" r="1.2" />
        <circle cx="3" cy="12" r="1.2" />
        <circle cx="7" cy="12" r="1.2" />
      </svg>
    </div>
  );
}
