import React, { useMemo } from 'react';
import { Plus, LayoutGrid } from 'lucide-react';
import { useNotesContext } from '../context/NotesContext';
import { NoteCard } from '../components/notes/NoteCard';

const GRID_COLS = 3;
const GRID_GAP = 16;
const GRID_TOP = 20;
const NOTE_WIDTH = 280;

function calcGridPositions(count: number): Array<{ x: number; y: number }> {
  return Array.from({ length: count }, (_, i) => ({
    x: (i % GRID_COLS) * (NOTE_WIDTH + GRID_GAP),
    y: Math.floor(i / GRID_COLS) * (220 + GRID_GAP) + GRID_TOP,
  }));
}

const Notes: React.FC = () => {
  const { notes, loading, createNote, updateNote, deleteNote, bringToFront } = useNotesContext();

  const token = localStorage.getItem('discord_token');

  const gridPositions = useMemo(() => {
    const gridNotes = notes.filter(n => n.pos_x === null && n.pos_y === null);
    return calcGridPositions(gridNotes.length);
  }, [notes]);

  const handleOrganize = () => {
    notes
      .filter(n => !n.is_pinned)
      .forEach(n => updateNote({ id: n.id, pos_x: null, pos_y: null }));
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400 text-lg">Faça login com Discord para usar as notas.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  let gridIndex = 0;

  return (
    <div className="relative" style={{ minHeight: '80vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Notas</h1>
          <p className="text-gray-400 text-sm mt-1">{notes.length} nota{notes.length !== 1 ? 's' : ''}</p>
        </div>
        {notes.length > 0 && (
          <button
            onClick={handleOrganize}
            className="flex items-center gap-2 px-4 py-2 glass-panel text-sm text-gray-300 hover:text-white transition-colors"
          >
            <LayoutGrid size={16} />
            Organizar
          </button>
        )}
      </div>

      <div className="relative" style={{ minHeight: '70vh' }}>
        {notes.map(note => {
          const gridPos = (note.pos_x === null && note.pos_y === null)
            ? gridPositions[gridIndex++]
            : undefined;

          return (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={updateNote}
              onDelete={deleteNote}
              onBringToFront={bringToFront}
              gridPosition={gridPos}
            />
          );
        })}

        {notes.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <p className="text-gray-500 text-lg mb-2">Nenhuma nota ainda.</p>
            <p className="text-gray-600 text-sm">Clique no + para criar sua primeira nota.</p>
          </div>
        )}
      </div>

      <button
        onClick={createNote}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:scale-110 active:scale-95 transition-transform flex items-center justify-center z-50"
        title="Nova nota"
      >
        <Plus size={24} />
      </button>
    </div>
  );
};

export default Notes;
