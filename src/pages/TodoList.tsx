import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Trash2, Edit, Plus, Calendar as CalendarIcon, Repeat, Clock, Check } from 'lucide-react';

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
}

// --- Componentes ---
const TodoListSkeleton: React.FC = () => (
    <div className="max-w-4xl mx-auto animate-pulse p-4">
        <div className="h-10 bg-white/10 rounded-md w-1/2 mx-auto mb-8"></div>
        <div className="glass-panel p-6 mb-8">
            <div className="h-12 bg-white/10 rounded-lg w-full mb-4"></div>
            <div className="flex justify-between items-center mt-4">
                <div className="flex gap-4">
                    <div className="h-10 bg-white/10 rounded-lg w-24"></div>
                    <div className="h-10 bg-white/10 rounded-lg w-24"></div>
                    <div className="h-10 bg-white/10 rounded-lg w-24"></div>
                </div>
                <div className="h-10 bg-white/10 rounded-lg w-32"></div>
            </div>
        </div>
        <div>
            <div className="h-6 bg-white/10 rounded-md w-1/3 mb-4"></div>
            <div className="h-20 bg-white/5 rounded-xl mb-3 border border-white/5"></div>
            <div className="h-20 bg-white/5 rounded-xl mb-3 border border-white/5"></div>
            <div className="h-6 bg-white/10 rounded-md w-1/3 my-6"></div>
            <div className="h-20 bg-white/5 rounded-xl mb-3 border border-white/5"></div>
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
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => view === 'days' ? changeMonth(-1) : view === 'months' ? changeYear(-1) : changeYear(-10)} className="p-2 rounded-full hover:bg-white/10 transition-colors">&lt;</button>
        <div className="flex gap-2">
          {view === 'days' && <button onClick={() => setView('months')} className="text-xl font-semibold hover:bg-white/10 px-3 py-1 rounded-lg transition-colors">{monthName}</button>}
          <button onClick={() => setView('years')} className="text-xl font-semibold hover:bg-white/10 px-3 py-1 rounded-lg transition-colors">
            {view === 'years' ? `${decadeStart} - ${decadeStart + 9}` : year}
          </button>
        </div>
        <button onClick={() => view === 'days' ? changeMonth(1) : view === 'months' ? changeYear(1) : changeYear(10)} className="p-2 rounded-full hover:bg-white/10 transition-colors">&gt;</button>
      </div>
    );
  };

  const renderDaysView = () => (
    <div className="grid grid-cols-7 gap-2 text-center">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="font-bold text-xs text-gray-400 mb-2">{d}</div>)}
      {days.map((d, i) => {
        const dateStr = d.toISOString().split('T')[0];
        const priorities = tasksByDate.get(dateStr);
        const isCurrentMonth = d.getMonth() === currentDate.getMonth();
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        return (
          <div key={i} onClick={() => handleDateClick(d)} className={`p-2 h-10 rounded-full cursor-pointer relative flex items-center justify-center transition-all ${isCurrentMonth ? 'text-gray-100 hover:bg-white/10' : 'text-gray-600 hover:text-gray-300'} ${isToday ? 'bg-blue-600 hover:bg-blue-500 font-bold text-white shadow-lg shadow-blue-500/30' : ''}`}>
            <span>{d.getDate()}</span>
            {priorities && <div className="absolute bottom-1 flex gap-1">{Array.from(priorities).sort().map(p => <div key={p} className={`h-1.5 w-1.5 rounded-full ${priorityColors[p]} shadow-sm`}></div>)}</div>}
          </div>
        );
      })}
    </div>
  );

  const renderMonthsView = () => (
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: 12 }).map((_, i) => <button key={i} onClick={() => { setCurrentDate(new Date(currentDate.setMonth(i))); setView('days'); }} className="p-4 rounded-xl hover:bg-white/10 transition-colors font-medium">{new Date(0, i).toLocaleString(language, { month: 'short' })}</button>)}
    </div>
  );

  const renderYearsView = () => {
    const decadeStart = getDecadeStart(currentDate.getFullYear());
    const years = Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i);
    return (
      <div className="grid grid-cols-4 gap-3">
        {years.map(year => <button key={year} onClick={() => { setCurrentDate(new Date(currentDate.setFullYear(year))); setView('months'); }} className={`p-4 rounded-xl hover:bg-white/10 transition-colors font-medium ${year < decadeStart || year > decadeStart + 9 ? 'text-gray-500' : ''}`}>{year}</button>)}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in p-4">
      <div ref={modalRef} className="glass-panel p-6 md:p-8 w-full max-w-md shadow-2xl text-gray-100 border border-white/20 animate-slide-up">
        {renderHeader()}
        <div className="min-h-[280px]">{view === 'days' ? renderDaysView() : view === 'months' ? renderMonthsView() : renderYearsView()}</div>
        <button onClick={onClose} className="mt-8 w-full btn-secondary font-semibold">{translations.close}</button>
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
  const [tasksLoading, setTasksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, isAuthLoading } = useAuth();
  const taskInputRef = useRef<HTMLInputElement>(null);

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
    const taskData = { id: editingTask?.id, text: newTaskText, due_date: dueDate, priority, recurrence, is_all_day: isAllDay, due_time: isAllDay ? undefined : dueTime };
    
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => taskInputRef.current?.focus(), 500);
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
    <div key={task.id} onClick={() => toggleTaskCompletion(task)} className={`group flex items-center p-4 mb-3 rounded-xl transition-all duration-300 cursor-pointer border border-white/5 shadow-sm hover:shadow-md ${task.completed ? 'bg-white/5 text-gray-500' : 'glass-panel'} border-l-4 ${priorityClasses[task.priority]} hover:-translate-y-0.5`}>
      <div className="mr-4">
        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.completed ? 'border-green-500 bg-green-500' : 'border-gray-500 group-hover:border-blue-400'}`}>
          {task.completed && <Check size={16} className="text-white animate-fade-in" />}
        </div>
      </div>
      <div className="flex-grow">
        <p className={`font-medium transition-all ${task.completed ? 'line-through text-gray-500' : 'text-gray-100'}`}>{task.text}</p>
        <div className="flex flex-wrap items-center text-xs text-gray-400 gap-4 mt-2">
          {task.due_date && <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md"><CalendarIcon size={12} /> {new Date(task.due_date).toLocaleDateString(language, { timeZone: 'UTC' })}</span>}
          {!task.is_all_day && task.due_time && <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md"><Clock size={12} /> {task.due_time.substring(0, 5)}</span>}
          {task.recurrence !== 'None' && <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md"><Repeat size={12} /> {translations[`recurrence${task.recurrence}` as keyof typeof translations]}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); startEditing(task); }} className="text-gray-400 hover:text-blue-400 p-2 rounded-lg hover:bg-white/10 transition-colors"><Edit size={18} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-white/10 transition-colors"><Trash2 size={18} /></button>
      </div>
    </div>
  );

  const renderTaskGroup = (title: string, taskList: Task[]) => (
    taskList.length > 0 && (
      <div className="mb-8 animate-slide-up">
        <h2 className="text-xl font-bold mb-4 text-gray-200 border-b border-white/10 pb-2">{title} <span className="text-sm font-normal text-gray-500 ml-2">({taskList.length})</span></h2>
        <div>{taskList.map(renderTask)}</div>
      </div>
    )
  );

  if (isAuthLoading) return <TodoListSkeleton />;
  if (!token) return <div className="text-center text-gray-400 py-20 text-lg glass-panel max-w-2xl mx-auto">Você precisa estar logado para ver suas tarefas.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in relative z-10">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-10">
        <h1 className="text-4xl font-extrabold text-gradient">{translations.todoListTitle}</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsCalendarOpen(true)} className="btn-secondary px-4 py-2 flex items-center gap-2 group" title={translations.viewCalendar}>
            <CalendarIcon size={20} className="group-hover:text-blue-400 transition-colors" /> 
            <span className="hidden sm:inline font-medium">Calendário</span>
          </button>
        </div>
      </div>
      
      <div className="glass-panel p-6 sm:p-8 mb-10 shadow-lg border border-white/10 animate-slide-up">
        <form onSubmit={handleUpsertTask}>
          <input 
            ref={taskInputRef} 
            type="text" 
            value={newTaskText} 
            onChange={(e) => setNewTaskText(e.target.value)} 
            placeholder={translations.addOrEditTask} 
            className="w-full px-5 py-4 bg-gray-900/50 border border-white/10 rounded-xl mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 placeholder-gray-500 text-lg transition-all" 
            required 
          />
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <input 
                type="date" 
                value={dueDate} 
                onChange={e => setDueDate(e.target.value)} 
                className="bg-gray-900/50 border border-white/10 p-2.5 rounded-lg text-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              />
              
              <div className="flex items-center bg-gray-900/50 border border-white/10 rounded-lg overflow-hidden">
                <button type="button" onClick={() => setIsAllDay(true)} className={`px-4 py-2.5 text-sm font-medium transition-colors ${isAllDay ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{translations.allDay}</button>
                <button type="button" onClick={() => setIsAllDay(false)} className={`px-4 py-2.5 text-sm font-medium transition-colors ${!isAllDay ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{translations.specificTime}</button>
              </div>
              
              {!isAllDay && (
                <input 
                  type="time" 
                  value={dueTime} 
                  onChange={e => setDueTime(e.target.value)} 
                  className="bg-gray-900/50 border border-white/10 p-2.5 rounded-lg text-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                />
              )}
              
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="bg-gray-900/50 border border-white/10 p-2.5 rounded-lg text-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer">
                <option value="Low">{translations.priorityLow}</option>
                <option value="Medium">{translations.priorityMedium}</option>
                <option value="High">{translations.priorityHigh}</option>
              </select>
              
              <select value={recurrence} onChange={e => setRecurrence(e.target.value as Recurrence)} className="bg-gray-900/50 border border-white/10 p-2.5 rounded-lg text-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer">
                <option value="None">{translations.recurrenceNone}</option>
                <option value="Daily">{translations.recurrenceDaily}</option>
                <option value="Weekly">{translations.recurrenceWeekly}</option>
                <option value="Monthly">{translations.recurrenceMonthly}</option>
              </select>
            </div>
            
            <div className="flex gap-3 w-full lg:w-auto">
              {editingTask && (
                <button type="button" onClick={resetForm} className="flex-1 lg:flex-none btn-secondary">
                  {translations.cancel}
                </button>
              )}
              <button type="submit" className="flex-1 lg:flex-none btn-primary shadow-blue-500/20">
                <Plus size={20} className="mr-2" /> 
                {editingTask ? translations.updateTask : translations.addTodo}
              </button>
            </div>
          </div>
        </form>
      </div>

      {tasksLoading ? <TodoListSkeleton /> : (
        <div className="space-y-2">
          {renderTaskGroup(translations.overdue, taskGroups.overdue)}
          {renderTaskGroup(translations.today, taskGroups.today)}
          {renderTaskGroup(translations.thisWeek, taskGroups.thisWeek)}
          {renderTaskGroup(translations.upcoming, taskGroups.upcoming)}
          {renderTaskGroup(translations.completed, taskGroups.completed)}
          {tasks.length === 0 && (
            <div className="glass-panel p-12 text-center text-gray-400 mt-8 border border-white/5 border-dashed">
              <Check size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-xl font-medium">{translations.noTasks}</p>
              <p className="mt-2 text-sm text-gray-500">Suas novas tarefas aparecerão aqui.</p>
            </div>
          )}
        </div>
      )}
      
      <CalendarModal isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} tasks={tasks} onDateSelect={handleDateSelect} />
    </div>
  );
};

export default TodoList;
