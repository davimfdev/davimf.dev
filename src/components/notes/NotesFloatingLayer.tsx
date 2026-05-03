import React from 'react';
import { useNotesContext } from '../../context/NotesContext';
import { NoteCard } from './NoteCard';

export const NotesFloatingLayer: React.FC = () => {
  const { notes, updateNote, deleteNote, bringToFront } = useNotesContext();

  const pinnedNotes = notes.filter(n => n.is_pinned);

  if (pinnedNotes.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[200]">
      {pinnedNotes.map(note => (
        <div key={note.id} className="pointer-events-auto">
          <NoteCard
            note={note}
            onUpdate={updateNote}
            onDelete={deleteNote}
            onBringToFront={bringToFront}
            isFloating
          />
        </div>
      ))}
    </div>
  );
};
