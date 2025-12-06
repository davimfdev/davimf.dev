import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Trash2, Edit, Plus, Calendar as CalendarIcon, Repeat, Clock, Check, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';

// --- Tipos ---
type Priority = 'Low' | 'Medium' | 'High';
type Recurrence = 'None' | 'Daily' | 'Weekly' | 'Monthly';
type CalendarView = 'days' | 'months' | 'years';

interface Task {
  id: number;
  text: string;
  completed: boolean;
  due_date?: string;
  priority: Priority;
  recurrence: Recurrence;
  is_all_day: boolean;
  due_time?: string;
  google_event_id?: string;
}

// --- Componentes ---
const TodoListSkeleton: React.FC = () => (
    <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-8 bg-gray-700 rounded-md w-1/2 mx-auto mb-8"></div>
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
            <div className="h-10 bg-gray-700 rounded-md w-full"></div>
            <div className="flex justify-between items-center mt-4">
                <div className="flex gap-4">
                    <div className="h-8 bg-gray-700 rounded-md w-24"></div>
                    <div className="h-8 bg-gray-700 rounded-md w-24"></div>
                    <div className="h-8 bg-gray-700 rounded-md w-24"></div>
                </div>
                <div className="h-10 bg-gray-700 rounded-md w-28"></div>
            </div>
        </div>
        <div>
            <div className="h-6 bg-gray-700 rounded-md w-1/3 mb-4"></div>
            <div className="h-16 bg-gray-700 rounded-md mb-2"></div>
            <div className="h-16 bg-gray-800 rounded-md mb-2"></div>
            <div className="h-6 bg-gray-700 rounded-md w-1/3 my-4"></div>
            <div className="h-16 bg-gray-700 rounded-md mb-2"></div>
        </div>
    </div>
);

const CalendarModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onDateSelect: (date: string) => void;
}> = ({ isOpen, onClose, tasks, onDateSelect }) => {
  const { translations, language } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('days');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) onClose();
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      setTimeout(() => setView('days'), 300);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
    const calendarDays = Array.from({ length: 42 }, (_, i) => {
      const day = new Date(startDate);
      day.setDate(day.getDate() + i);
      return day;
    });
    return calendarDays;
  }, [currentDate]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Set<Priority>>();
    for (const task of tasks) {
      if (task.due_date && !task.completed) {
        const dateStr = task.due_date.split('T')[0];
        if (!map.has(dateStr)) map.set(dateStr, new Set<Priority>());
        map.get(dateStr)!.add(task.priority);
      }
    }
    return map;
  }, [tasks]);

  const priorityColors: Record<Priority, string> = { High: 'bg-red-500', Medium: 'bg-yellow-500', Low: 'bg-blue-500' };

  if (!isOpen) return null;

  const handleDateClick = (date: Date) => {
    onDateSelect(date.toISOString().split('T')[0]);
    onClose();
  };

  const changeYear = (amount: number) => setCurrentDate(new Date(currentDate.setFullYear(currentDate.getFullYear() + amount)));
  const changeMonth = (amount: number) => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + amount, 1));
  const getDecadeStart = (year: number) => Math.floor(year / 10) * 10;

  const renderHeader = () => {
    const year = currentDate.getFullYear();
    const monthName = currentDate.toLocaleString(language, { month: 'long' });
    const decadeStart = getDecadeStart(year);
    return (
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => view === 'days' ? changeMonth(-1) : view === 'months' ? changeYear(-1) : changeYear(-10)} className="p-2 rounded-full hover:bg-gray-700">&lt;</button>
        <div className="flex gap-2">
          {view === 'days' && <button onClick={() => setView('months')} className="text-xl font-semibold hover:bg-gray-700 px-3 py-1 rounded-md">{monthName}</button>}
          <button onClick={() => setView('years')} className="text-xl font-semibold hover:bg-gray-700 px-3 py-1 rounded-md">
            {view === 'years' ? `${decadeStart} - ${decadeStart + 9}` : year}
          </button>
        </div>
        <button onClick={() => view === 'days' ? changeMonth(1) : view === 'months' ? changeYear(1) : changeYear(10)} className="p-2 rounded-full hover:bg-gray-700">&gt;</button>
      </div>
    );
  };

  const renderDaysView = () => (
    <div className="grid grid-cols-7 gap-1 text-center">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="font-bold text-sm text-gray-400">{d}</div>)}
      {days.map((d, i) => {
        const dateStr = d.toISOString().split('T')[0];
        const priorities = tasksByDate.get(dateStr);
        const isCurrentMonth = d.getMonth() === currentDate.getMonth();
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        return (
          <div key={i} onClick={() => handleDateClick(d)} className={`p-2 h-10 rounded-full cursor-pointer relative flex items-center justify-center ${isCurrentMonth ? 'text-white' : 'text-gray-500'} ${isToday ? 'bg-blue-600' : ''} hover:bg-gray-700`}>
            <span>{d.getDate()}</span>
            {priorities && <div className="absolute bottom-1 flex gap-0.5">{Array.from(priorities).sort().map(p => <div key={p} className={`h-1.5 w-1.5 rounded-full ${priorityColors[p]}`}></div>)}</div>}
          </div>
        );
      })}
    </div>
  );

  const renderMonthsView = () => (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 12 }).map((_, i) => <button key={i} onClick={() => { setCurrentDate(new Date(currentDate.setMonth(i))); setView('days'); }} className="p-4 rounded-md hover:bg-gray-700">{new Date(0, i).toLocaleString(language, { month: 'long' })}</button>)}
    </div>
  );

  const renderYearsView = () => {
    const decadeStart = getDecadeStart(currentDate.getFullYear());
    const years = Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i);
    return (
      <div className="grid grid-cols-4 gap-2">
        {years.map(year => <button key={year} onClick={() => { setCurrentDate(new Date(currentDate.setFullYear(year))); setView('months'); }} className={`p-3 rounded-md hover:bg-gray-700 ${year < decadeStart || year > decadeStart + 9 ? 'text-gray-500' : ''}`}>{year}</button>)}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div ref={modalRef} className="bg-gray-800 p-6 rounded-lg w-full max-w-sm shadow-lg text-white">
        {renderHeader()}
        <div>{view === 'days' ? renderDaysView() : view === 'months' ? renderMonthsView() : renderYearsView()}</div>
        <button onClick={onClose} className="mt-6 w-full bg-gray-600 hover:bg-gray-500 py-2 rounded-md">{translations.close}</button>
      </div>
    </div>
  );
};

