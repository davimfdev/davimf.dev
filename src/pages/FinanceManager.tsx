import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trash2, PlusCircle } from 'lucide-react';
import CategoryChart from '../components/CategoryChart';

// --- Tipos ---
interface Account {
  id: number;
  name: string;
  currency: string;
  type: string;
  initial_balance: string;
}

interface Transaction {
  id: number;
  description: string;
  amount: string;
  category: string;
  date: string;
  account_id: number;
  account_name: string;
}

interface Rates {
  [key: string]: number;
}

// --- Componente Modal ---
const AddAccountModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAccountAdded: (newAccount: Account) => void;
  token: string; // Agora garantimos que o token é uma string
}> = ({ isOpen, onClose, onAccountAdded, token }) => {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [type, setType] = useState('Corrente');
  const [initialBalance, setInitialBalance] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCurrency('BRL');
      setType('Corrente');
      setInitialBalance('0');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { // Apenas verifica o nome, pois o token é garantido
      setError("Nome da conta é obrigatório.");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, currency: currency.toUpperCase(), type, initial_balance: parseFloat(initialBalance) }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Falha ao adicionar conta.' }));
        throw new Error(errorData.error || 'Falha ao adicionar conta.');
      }
      
      const newAccount = await response.json();
      onAccountAdded(newAccount);
      onClose();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Adicionar Nova Conta</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="accountName" className="block text-sm font-medium text-gray-300 mb-1">Nome da Conta</label>
            <input id="accountName" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Itaú, Wise, Reserva" required className="w-full p-2 bg-gray-700 rounded-md border border-gray-600" />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="accountCurrency" className="block text-sm font-medium text-gray-300 mb-1">Moeda</label>
              <input id="accountCurrency" type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="Ex: BRL, USD" required className="w-full p-2 bg-gray-700 rounded-md border border-gray-600" />
            </div>
            <div>
              <label htmlFor="accountType" className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
              <select id="accountType" value={type} onChange={e => setType(e.target.value)} className="w-full p-2 bg-gray-700 rounded-md border border-gray-600">
                <option>Corrente</option>
                <option>Investimento</option>
                <option>Caixa</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label htmlFor="initialBalance" className="block text-sm font-medium text-gray-300 mb-1">Saldo Inicial</label>
            <input id="initialBalance" type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="Valor atual na conta" required className="w-full p-2 bg-gray-700 rounded-md border border-gray-600" />
          </div>
          
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="flex justify-end gap-4 mt-6">
            <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-md transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md transition-colors disabled:bg-blue-400">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Componente Principal ---
