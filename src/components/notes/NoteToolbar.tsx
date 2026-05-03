import React, { useState } from 'react';
import { Pin, PinOff, Maximize2, Minus, Trash2, Palette } from 'lucide-react';

const PRESET_COLORS = [
  '#6366f1',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#6b7280',
];

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
        className="p-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
      >
        {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
      </button>

      {!isMinimized && (
        <button
          onClick={onToggleMaximize}
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
          className="p-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
        >
          <Maximize2 size={13} />
        </button>
      )}

      <button
        onClick={onToggleMinimize}
        title={isMinimized ? 'Expandir' : 'Minimizar'}
        className="p-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
      >
        <Minus size={13} />
      </button>

      <button
        onClick={() => setShowColorPicker(v => !v)}
        title="Cor"
        className="p-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
      >
        <Palette size={13} />
      </button>

      <button
        onClick={onDeleteRequest}
        title="Deletar"
        className="p-1 rounded hover:bg-red-500/20 transition-colors text-gray-400 hover:text-red-400"
      >
        <Trash2 size={13} />
      </button>

      {showColorPicker && (
        <div
          className="absolute right-0 top-7 z-50 glass-panel p-3 w-52 shadow-xl"
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="grid grid-cols-4 gap-2 mb-3">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => { onColorChange(c); setShowColorPicker(false); }}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: color === c ? 'white' : 'transparent' }}
              />
            ))}
          </div>
          <input
            type="text"
            value={color}
            onChange={e => onColorChange(e.target.value)}
            placeholder="#rrggbb"
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 mb-2"
          />
          <label className="text-xs text-gray-400 block mb-1">Opacidade: {Math.round(opacity * 100)}%</label>
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
