import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Trash2, Edit, Plus, Calendar as CalendarIcon, Repeat, Clock, Check, AlertCircle, Loader2 } from 'lucide-react';

// --- Types ---
type Priority = 'Low' | 'Medium' | 'High';
type Recurrence = 'None' | 'Daily' | 'Weekly' | 'Monthly';

interface Task {
  id: number;
  text: string;
  completed: boolean;
  due_date?: string;
  priority: Priority;
  recurrence: Recurrence;
  is_all_day: boolean;
  due_time?: string;
}

// --- Componente do Modal de Confirmação (Estilo Mica) ---
const ConfirmModal: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-[100] p-4 animate-fade-in">
        <div className="glass-panel p-8 w-full max-w-sm border border-white/20 shadow-2xl animate-slide-up text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h3 className="text-2xl font-bold text-fg mb-2">{title}</h3>
          <p className="text-fg-muted mb-8 leading-relaxed">{message}</p>
          <div className="flex flex-col gap-3">
            <button onClick={onConfirm} className="w-full py-3 bg-red-600 hover:bg-red-500 text-fg font-bold rounded-xl transition-all shadow-lg shadow-red-600/20">
              Confirmar Exclusão
            </button>
            <button onClick={onCancel} className="w-full py-3 bg-white/5 hover:bg-white/10 text-fg-muted font-medium rounded-xl transition-all">
              Cancelar
            </button>
          </div>
        </div>
      </div>
  );
};

// --- Componente Principal ---
const TodoList: React.FC = () => {
  const { translations, language } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Estado para o Modal Customizado
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, taskId: 0 });

  const token = localStorage.getItem('discord_token');
  const taskInputRef = useRef<HTMLInputElement>(null);

  const fetchTasks = useCallback(async () => {
    if (!token) { setTasksLoading(false); return; }
    try {
      const response = await fetch('/api/tasks', { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (err) { console.error(err); } finally { setTasksLoading(false); }
  }, [token]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleUpsertTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim() || !token) return;

    const taskData = {
      id: editingTask?.id,
      text: newTaskText,
      due_date: dueDate || null,
      priority,
      recurrence: 'None',
      is_all_day: true
    };

    try {
      await fetch('/api/tasks', {
        method: editingTask ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(taskData),
      });
      setNewTaskText('');
      setEditingTask(null);
      fetchTasks();
    } catch (err) { console.error(err); }
  };

  const toggleTaskCompletion = async (task: Task) => {
    if (!token) return;
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: task.id, completed: !task.completed }),
      });
      fetchTasks();
    } catch (err) { console.error(err); }
  };

  // --- FUNÇÃO DE DELETAR COM O NOVO MODAL ---
  const triggerDeleteTask = (id: number) => {
    setConfirmModal({ isOpen: true, taskId: id });
  };

  const confirmDelete = async () => {
    if (!token || !confirmModal.taskId) return;
    try {
      await fetch('/api/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: confirmModal.taskId }),
      });
      setTasks(tasks.filter(t => t.id !== confirmModal.taskId));
      setConfirmModal({ isOpen: false, taskId: 0 });
    } catch (err) { console.error(err); }
  };

  if (!token) return <div className="text-fg p-20 text-center">Logue com o Discord.</div>;
  if (tasksLoading) return <div className="text-center p-20"><Loader2 className="animate-spin text-accent mx-auto" /></div>;

  return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in relative z-10">

        {/* MODAL CUSTOMIZADO INTEGRADO */}
        <ConfirmModal
            isOpen={confirmModal.isOpen}
            title="Excluir Tarefa?"
            message="Tem certeza que deseja remover esta tarefa da sua lista?"
            onConfirm={confirmDelete}
            onCancel={() => setConfirmModal({ isOpen: false, taskId: 0 })}
        />

        <h1 className="text-4xl font-extrabold text-gradient mb-10">To-Do List</h1>

        <div className="glass-panel p-6 mb-10 border border-white/10">
          <form onSubmit={handleUpsertTask}>
            <input
                ref={taskInputRef}
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="O que precisa ser feito?"
                className="w-full px-5 py-4 bg-surface-1/50 border border-white/10 rounded-xl mb-4 text-fg outline-none"
                required
            />
            <div className="flex flex-wrap gap-3">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-surface-1/50 border border-white/10 p-2 rounded-lg text-fg-muted" />
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="bg-surface-1/50 border border-white/10 p-2 rounded-lg text-fg-muted">
                <option value="Low">Baixa</option>
                <option value="Medium">Média</option>
                <option value="High">Alta</option>
              </select>
              <button type="submit" className="ml-auto bg-accent hover:bg-accent-soft text-ink px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all">
                <Plus size={20} /> {editingTask ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          {tasks.map(task => (
              <div key={task.id} className={`glass-panel p-4 flex items-center gap-4 group border-l-4 ${task.priority === 'High' ? 'border-red-500' : task.priority === 'Medium' ? 'border-yellow-500' : 'border-accent'} ${task.completed ? 'opacity-50' : ''}`}>
                <div onClick={() => toggleTaskCompletion(task)} className={`w-6 h-6 rounded-full border-2 cursor-pointer flex items-center justify-center ${task.completed ? 'bg-green-500 border-green-500' : 'border-line-strong'}`}>
                  {task.completed && <Check size={16} className="text-fg" />}
                </div>
                <span className={`flex-grow text-fg ${task.completed ? 'line-through text-fg-muted' : ''}`}>{task.text}</span>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => { setEditingTask(task); setNewTaskText(task.text); setDueDate(task.due_date || ''); }} className="p-2 text-fg-muted hover:text-accent"><Edit size={18} /></button>
                  {/* CHAMA O MODAL CUSTOMIZADO AQUI */}
                  <button onClick={() => triggerDeleteTask(task.id)} className="p-2 text-fg-muted hover:text-red-400"><Trash2 size={18} /></button>
                </div>
              </div>
          ))}
        </div>
      </div>
  );
};

export default TodoList;