const FinanceManager: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rates, setRates] = useState<Rates | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Alimentação');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, isAuthenticated, isAuthLoading } = useAuth(); // Pega isAuthLoading

  // NOVO LOG: Verifica o token no componente pai
  console.log('FinanceManager: Token no componente pai:', token, 'isAuthenticated:', isAuthenticated, 'isAuthLoading:', isAuthLoading);

  const fetchData = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [accountsRes, transactionsRes, ratesRes] = await Promise.all([
        fetch('/api/accounts', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/transactions', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/exchange-rates', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (!accountsRes.ok || !transactionsRes.ok || !ratesRes.ok) throw new Error('Falha ao buscar dados essenciais.');
      
      const accountsData = await accountsRes.json();
      const transactionsData = await transactionsRes.json();
      const ratesData = await ratesRes.json();

      setAccounts(accountsData);
      setTransactions(transactionsData);
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

  useEffect(() => { 
    if (!isAuthLoading && isAuthenticated) { // Só busca dados se não estiver carregando e estiver autenticado
      fetchData(); 
    } else if (!isAuthLoading && !isAuthenticated) { // Se terminou de carregar e não está autenticado
      setLoading(false); // Para o loading para não ficar infinito
    }
  }, [fetchData, isAuthLoading, isAuthenticated]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !accountId || !token) return;
    
    const finalAmount = transactionType === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ description, amount: finalAmount, category, date, account_id: parseInt(accountId) }),
      });
      if (!response.ok) throw new Error('Falha ao adicionar transação.');
      const newTransaction = await response.json();
      setTransactions(prev => [newTransaction, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setDescription('');
      setAmount('');
    } catch (err: any) { setError(err.message); }
  };

  const handleDeleteTransaction = async (transactionId: number) => {
    if (!token) return;
    try {
      await fetch('/api/transactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: transactionId }),
      });
      setTransactions(transactions.filter((t) => t.id !== transactionId));
    } catch (err: any) { setError(err.message); }
  };

  const handleDeleteAccount = async (accountIdToDelete: number) => {
    if (!token) return;
    if (!window.confirm('Tem certeza que deseja excluir esta conta? Todas as transações associadas também serão excluídas.')) {
      return;
    }
    try {
      const response = await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: accountIdToDelete }),
      });
      if (!response.ok) throw new Error('Falha ao deletar conta.');
      // Após deletar, recarrega todos os dados para garantir consistência
      fetchData(); 
    } catch (err: any) { setError(err.message); }
  };

  const { totalBalanceBRL, accountBalances } = useMemo(() => {
    if (!rates || accounts.length === 0) {
      return { totalBalanceBRL: 0, accountBalances: new Map() };
    }

    const balances = new Map<number, number>();
    let totalBRL = 0;

    for (const acc of accounts) {
      const totalTransactions = transactions
        .filter(t => t.account_id === acc.id)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const currentBalance = parseFloat(acc.initial_balance) + totalTransactions;
      balances.set(acc.id, currentBalance);

      const rateToBRL = rates.BRL / rates[acc.currency];
      totalBRL += currentBalance * rateToBRL;
    }

    return { totalBalanceBRL: totalBRL, accountBalances: balances };
  }, [accounts, transactions, rates]);

  if (loading || isAuthLoading) return <div className="text-center">Carregando...</div>; // Adiciona isAuthLoading aqui
  if (error) return <div className="text-center text-red-500">Erro: {error}</div>;

  return (
    <div className="max-w-6xl mx-auto">
      {isModalOpen && token && ( // Renderiza o modal APENAS se o token existir
        <AddAccountModal 
          isOpen={isModalOpen}
          token={token} // Agora o token é garantido como string
          onClose={() => setIsModalOpen(false)} 
          onAccountAdded={(newAccount) => setAccounts(prev => [...prev, newAccount])} 
        />
      )}
      
      <h1 className="text-3xl font-bold mb-6 text-center">Gerenciador Financeiro</h1>

      <div className="mb-8 p-6 bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Visão Geral</h2>
            {isAuthenticated && (
              <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">
                  <PlusCircle size={20} /> Adicionar Conta
              </button>
            )}
        </div>
        <div className="text-center mb-4">
            <p className="text-gray-400">Patrimônio Total</p>
            <p className="text-4xl font-bold text-green-400">{totalBalanceBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map(acc => (
                <div key={acc.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
                    <div>
                        <p className="font-bold">{acc.name}</p>
                        <p className="text-lg">{(accountBalances.get(acc.id) ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: acc.currency })}</p>
                    </div>
                    <button 
                        onClick={() => handleDeleteAccount(acc.id)} 
                        className="text-gray-500 hover:text-red-500 p-1"
                        title="Excluir Conta"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}
        </div>
      </div>

      <div className="mb-8">
        <CategoryChart transactions={transactions} />
      </div>

      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Adicionar Nova Transação</h2>
        <form onSubmit={handleAddTransaction} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 flex gap-2 mb-2">
            <button type="button" onClick={() => setTransactionType('expense')} className={`w-full py-2 rounded-md ${transactionType === 'expense' ? 'bg-red-600' : 'bg-gray-700'}`}>Despesa</button>
            <button type="button" onClick={() => setTransactionType('income')} className={`w-full py-2 rounded-md ${transactionType === 'income' ? 'bg-green-600' : 'bg-gray-700'}`}>Receita</button>
          </div>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="md:col-span-3 px-4 py-2 bg-gray-700 rounded-md" required />
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor" step="0.01" className="px-4 py-2 bg-gray-700 rounded-md" required />
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className="px-4 py-2 bg-gray-700 rounded-md" required>
            <option value="">Selecione a Conta</option>
            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-4 py-2 bg-gray-700 rounded-md" required />
          <select value={category} onChange={e => setCategory(e.target.value)} className="px-4 py-2 bg-gray-700 rounded-md">
            <option>Alimentação</option> <option>Salário</option> <option>Transporte</option> <option>Moradia</option>
            <option>Lazer</option> <option>Saúde</option> <option>Outros</option>
          </select>
          <button type="submit" className="md:col-span-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">Adicionar Transação</button>
        </form>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Histórico de Transações</h2>
        <div className="bg-gray-800 p-4 rounded-lg">
          {transactions.length > 0 ? transactions.map((t) => (
            <div key={t.id} className="grid grid-cols-5 gap-4 items-center border-b border-gray-700 py-3 last:border-b-0">
              <div className="col-span-2"><p className="font-semibold">{t.description}</p><p className="text-sm text-gray-400">{new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p></div>
              <div className="text-center"><span className="px-2 py-1 bg-gray-700 text-xs rounded-full">{t.category}</span></div>
              <div className={`text-right font-mono ${parseFloat(t.amount) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                <p>{parseFloat(t.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                <p className="text-xs text-gray-400">{t.account_name}</p>
              </div>
              <div className="text-right"><button onClick={() => handleDeleteTransaction(t.id)} className="text-gray-500 hover:text-red-500 p-1"><Trash2 size={18} /></button></div>
            </div>
          )) : <p className="text-center text-gray-400 py-4">Nenhuma transação registrada ainda.</p>}
        </div>
      </div>
    </div>
  );
};

export default FinanceManager;
