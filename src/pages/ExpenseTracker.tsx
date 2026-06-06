import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Trash2, PlusCircle, PiggyBank, Wallet } from 'lucide-react';

// --- Tipos ---
interface Account {
  id: number;
  name: string;
  currency: string;
  type: string;
  initial_balance: string;
}

interface Expense {
  id: number;
  description: string;
  amount: string;
  category: string;
  date: string;
  payment_type: string;
  account_id: number;
  account_name: string;
}

interface Rates {
  [key: string]: number;
}

// --- Componente Modal para Adicionar Conta ---
const AddAccountModal: React.FC<{ onClose: () => void; onAccountAdded: (account: Account) => void; token: string | null }> = ({ onClose, onAccountAdded, token }) => {
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState('BRL');
    const [type, setType] = useState('Corrente');
    const [initialBalance, setInitialBalance] = useState('0');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !token) return;
        
        const response = await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, currency: currency.toUpperCase(), type, initial_balance: parseFloat(initialBalance) }),
        });

        if (response.ok) {
            const newAccount = await response.json();
            onAccountAdded(newAccount);
            onClose();
        } else {
            alert('Falha ao adicionar conta.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in p-4">
            <div className="glass-panel p-8 rounded-lg w-full max-w-md shadow-2xl border border-white/20 animate-slide-up">
                <h2 className="text-2xl font-bold mb-6 text-gray-100 flex items-center">
                    <Wallet className="mr-3 text-accent" /> Adicionar Conta
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome da Conta (ex: Itaú, Wise)" required className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-accent outline-none text-white" />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="Moeda (BRL)" required className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-accent outline-none text-white uppercase" />
                        <select value={type} onChange={e => setType(e.target.value)} className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-accent outline-none text-white">
                            <option>Corrente</option>
                            <option>Investimento</option>
                            <option>Caixa</option>
                        </select>
                    </div>
                    <input type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="Saldo Inicial" step="0.01" required className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-accent outline-none text-white" />
                    <div className="flex justify-end gap-4 pt-4 border-t border-white/10 mt-4">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button type="submit" className="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Componente Principal ---
const ExpenseTracker: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [rates, setRates] = useState<Rates | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Alimentação');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState<string>('');
  const [paymentType, setPaymentType] = useState('Débito');
  const [transactionType, setTransactionType] = useState('expense');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, isAuthLoading } = useAuth();
  const { translations } = useLanguage();

  const fetchData = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [accountsRes, expensesRes, ratesRes] = await Promise.all([
        fetch('/api/accounts', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/expenses', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/exchange-rates', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (!accountsRes.ok || !expensesRes.ok || !ratesRes.ok) throw new Error('Falha ao buscar dados essenciais.');
      
      const accountsData = await accountsRes.json();
      const expensesData = await expensesRes.json();
      const ratesData = await ratesRes.json();

      setAccounts(accountsData);
      setExpenses(expensesData);
      setRates(ratesData);
      if (accountsData.length > 0 && !accountId) {
        setAccountId(accountsData[0].id.toString());
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, accountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !accountId || !token) return;
    
    const finalAmount = transactionType === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ description, amount: finalAmount, category, date, account_id: parseInt(accountId), payment_type: paymentType }),
      });
      if (!response.ok) throw new Error('Falha ao adicionar transação.');
      fetchData(); 
      setDescription('');
      setAmount('');
    } catch (err: any) { setError(err.message); }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!token) return;
    try {
      await fetch('/api/expenses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: expenseId }),
      });
      setExpenses(expenses.filter((exp) => exp.id !== expenseId));
    } catch (err: any) { setError(err.message); }
  };

  const { totalBalanceBRL, accountBalances } = useMemo(() => {
    if (!rates || accounts.length === 0) {
      return { totalBalanceBRL: 0, accountBalances: new Map() };
    }

    const balances = new Map<number, number>();
    let totalBRL = 0;

    for (const acc of accounts) {
      const totalExpenses = expenses
        .filter(exp => exp.account_id === acc.id)
        .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      
      const currentBalance = parseFloat(acc.initial_balance) + totalExpenses;
      balances.set(acc.id, currentBalance);

      const rateToBRL = rates.BRL / rates[acc.currency];
      totalBRL += currentBalance * rateToBRL;
    }

    return { totalBalanceBRL: totalBRL, accountBalances: balances };
  }, [accounts, expenses, rates]);

  if (isAuthLoading || loading) return (
    <div className="max-w-6xl mx-auto p-4 animate-pulse">
        <div className="h-10 w-1/3 bg-white/10 rounded-md mx-auto mb-8"></div>
        <div className="glass-panel h-64 mb-8"></div>
        <div className="glass-panel h-64 mb-8"></div>
    </div>
  );

  if (!token) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center animate-fade-in relative z-10">
        <div className="glass-panel p-12 max-w-2xl mx-auto border border-white/5">
          <PiggyBank size={64} className="mx-auto text-accent mb-6" />
          <h2 className="text-3xl font-bold mb-4 text-gray-100">Rastreador de Despesas</h2>
          <p className="text-lg text-gray-400">Você precisa estar logado para acessar esta página.</p>
        </div>
      </div>
    );
  }

  if (error) return <div className="text-center p-6 bg-red-500/10 text-red-400 rounded-xl mt-8">Erro: {error}</div>;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in relative z-10 p-4">
      {isModalOpen && <AddAccountModal token={token} onClose={() => setIsModalOpen(false)} onAccountAdded={fetchData} />}
      
      <h1 className="text-4xl font-extrabold mb-10 text-center text-gradient">Rastreador de Despesas</h1>

      <div className="mb-10 p-8 glass-panel border border-white/5 animate-slide-up">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 border-b border-white/10 pb-6">
            <h2 className="text-2xl font-bold text-gray-100">Visão Geral</h2>
            <button onClick={() => setIsModalOpen(true)} className="btn-primary mt-4 sm:mt-0 flex items-center gap-2">
                <PlusCircle size={20} /> Adicionar Conta
            </button>
        </div>
        <div className="text-center mb-8 bg-gray-900/40 p-6 rounded-2xl shadow-inner border border-white/5">
            <p className="text-gray-400 uppercase tracking-wider text-sm font-semibold mb-2">Saldo Total Consolidado</p>
            <p className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
              {totalBalanceBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {accounts.map(acc => (
                <div key={acc.id} className="bg-white/5 border border-white/10 p-5 rounded-xl hover:bg-white/10 transition-colors">
                    <p className="font-bold text-gray-200 mb-1 flex items-center gap-2"><Wallet size={16} className="text-accent"/> {acc.name}</p>
                    <p className="text-2xl font-mono text-gray-100">{(accountBalances.get(acc.id) ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: acc.currency })}</p>
                </div>
            ))}
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 mb-10 border border-white/5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-2xl font-bold mb-6 text-gray-100 border-b border-white/10 pb-4">Nova Transação</h2>
        <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={translations.transactionDescription} className="md:col-span-3 w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-accent outline-none text-white transition-all" required />
          
          <div className="grid grid-cols-2 gap-4">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={translations.amount} step="0.01" className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-accent outline-none text-white transition-all font-mono" required />
            <select value={transactionType} onChange={e => setTransactionType(e.target.value)} className={`w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 outline-none font-medium transition-all ${transactionType === 'income' ? 'focus:ring-green-500 text-green-400' : 'focus:ring-red-500 text-red-400'}`}>
                <option value="income" className="text-green-400">{translations.income} (+)</option>
                <option value="expense" className="text-red-400">{translations.expense} (-)</option>
            </select>
          </div>
          
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-accent outline-none text-white transition-all" required>
            <option value="" disabled>Selecione a Conta</option>
            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
          </select>
          
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-accent outline-none text-gray-300 transition-all" required />
          
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-accent outline-none text-white transition-all">
            <option>Alimentação</option> <option>Transporte</option> <option>Moradia</option>
            <option>Lazer</option> <option>Saúde</option> <option>Outros</option>
          </select>
          
          <select value={paymentType} onChange={e => setPaymentType(e.target.value)} className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-accent outline-none text-white transition-all">
            <option>Débito</option> <option>Crédito</option> <option>PIX</option> <option>Dinheiro</option>
          </select>
          
          <button type="submit" className="md:col-span-3 btn-primary py-3 mt-2 shadow-accent/20">
            Adicionar Transação
          </button>
        </form>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-2xl font-bold mb-6 text-gray-100">Histórico de Transações</h2>
        <div className="glass-panel border border-white/5 overflow-hidden">
          {expenses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-gray-400 text-sm uppercase tracking-wider">
                    <th className="p-4 font-medium">Descrição</th>
                    <th className="p-4 font-medium text-center">Categoria</th>
                    <th className="p-4 font-medium text-right">Valor / Conta</th>
                    <th className="p-4 font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {expenses.map((expense) => {
                    const isExpense = parseFloat(expense.amount) < 0;
                    return (
                      <tr key={expense.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-4">
                          <p className="font-semibold text-gray-200">{expense.description}</p>
                          <p className="text-xs text-gray-500 mt-1">{new Date(expense.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} • {expense.payment_type}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className="px-3 py-1 bg-white/5 border border-white/10 text-gray-300 text-xs rounded-full font-medium">
                            {expense.category}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <p className={`font-mono font-bold text-lg ${isExpense ? 'text-red-400' : 'text-green-400'}`}>
                            {isExpense ? '' : '+'}{parseFloat(expense.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 flex justify-end items-center gap-1">
                            <Wallet size={12} /> {expense.account_name}
                          </p>
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleDeleteExpense(expense.id)} className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400">
              <p className="text-lg">Nenhuma transação registrada ainda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpenseTracker;
