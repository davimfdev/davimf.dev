import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trash2 } from 'lucide-react';

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

const TodoList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const fetchTasks = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tasks', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Falha ao buscar tarefas.' }));
        throw new Error(errorData.error);
      }
      const data: Task[] = await response.json();
      setTasks(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim() || !token) return;

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ text: newTaskText }),
      });
      if (!response.ok) throw new Error('Falha ao adicionar tarefa.');
      const newTask = await response.json();
      setTasks([newTask, ...tasks]);
      setNewTaskText('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleTaskCompletion = async (task: Task) => {
    if (!token) return;
    try {
      const response = await fetch('/api/tasks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id: task.id, completed: !task.completed }),
      });
      if (!response.ok) throw new Error('Falha ao atualizar tarefa.');
      const updatedTask = await response.json();
      setTasks(tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!token) return;
    try {
      const response = await fetch('/api/tasks', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id: taskId }),
      });
      if (!response.ok) throw new Error('Falha ao deletar tarefa.');
      setTasks(tasks.filter((t) => t.id !== taskId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="text-center">Carregando tarefas...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">Erro: {error}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Minha Lista de Tarefas</h1>
      <form onSubmit={handleAddTask} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="Adicionar nova tarefa..."
          className="flex-grow px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          Adicionar
        </button>
      </form>

      <div>
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-center p-4 mb-2 rounded-md transition-colors ${
                task.completed ? 'bg-gray-800 text-gray-500' : 'bg-gray-700'
              }`}
            >
              <div
                className="flex-grow cursor-pointer"
                onClick={() => toggleTaskCompletion(task)}
              >
                <span className={task.completed ? 'line-through' : ''}>{task.text}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTask(task.id);
                }}
                className="text-gray-500 hover:text-red-500 transition-colors ml-4"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-400 py-4">Nenhuma tarefa registrada ainda.</p>
        )}
      </div>
    </div>
  );
};

export default TodoList;
