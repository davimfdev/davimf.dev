import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Trash2, PlusCircle } from 'lucide-react';

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
                <h2 className="text-xl font-semibold mb-4">Adicionar Nova Conta</h2>
                <form onSubmit={handleSubmit}>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome da Conta (ex: Itaú, Wise)" required className="w-full mb-4 p-2 bg-gray-700 rounded-md" />
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="Moeda (ex: BRL, USD)" required className="p-2 bg-gray-700 rounded-md" />
                        <select value={type} onChange={e => setType(e.target.value)} className="p-2 bg-gray-700 rounded-md">
                            <option>Corrente</option>
                            <option>Investimento</option>
                            <option>Caixa</option>
                        </select>
                    </div>
                    <input type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="Saldo Inicial" required className="w-full mb-4 p-2 bg-gray-700 rounded-md" />
                    <div className="flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-md">Cancelar</button>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md">Salvar</button>
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
  const { token } = useAuth();
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

  if (loading) return <div className="text-center">Carregando...</div>;
  if (error) return <div className="text-center text-red-500">Erro: {error}</div>;

  return (
    <div className="max-w-6xl mx-auto">
      {isModalOpen && <AddAccountModal token={token} onClose={() => setIsModalOpen(false)} onAccountAdded={fetchData} />}
      
      <h1 className="text-3xl font-bold mb-6 text-center">Rastreador de Despesas</h1>

      <div className="mb-8 p-6 bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Visão Geral</h2>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">
                <PlusCircle size={20} /> Adicionar Conta
            </button>
        </div>
        <div className="text-center mb-4">
            <p className="text-gray-400">Saldo Total Consolidado</p>
            <p className="text-4xl font-bold text-green-400">{totalBalanceBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map(acc => (
                <div key={acc.id} className="bg-gray-700 p-4 rounded-lg">
                    <p className="font-bold">{acc.name}</p>
                    <p className="text-lg">{(accountBalances.get(acc.id) ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: acc.currency })}</p>
                </div>
            ))}
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Adicionar Nova Transação</h2>
        <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={translations.transactionDescription} className="md:col-span-3 px-4 py-2 bg-gray-700 rounded-md" required />
          <div className="grid grid-cols-2 gap-4">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={translations.amount} step="0.01" className="px-4 py-2 bg-gray-700 rounded-md" required />
            <select value={transactionType} onChange={e => setTransactionType(e.target.value)} className="px-4 py-2 bg-gray-700 rounded-md">
                <option value="income">{translations.income}</option>
                <option value="expense">{translations.expense}</option>
            </select>
          </div>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className="px-4 py-2 bg-gray-700 rounded-md" required>
            <option value="">Selecione a Conta</option>
            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-4 py-2 bg-gray-700 rounded-md" required />
          <select value={category} onChange={e => setCategory(e.target.value)} className="px-4 py-2 bg-gray-700 rounded-md">
            <option>Alimentação</option> <option>Transporte</option> <option>Moradia</option>
            <option>Lazer</option> <option>Saúde</option> <option>Outros</option>
          </select>
          <select value={paymentType} onChange={e => setPaymentType(e.target.value)} className="px-4 py-2 bg-gray-700 rounded-md">
            <option>Débito</option> <option>Crédito</option> <option>PIX</option> <option>Dinheiro</option>
          </select>
          <button type="submit" className="md:col-span-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">Adicionar Transação</button>
        </form>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Histórico de Transações</h2>
        <div className="bg-gray-800 p-4 rounded-lg">
          {expenses.length > 0 ? expenses.map((expense) => (
            <div key={expense.id} className="grid grid-cols-5 gap-4 items-center border-b border-gray-700 py-3 last:border-b-0">
              <div className="col-span-2"><p className="font-semibold">{expense.description}</p><p className="text-sm text-gray-400">{new Date(expense.date).toLocaleDateS tring('pt-BR', { timeZone: 'UTC' })}</p></div>
              <div className="text-center"><span className="px-2 py-1 bg-gray-700 text-xs rounded-full">{expense.category}</span></div>
              <div className={`text-right font-mono ${parseFloat(expense.amount) < 0 ? 'text-red-400' : 'text-green-400'}`}><p>{parseFloat(expense.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p><p className="text-xs text-gray-400">{expense.account_name}</p></div>
              <div className="text-right"><button onClick={() => handleDeleteExpense(expense.id)} className="text-gray-500 hover:text-red-500 p-1"><Trash2 size={18} /></button></div>
            </div>
          )) : <p className="text-center text-gray-400 py-4">Nenhuma transação registrada ainda.</p>}
        </div>
      </div>
    </div>
  );
};

export default ExpenseTracker;
