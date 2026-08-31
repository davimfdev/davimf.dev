import React, { useState } from 'react';
import { Pin, PinOff, Maximize2, Minus, Trash2, Palette } from 'lucide-react';
import { DATA_PALETTE_NOTE_HIGHLIGHT } from '../../lib/palettes/dataPalettes';

interface NoteToolbarProps {
  color: string;
  opacity: number;
  isPinned: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  onColorChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
  onTogglePin: () => void;
  onToggleMinimize: () => void;
  onToggleMaximize: () => void;
  onDeleteRequest: () => void;
}

export const NoteToolbar: React.FC<NoteToolbarProps> = ({
  color, opacity, isPinned, isMinimized, isMaximized,
  onColorChange, onOpacityChange,
  onTogglePin, onToggleMinimize, onToggleMaximize, onDeleteRequest,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div className="flex items-center gap-1 relative">
      <button
        onClick={onTogglePin}
        title={isPinned ? 'Desafixar' : 'Fixar'}
        className="p-1 rounded hover:bg-surface-2 transition-colors text-fg-muted hover:text-fg"
      >
        {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
      </button>

      {!isMinimized && (
        <button
          onClick={onToggleMaximize}
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
          className="p-1 rounded hover:bg-surface-2 transition-colors text-fg-muted hover:text-fg"
        >
          <Maximize2 size={13} />
        </button>
      )}

      <button
        onClick={onToggleMinimize}
        title={isMinimized ? 'Expandir' : 'Minimizar'}
        className="p-1 rounded hover:bg-surface-2 transition-colors text-fg-muted hover:text-fg"
      >
        <Minus size={13} />
      </button>

      <button
        onClick={() => setShowColorPicker(v => !v)}
        title="Cor"
        className="p-1 rounded hover:bg-surface-2 transition-colors text-fg-muted hover:text-fg"
      >
        <Palette size={13} />
      </button>

      <button
        onClick={onDeleteRequest}
        title="Deletar"
        className="p-1 rounded hover:bg-red-500/20 transition-colors text-fg-muted hover:text-red-400"
      >
        <Trash2 size={13} />
      </button>

      {showColorPicker && (
        <div
          className="absolute right-0 top-7 z-50 glass-panel p-3 w-52 shadow-xl"
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="grid grid-cols-4 gap-2 mb-3">
            {DATA_PALETTE_NOTE_HIGHLIGHT.map(c => (
              <button
                key={c}
                onClick={() => { onColorChange(c); setShowColorPicker(false); }}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: color === c ? 'rgb(var(--fg) / 1)' : 'transparent' }}
              />
            ))}
          </div>
          <input
            type="text"
            value={color}
            onChange={e => onColorChange(e.target.value)}
            placeholder="#rrggbb"
            className="w-full bg-surface-1 border border-line rounded px-2 py-1 text-xs text-fg-muted mb-2"
          />
          <label className="text-xs text-fg-muted block mb-1">Opacidade: {Math.round(opacity * 100)}%</label>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={opacity}
            onChange={e => onOpacityChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};
