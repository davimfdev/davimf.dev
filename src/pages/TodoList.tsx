import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Trash2, Edit, Plus, Calendar as CalendarIcon, Repeat, Clock, Check } from 'lucide-react';

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

// --- Skeleton Loader ---
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

// --- Calendar Modal ---
const CalendarModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onDateSelect: (date: string) => void;
}> = ({ isOpen, onClose, tasks, onDateSelect }) => {
  const { translations } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

    const calendarDays = [];
    for (let i = 0; i < 42; i++) {
        const day = new Date(startDate);
        day.setDate(day.getDate() + i);
        calendarDays.push(day);
    }
    return calendarDays;
  }, [currentDate]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Set<Priority>>();
    for (const task of tasks) {
        if (task.due_date && !task.completed) {
            const dateStr = task.due_date.split('T')[0];
            if (!map.has(dateStr)) {
                map.set(dateStr, new Set<Priority>());
            }
            map.get(dateStr)!.add(task.priority);
        }
    }
    return map;
  }, [tasks]);

  const priorityColors: Record<Priority, string> = {
    High: 'bg-red-500',
    Medium: 'bg-yellow-500',
    Low: 'bg-blue-500',
  };

  if (!isOpen) return null;

  const handleDateClick = (date: Date) => {
    onDateSelect(date.toISOString().split('T')[0]);
    onClose();
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div ref={modalRef} className="bg-gray-800 p-6 rounded-lg w-full max-w-lg shadow-lg text-white">
        <div className="flex justify-between items-center mb-4">
          <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-700">&lt;</button>
          <h2 className="text-xl font-semibold">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-700">&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="font-bold text-sm text-gray-400">{d}</div>)}
          {days.map((d, i) => {
            const dateStr = d.toISOString().split('T')[0];
            const priorities = tasksByDate.get(dateStr);
            const isCurrentMonth = d.getMonth() === currentDate.getMonth();
            const isToday = dateStr === new Date().toISOString().split('T')[0];

            return (
              <div
                key={i}
                onClick={() => handleDateClick(d)}
                className={`p-2 rounded-full cursor-pointer relative flex items-center justify-center ${
                  isCurrentMonth ? 'text-white' : 'text-gray-500'
                } ${isToday ? 'bg-blue-600' : ''} hover:bg-gray-700`}
              >
                <span>{d.getDate()}</span>
                {priorities && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {Array.from(priorities).sort().map(p => (
                            <div key={p} className={`h-1.5 w-1.5 rounded-full ${priorityColors[p]}`}></div>
                        ))}
                    </div>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={onClose} className="mt-6 w-full bg-gray-600 hover:bg-gray-500 py-2 rounded-md">{translations.close}</button>
      </div>
    </div>
  );
};

// --- Main Component ---
const TodoList: React.FC = () => {
  const { translations, language } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [recurrence, setRecurrence] = useState<Recurrence>('None');
  const [isAllDay, setIsAllDay] = useState(true);
  const [dueTime, setDueTime] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const taskInputRef = useRef<HTMLInputElement>(null);

  const fetchTasks = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/tasks', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error('Failed to fetch tasks.');
      const data: Task[] = await response.json();
      setTasks(data);
    } catch (err: any) { setError(err.message); } 
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleUpsertTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim() || !token) return;

    const taskData = {
        id: editingTask?.id,
        text: newTaskText,
        due_date: dueDate || new Date().toISOString().split('T')[0],
        priority,
        recurrence,
        is_all_day: isAllDay,
        due_time: isAllDay ? null : dueTime,
    };

    try {
        const response = await fetch('/api/tasks', {
            method: editingTask ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(taskData),
        });
        if (!response.ok) throw new Error('Failed to save task.');
        
        const result = await response.json();
        if (editingTask) {
            setTasks(tasks.map(t => t.id === result.updatedTask.id ? result.updatedTask : t));
        } else {
            setTasks(prev => [result, ...prev]);
        }
        resetForm();
    } catch (err: any) { setError(err.message); }
  };

  const toggleTaskCompletion = async (task: Task) => {
    if (!token) return;
    try {
        const response = await fetch('/api/tasks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id: task.id, completed: !task.completed }),
        });
        if (!response.ok) throw new Error('Failed to update task.');
        
        const { updatedTask, newRecurringTask } = await response.json();
        
        setTasks(prevTasks => {
            const newTasks = prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t);
            if (newRecurringTask) {
                return [newRecurringTask, ...newTasks];
            }
            return newTasks;
        });
    } catch (err: any) { setError(err.message); }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!token) return;
    try {
      await fetch('/api/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: taskId }),
      });
      setTasks(tasks.filter((t) => t.id !== taskId));
    } catch (err: any) { setError(err.message); }
  };

  const startEditing = (task: Task) => {
    setEditingTask(task);
    setNewTaskText(task.text);
    setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
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

  const priorityClasses = {
    Low: 'border-l-4 border-blue-500',
    Medium: 'border-l-4 border-yellow-500',
    High: 'border-l-4 border-red-500',
  };

  const { overdue, today, thisWeek, upcoming, completed } = useMemo(() => {
    const groups = { overdue: [] as Task[], today: [] as Task[], thisWeek: [] as Task[], upcoming: [] as Task[], completed: [] as Task[] };
    
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    const todayStr = todayObj.toISOString().split('T')[0];

    const endOfWeekObj = new Date(todayObj);
    endOfWeekObj.setDate(todayObj.getDate() + (7 - todayObj.getDay())); // End of Sunday
    const endOfWeekStr = endOfWeekObj.toISOString().split('T')[0];

    const sortedTasks = [...tasks].sort((a, b) => {
        const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        if (dateA === dateB) {
            const timeA = a.due_time || '';
            const timeB = b.due_time || '';
            return timeA.localeCompare(timeB);
        }
        return dateA - dateB;
    });

    for (const task of sortedTasks) {
        const dueDateStr = task.due_date ? task.due_date.split('T')[0] : null;

        if (task.completed) {
            groups.completed.push(task);
        } else if (!dueDateStr) {
            groups.upcoming.push(task);
        } else if (dueDateStr < todayStr) {
            groups.overdue.push(task);
        } else if (dueDateStr === todayStr) {
            groups.today.push(task);
        } else if (dueDateStr > todayStr && dueDateStr <= endOfWeekStr) {
            groups.thisWeek.push(task);
        } else {
            groups.upcoming.push(task);
        }
    }
    return groups;
  }, [tasks]);

  const renderTask = (task: Task) => (
    <div 
      key={task.id} 
      onClick={() => toggleTaskCompletion(task)}
      className={`flex items-center p-3 mb-2 rounded-md transition-colors cursor-pointer ${task.completed ? 'bg-gray-800 text-gray-500' : 'bg-gray-700'} ${priorityClasses[task.priority]}`}
    >
        <div className="mr-4 flex-shrink-0">
            <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${task.completed ? 'border-green-500 bg-green-500' : 'border-gray-500'}`}>
                {task.completed && <Check size={16} className="text-white" />}
            </div>
        </div>
        <div className="flex-grow">
            <p className={task.completed ? 'line-through' : ''}>{task.text}</p>
            <div className="flex items-center text-xs text-gray-400 gap-4 mt-1">
                {task.due_date && <span className="flex items-center gap-1"><CalendarIcon size={12} /> {new Date(task.due_date).toLocaleDateString(language, { timeZone: 'UTC' })}</span>}
                {!task.is_all_day && task.due_time && <span className="flex items-center gap-1"><Clock size={12} /> {task.due_time.substring(0, 5)}</span>}
                {task.recurrence !== 'None' && <span className="flex items-center gap-1"><Repeat size={12} /> {translations[`recurrence${task.recurrence}` as keyof typeof translations]}</span>}
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                startEditing(task);
              }} 
              className="text-gray-400 hover:text-blue-400 p-1 rounded-full"
            >
              <Edit size={18} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTask(task.id);
              }} 
              className="text-gray-400 hover:text-red-400 p-1 rounded-full"
            >
              <Trash2 size={18} />
            </button>
        </div>
    </div>
  );

  const renderTaskGroup = (title: string, taskList: Task[]) => (
    taskList.length > 0 && (
        <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3 text-gray-300">{title}</h2>
            {taskList.map(renderTask)}
        </div>
    )
  );

  if (loading) return <TodoListSkeleton />;
  if (error) return <div className="text-center text-red-500">Error: {error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-center items-center gap-4 mb-8">
        <h1 className="text-4xl font-bold text-center">{translations.todoListTitle}</h1>
        <button onClick={() => setIsCalendarOpen(true)} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600" title={translations.viewCalendar}>
            <CalendarIcon size={24} />
        </button>
      </div>
      
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <form onSubmit={handleUpsertTask}>
            <input ref={taskInputRef} type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder={translations.addOrEditTask} className="w-full px-4 py-2 bg-gray-700 rounded-md mb-4" required />
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center flex-wrap gap-4">
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-gray-700 p-2 rounded-md" />
                    
                    <div className="flex items-center bg-gray-700 rounded-md">
                        <button type="button" onClick={() => setIsAllDay(true)} className={`px-3 py-2 rounded-l-md text-sm ${isAllDay ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{translations.allDay}</button>
                        <button type="button" onClick={() => setIsAllDay(false)} className={`px-3 py-2 rounded-r-md text-sm ${!isAllDay ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{translations.specificTime}</button>
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

      {renderTaskGroup(translations.overdue, overdue)}
      {renderTaskGroup(translations.today, today)}
      {renderTaskGroup(translations.thisWeek, thisWeek)}
      {renderTaskGroup(translations.upcoming, upcoming)}
      {renderTaskGroup(translations.completed, completed)}

      {tasks.length === 0 && !loading && <p className="text-center text-gray-400 py-8">{translations.noTasks}</p>}
      
      <CalendarModal 
        isOpen={isCalendarOpen} 
        onClose={() => setIsCalendarOpen(false)} 
        tasks={tasks}
        onDateSelect={handleDateSelect}
      />
    </div>
  );
};

export default TodoList;
