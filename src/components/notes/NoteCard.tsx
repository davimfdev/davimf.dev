import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Note, NoteUpdate } from '../../hooks/useNotes';
import { NoteEditor } from './NoteEditor';
import { NoteToolbar } from './NoteToolbar';

interface NoteCardProps {
  note: Note;
  onUpdate: (patch: NoteUpdate, debounceMs?: number) => void;
  onDelete: (id: number) => Promise<void>;
  onBringToFront: (id: number) => void;
  gridPosition?: { x: number; y: number };
  isFloating?: boolean;
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '99, 102, 241';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note, onUpdate, onDelete, onBringToFront, gridPosition, isFloating = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setIsCreating(false), 50);
    return () => clearTimeout(t);
  }, []);

  const posX = note.pos_x ?? gridPosition?.x ?? 0;
  const posY = note.pos_y ?? gridPosition?.y ?? 0;

  const rgb = hexToRgb(note.color);
  const bgStyle = { background: `rgba(${rgb}, ${note.opacity * 0.25})` };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, textarea, input')) return;
    e.preventDefault();
    onBringToFront(note.id);
    isDragging.current = true;

    const rect = cardRef.current!.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const newX = ev.clientX - dragOffset.current.x;
      const newY = ev.clientY - dragOffset.current.y;
      if (cardRef.current) {
        cardRef.current.style.left = `${newX}px`;
        cardRef.current.style.top = `${newY}px`;
      }
    };

    const handleMouseUp = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const newX = ev.clientX - dragOffset.current.x;
      const newY = Math.max(0, ev.clientY - dragOffset.current.y);
      onUpdate({ id: note.id, pos_x: newX, pos_y: newY }, 500);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [note.id, onBringToFront, onUpdate]);

  const handleDoubleClickHeader = useCallback(() => {
    if (note.pos_x !== null || note.pos_y !== null) {
      onUpdate({ id: note.id, pos_x: null, pos_y: null });
    }
  }, [note.id, note.pos_x, note.pos_y, onUpdate]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    await onDelete(note.id);
  }, [note.id, onDelete]);

  if (note.is_maximized && !isFloating) {
    return (
      <>
        <div className="fixed inset-0 bg-black/60 z-[9998]" onClick={() => onUpdate({ id: note.id, is_maximized: false })} />
        <div
          className="fixed inset-4 z-[9999] glass-panel flex flex-col overflow-hidden"
          style={{ ...bgStyle, borderColor: `rgba(${rgb}, 0.4)` }}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
            <span className="font-semibold text-white truncate">{note.title}</span>
            <button
              onClick={() => onUpdate({ id: note.id, is_maximized: false })}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-xs"
            >
              Restaurar
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <NoteEditor
              content={note.content}
              isEditing={isEditing}
              onStartEdit={() => setIsEditing(true)}
              onChange={v => onUpdate({ id: note.id, content: v }, 500)}
              onBlur={() => setIsEditing(false)}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      ref={cardRef}
      className={`absolute select-none transition-all duration-200 ${isCreating ? 'opacity-0 scale-90' : 'opacity-100 scale-100'} ${isDeleting ? 'opacity-0 scale-90' : ''}`}
      style={{
        left: posX,
        top: posY,
        width: note.width,
        zIndex: note.z_index,
      }}
      onMouseDown={() => onBringToFront(note.id)}
    >
      <div
        className="rounded-xl border backdrop-blur-md shadow-lg flex flex-col overflow-hidden"
        style={{ ...bgStyle, borderColor: `rgba(${rgb}, 0.35)` }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 group cursor-grab active:cursor-grabbing border-b border-white/10"
          style={{ background: `rgba(${rgb}, 0.15)` }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClickHeader}
        >
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: note.color }}
          />
          <input
            value={note.title}
            onChange={e => onUpdate({ id: note.id, title: e.target.value }, 500)}
            onMouseDown={e => e.stopPropagation()}
            className="flex-1 bg-transparent text-white text-sm font-medium outline-none truncate min-w-0"
            placeholder="Título..."
          />
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
            <NoteToolbar
              color={note.color}
              opacity={note.opacity}
              isPinned={note.is_pinned}
              isMinimized={note.is_minimized}
              isMaximized={note.is_maximized}
              onColorChange={c => onUpdate({ id: note.id, color: c }, 300)}
              onOpacityChange={o => onUpdate({ id: note.id, opacity: o }, 300)}
              onTogglePin={() => onUpdate({ id: note.id, is_pinned: !note.is_pinned })}
              onToggleMinimize={() => onUpdate({ id: note.id, is_minimized: !note.is_minimized })}
              onToggleMaximize={() => onUpdate({ id: note.id, is_maximized: !note.is_maximized })}
              onDeleteRequest={() => setShowDeleteConfirm(true)}
            />
          </div>
        </div>

        {!note.is_minimized && (
          <div
            className="p-3 overflow-auto"
            style={{ height: note.height }}
          >
            <NoteEditor
              content={note.content}
              isEditing={isEditing}
              onStartEdit={() => { setIsEditing(true); onBringToFront(note.id); }}
              onChange={v => onUpdate({ id: note.id, content: v }, 500)}
              onBlur={() => setIsEditing(false)}
            />
          </div>
        )}

        {showDeleteConfirm && (
          <div className="p-3 border-t border-white/10 bg-red-500/10 flex items-center justify-between gap-2">
            <span className="text-xs text-red-300">Tem certeza?</span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs px-2 py-1 rounded hover:bg-white/10 text-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="text-xs px-2 py-1 rounded bg-red-500/30 hover:bg-red-500/50 text-red-200 transition-colors"
              >
                Deletar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
