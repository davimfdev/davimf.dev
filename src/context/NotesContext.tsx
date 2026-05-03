import React, { createContext, useContext, ReactNode } from 'react';
import { useNotes, Note, NoteUpdate } from '../hooks/useNotes';

interface NotesContextValue {
  notes: Note[];
  loading: boolean;
  createNote: () => Promise<Note | undefined>;
  updateNote: (patch: NoteUpdate, debounceMs?: number) => void;
  deleteNote: (id: number) => Promise<void>;
  bringToFront: (id: number) => void;
  fetchNotes: () => Promise<void>;
}

const NotesContext = createContext<NotesContextValue | undefined>(undefined);

export const NotesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const notesState = useNotes();
  return <NotesContext.Provider value={notesState}>{children}</NotesContext.Provider>;
};

export const useNotesContext = (): NotesContextValue => {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotesContext must be used within NotesProvider');
  return ctx;
};