const TodoList: React.FC = () => {
  const { translations, language } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [recurrence, setRecurrence] = useState<Recurrence>('None');
  const [isAllDay, setIsAllDay] = useState(true);
  const [dueTime, setDueTime] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token, isAuthLoading, isGoogleConnected, refreshToken } = useAuth();
  const taskInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('google_auth')) {
      window.history.replaceState({}, document.title, "/todo");
      if (params.get('google_auth') === 'success') {
        refreshToken().then(() => setNotification({ type: 'success', message: 'Google Calendar conectado com sucesso!' }));
      } else {
        setNotification({ type: 'error', message: 'Falha ao conectar com Google Calendar.' });
      }
    }
  }, [location, refreshToken]);

  const fetchTasks = useCallback(async () => {
    if (!token) {
      setTasksLoading(false);
      return;
    }
    setTasksLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tasks', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error('Failed to fetch tasks.');
      const data: Task[] = await response.json();
      setTasks(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTasksLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthLoading && token) {
      fetchTasks();
    } else if (!isAuthLoading && !token) {
      setTasksLoading(false);
    }
  }, [token, isAuthLoading, fetchTasks]);

  const handleUpsertTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim() || !token) return;
    const originalTasks = tasks;
    const taskData = { id: editingTask?.id, text: newTaskText, due_date: dueDate, priority, recurrence, is_all_day: isAllDay, due_time: isAllDay ? undefined : dueTime, google_event_id: editingTask?.google_event_id };
    
    if (editingTask) {
      setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
    }
    resetForm();

    try {
      const response = await fetch('/api/tasks', {
        method: editingTask ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(taskData),
      });
      if (!response.ok) throw new Error('Failed to save task.');
      fetchTasks(); // Refetch to get the final state from server
    } catch (err: any) {
      setError(err.message);
      setTasks(originalTasks); // Rollback on error
    }
  };

  const toggleTaskCompletion = async (task: Task) => {
    if (!token) return;
    const originalTasks = tasks;
    setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: task.id, completed: !task.completed }),
      });
      fetchTasks();
    } catch (err: any) {
      setError(err.message);
      setTasks(originalTasks);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!token) return;
    const originalTasks = tasks;
    setTasks(tasks.filter(t => t.id !== taskId));
    try {
      await fetch('/api/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: taskId }),
      });
    } catch (err: any) {
      setError(err.message);
      setTasks(originalTasks);
    }
  };

  const startEditing = (task: Task) => {
    setEditingTask(task);
    setNewTaskText(task.text);
    setDueDate(task.due_date?.split('T')[0] || '');
    setPriority(task.priority);
    setRecurrence(task.recurrence);
    setIsAllDay(task.is_all_day);
    setDueTime(task.due_time || '');
    taskInputRef.current?.focus();
  };

  const resetForm = () => {
    setEditingTask(null);
    setNewTaskText('');
    setDueDate('');
    setPriority('Medium');
    setRecurrence('None');
    setIsAllDay(true);
    setDueTime('');
  };

  const handleDateSelect = (date: string) => {
    setDueDate(date);
    taskInputRef.current?.focus();
  };

  const handleGoogleConnect = async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/google-auth', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error((await response.json()).message);
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleManualSync = async () => {
    if (!token) return;
    setIsSyncing(true);
    setNotification({ type: 'success', message: 'Sincronizando...' });
    try {
      await fetch('/api/sync-google-calendar', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      await fetchTasks();
      setNotification({ type: 'success', message: 'Sincronização concluída!' });
    } catch (err: any) {
      setNotification({ type: 'error', message: `Falha na sincronização: ${err.message}` });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const priorityClasses = { Low: 'border-blue-500', Medium: 'border-yellow-500', High: 'border-red-500' };

  const taskGroups = useMemo(() => {
    const groups = { overdue: [] as Task[], today: [] as Task[], thisWeek: [] as Task[], upcoming: [] as Task[], completed: [] as Task[] };
    const todayStr = new Date().toISOString().split('T')[0];
    const endOfWeek = new Date();
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

    tasks.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '') || (a.due_time || '').localeCompare(b.due_time || ''))
      .forEach(task => {
        if (task.completed) groups.completed.push(task);
        else if (!task.due_date) groups.upcoming.push(task);
        else if (task.due_date < todayStr) groups.overdue.push(task);
        else if (task.due_date === todayStr) groups.today.push(task);
        else if (task.due_date <= endOfWeekStr) groups.thisWeek.push(task);
        else groups.upcoming.push(task);
      });
    return groups;
  }, [tasks]);

  const renderTask = (task: Task) => (
    <div key={task.id} onClick={() => toggleTaskCompletion(task)} className={`flex items-center p-3 mb-2 rounded-md transition-colors cursor-pointer ${task.completed ? 'bg-gray-800 text-gray-500' : 'bg-gray-700'} border-l-4 ${priorityClasses[task.priority]}`}>
      <div className="mr-4"><div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${task.completed ? 'border-green-500 bg-green-500' : 'border-gray-500'}`}>{task.completed && <Check size={16} className="text-white" />}</div></div>
      <div className="flex-grow">
        <p className={task.completed ? 'line-through' : ''}>{task.text}</p>
        <div className="flex items-center text-xs text-gray-400 gap-4 mt-1">
          {task.due_date && <span className="flex items-center gap-1"><CalendarIcon size={12} /> {new Date(task.due_date).toLocaleDateString(language, { timeZone: 'UTC' })}</span>}
          {!task.is_all_day && task.due_time && <span className="flex items-center gap-1"><Clock size={12} /> {task.due_time.substring(0, 5)}</span>}
          {task.recurrence !== 'None' && <span className="flex items-center gap-1"><Repeat size={12} /> {translations[`recurrence${task.recurrence}` as keyof typeof translations]}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); startEditing(task); }} className="text-gray-400 hover:text-blue-400 p-1"><Edit size={18} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="text-gray-400 hover:text-red-400 p-1"><Trash2 size={18} /></button>
      </div>
    </div>
  );

  const renderTaskGroup = (title: string, taskList: Task[]) => (
    taskList.length > 0 && <div className="mb-6"><h2 className="text-xl font-semibold mb-3 text-gray-300">{title}</h2>{taskList.map(renderTask)}</div>
  );

  if (isAuthLoading) return <TodoListSkeleton />;
  if (!token) return <div className="text-center text-gray-400">Você precisa estar logado para ver suas tarefas.</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      {notification && <div className={`p-4 mb-4 text-white rounded-md ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{notification.message}</div>}
      <div className="flex justify-center items-center gap-4 mb-8">
        <h1 className="text-4xl font-bold text-center">{translations.todoListTitle}</h1>
        <button onClick={() => setIsCalendarOpen(true)} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600" title={translations.viewCalendar}><CalendarIcon size={24} /></button>
        {isGoogleConnected ? (
          <button onClick={handleManualSync} disabled={isSyncing} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50">
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        ) : (
          <button onClick={handleGoogleConnect} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md" title={translations.connectGoogleCalendar}>
            <img src="/google-calendar-icon.svg" alt="Google Calendar" className="w-5 h-5" />
            {translations.connectGoogleCalendar}
          </button>
        )}
      </div>
      
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <form onSubmit={handleUpsertTask}>
          <input ref={taskInputRef} type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder={translations.addOrEditTask} className="w-full px-4 py-2 bg-gray-700 rounded-md mb-4" required />
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center flex-wrap gap-4">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-gray-700 p-2 rounded-md" />
              <div className="flex items-center bg-gray-700 rounded-md">
                <button type="button" onClick={() => setIsAllDay(true)} className={`px-3 py-2 rounded-l-md text-sm ${isAllDay ? 'bg-blue-600' : 'bg-gray-700'}`}>{translations.allDay}</button>
                <button type="button" onClick={() => setIsAllDay(false)} className={`px-3 py-2 rounded-r-md text-sm ${!isAllDay ? 'bg-blue-600' : 'bg-gray-700'}`}>{translations.specificTime}</button>
              </div>
              {!isAllDay && <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="bg-gray-700 p-2 rounded-md" />}
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="bg-gray-700 p-2 rounded-md">
                <option value="Low">{translations.priorityLow}</option>
                <option value="Medium">{translations.priorityMedium}</option>
                <option value="High">{translations.priorityHigh}</option>
              </select>
              <select value={recurrence} onChange={e => setRecurrence(e.target.value as Recurrence)} className="bg-gray-700 p-2 rounded-md">
                <option value="None">{translations.recurrenceNone}</option>
                <option value="Daily">{translations.recurrenceDaily}</option>
                <option value="Weekly">{translations.recurrenceWeekly}</option>
                <option value="Monthly">{translations.recurrenceMonthly}</option>
              </select>
            </div>
            <div className="flex gap-2">
              {editingTask && <button type="button" onClick={resetForm} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md">{translations.cancel}</button>}
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center gap-2"><Plus size={18}/> {editingTask ? translations.updateTask : translations.addTodo}</button>
            </div>
          </div>
        </form>
      </div>

      {tasksLoading ? <TodoListSkeleton /> : (
        <>
          {renderTaskGroup(translations.overdue, taskGroups.overdue)}
          {renderTaskGroup(translations.today, taskGroups.today)}
          {renderTaskGroup(translations.thisWeek, taskGroups.thisWeek)}
          {renderTaskGroup(translations.upcoming, taskGroups.upcoming)}
          {renderTaskGroup(translations.completed, taskGroups.completed)}
          {tasks.length === 0 && <p className="text-center text-gray-400 py-8">{translations.noTasks}</p>}
        </>
      )}
      
      <CalendarModal isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} tasks={tasks} onDateSelect={handleDateSelect} />
    </div>
  );
};

export default TodoList;
