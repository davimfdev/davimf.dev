import { useState, useEffect, useCallback, useRef } from 'react';

export interface Note {
  id: number;
  user_id: string;
  title: string;
  content: string;
  color: string;
  opacity: number;
  pos_x: number | null;
  pos_y: number | null;
  width: number;
  height: number;
  z_index: number;
  is_minimized: boolean;
  is_pinned: boolean;
  is_maximized: boolean;
  created_at: string;
  updated_at: string;
}

export type NoteUpdate = Partial<Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>> & { id: number };

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const token = localStorage.getItem('discord_token');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const fetchNotes = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch('/api/notes', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setNotes(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const createNote = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const note: Note = await res.json();
        setNotes(prev => [note, ...prev]);
        return note;
      }
    } catch (err) { console.error(err); }
  }, [token]);

  const updateNote = useCallback((patch: NoteUpdate, debounceMs = 0) => {
    setNotes(prev => prev.map(n => n.id === patch.id ? { ...n, ...patch } : n));

    if (debounceMs > 0) {
      clearTimeout(debounceTimers.current[patch.id]);
      debounceTimers.current[patch.id] = setTimeout(async () => {
        try {
          await fetch('/api/notes', {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify(patch),
          });
        } catch (err) { console.error(err); }
      }, debounceMs);
    } else {
      fetch('/api/notes', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(patch),
      }).catch(console.error);
    }
  }, [token]);

  const deleteNote = useCallback(async (id: number) => {
    try {
      await fetch('/api/notes', {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ id }),
      });
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) { console.error(err); }
  }, [token]);

  const bringToFront = useCallback((id: number) => {
    setNotes(prev => {
      const maxZ = Math.max(...prev.map(n => n.z_index), 0);
      const newZ = maxZ + 1;
      const updated = prev.map(n => n.id === id ? { ...n, z_index: newZ } : n);
      clearTimeout(debounceTimers.current[id]);
      debounceTimers.current[id] = setTimeout(() => {
        fetch('/api/notes', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('discord_token')}`,
          },
          body: JSON.stringify({ id, z_index: newZ }),
        }).catch(console.error);
      }, 300);
      return updated;
    });
  }, []);

  return { notes, loading, createNote, updateNote, deleteNote, bringToFront, fetchNotes };
}
