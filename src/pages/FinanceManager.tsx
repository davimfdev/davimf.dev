import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Trash2, PlusCircle, ArrowRightLeft, DollarSign, Wallet, CreditCard, PiggyBank } from 'lucide-react';
import CategoryChart from '../components/CategoryChart';

// --- Types ---
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
  payment_type: 'PIX' | 'Card';
  is_paid?: boolean;
}

interface Rates {
  [key: string]: number;
}

// --- Skeleton Components ---
const SkeletonLoader: React.FC = () => (
  <div className="max-w-7xl mx-auto p-4 animate-pulse">
    <div className="h-10 bg-white/10 rounded-md w-1/3 mx-auto mb-8"></div>

    {/* Overview Skeleton */}
    <div className="mb-10 p-8 glass-panel border border-white/5">
      <div className="flex justify-between items-center mb-6">
        <div className="h-8 bg-white/10 rounded-md w-1/4"></div>
        <div className="flex gap-3">
          <div className="h-12 bg-white/10 rounded-lg w-32"></div>
          <div className="h-12 bg-white/10 rounded-lg w-40"></div>
        </div>
      </div>
      <div className="text-center mb-8">
        <div className="h-16 bg-white/10 rounded-md w-1/2 mx-auto"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 p-6 rounded-xl h-24 border border-white/5"></div>
        <div className="bg-white/5 p-6 rounded-xl h-24 border border-white/5"></div>
        <div className="bg-white/5 p-6 rounded-xl h-24 border border-white/5"></div>
      </div>
    </div>

    {/* Add Transaction & Charts Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
      <div className="lg:col-span-1 glass-panel p-8 h-fit space-y-5 border border-white/5">
        <div className="h-8 bg-white/10 rounded-md w-3/4 mb-2"></div>
        <div className="h-12 bg-white/5 rounded-lg w-full"></div>
        <div className="h-12 bg-white/5 rounded-lg w-full"></div>
        <div className="h-12 bg-white/5 rounded-lg w-full"></div>
        <div className="h-12 bg-white/5 rounded-lg w-full"></div>
        <div className="h-12 bg-white/5 rounded-lg w-full"></div>
        <div className="h-12 bg-white/10 rounded-lg w-full mt-4"></div>
      </div>
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-panel p-8 h-72 border border-white/5"></div>
        <div className="glass-panel p-8 h-72 border border-white/5"></div>
      </div>
    </div>
  </div>
);


// --- Modals ---

const TransferModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onTransferCompleted: (fromTransaction: Transaction, toTransaction: Transaction) => void;
  accounts: Account[];
  token: string;
}> = ({ isOpen, onClose, onTransferCompleted, accounts, token }) => {
  const { translations } = useLanguage();
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && accounts.length >= 2) {
      setFromAccountId(accounts[0].id.toString());
      setToAccountId(accounts[1].id.toString());
      setAmount('');
      setDescription('');
      setError(null);
    }
  }, [isOpen, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId || !amount) {
      setError(translations.allFieldsRequired);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fromAccountId: parseInt(fromAccountId),
          toAccountId: parseInt(toAccountId),
          amount: parseFloat(amount),
          date: new Date().toISOString().split('T')[0],
          description: description || translations.transferDescriptionPlaceholder,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || translations.transferError);
      }
      const { fromTransaction, toTransaction } = await response.json();
      onTransferCompleted(fromTransaction, toTransaction);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in p-4">
      <div className="glass-panel p-8 w-full max-w-md shadow-2xl border border-white/20 animate-slide-up">
        <h2 className="text-2xl font-bold mb-6 text-gray-100 flex items-center">
          <ArrowRightLeft className="mr-3 text-purple-400" /> {translations.makeTransfer}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="fromAccount" className="block text-sm font-medium text-gray-300 mb-2">{translations.from}</label>
            <select id="fromAccount" value={fromAccountId} onChange={e => setFromAccountId(e.target.value)} className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-purple-500 text-white outline-none">
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="toAccount" className="block text-sm font-medium text-gray-300 mb-2">{translations.to}</label>
            <select id="toAccount" value={toAccountId} onChange={e => setToAccountId(e.target.value)} className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-purple-500 text-white outline-none">
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="transferAmount" className="block text-sm font-medium text-gray-300 mb-2">{translations.amount}</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">R$</span>
              <input id="transferAmount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required className="w-full p-3 pl-10 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-purple-500 text-white outline-none" />
            </div>
          </div>
          <div>
            <label htmlFor="transferDescription" className="block text-sm font-medium text-gray-300 mb-2">{translations.description}</label>
            <input id="transferDescription" type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder={translations.transferDescriptionPlaceholder} className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-purple-500 text-white outline-none" />
          </div>
          {error && <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
          <div className="flex justify-end gap-4 pt-6 border-t border-white/10">
            <button type="button" onClick={onClose} className="btn-secondary">{translations.cancel}</button>
            <button type="submit" disabled={loading} className="btn-primary bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/30">
              {loading ? translations.transferring : translations.transfer}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PayExpenseModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  expense: Transaction;
  onExpensePaid: (newTransaction: Transaction, paidExpenseId: number) => void;
  token: string;
}> = ({ isOpen, onClose, accounts, expense, onExpensePaid, token }) => {
  const { translations } = useLanguage();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id.toString());
      setError(null);
    }
  }, [isOpen, accounts]);

  const handlePay = async () => {
    if (!selectedAccountId) {
      setError(translations.selectBankToPay);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const paymentResponse = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          description: expense.description.replace(" (Fatura)", ""),
          amount: expense.amount,
          category: expense.category,
          date: new Date().toISOString().split('T')[0],
          account_id: parseInt(selectedAccountId),
          payment_type: 'PIX',
          is_paid: true
        }),
      });

      if (!paymentResponse.ok) {
        throw new Error('Failed to create payment transaction.');
      }
      const newTransaction = await paymentResponse.json();

      await fetch('/api/transactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: expense.id }),
      });

      onExpensePaid(newTransaction, expense.id);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in p-4">
      <div className="glass-panel p-8 w-full max-w-md shadow-2xl border border-white/20 animate-slide-up">
        <h2 className="text-2xl font-bold mb-2 text-gray-100 flex items-center">
          <CreditCard className="mr-3 text-green-400" /> {translations.pay}
        </h2>
        <p className="text-lg text-gray-300 font-medium mb-6 pb-4 border-b border-white/10">{expense.description}</p>
        
        <div className="space-y-4 mb-6">
          <label className="block text-sm font-medium text-gray-300">{translations.selectBankToPay}</label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-green-500 text-white outline-none"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
          {error && <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
        </div>
        <div className="flex justify-end gap-4 pt-4 border-t border-white/10">
          <button type="button" onClick={onClose} className="btn-secondary">{translations.cancel}</button>
          <button onClick={handlePay} disabled={loading} className="btn-primary bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-green-500/30">
            {loading ? 'Processando...' : translations.pay}
          </button>
        </div>
      </div>
    </div>
  );
};


const AddAccountModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAccountAdded: (newAccount: Account) => void;
  token: string;
}> = ({ isOpen, onClose, onAccountAdded, token }) => {
  const { translations } = useLanguage();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [type, setType] = useState('Corrente');
  const [initialBalance, setInitialBalance] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(''); setCurrency('BRL'); setType('Corrente'); setInitialBalance('0'); setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { setError(translations.bankName + " is required."); return; }
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, currency: currency.toUpperCase(), type, initial_balance: parseFloat(initialBalance) }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to add account.' }));
        throw new Error(errorData.error);
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in p-4">
      <div className="glass-panel p-8 w-full max-w-md shadow-2xl border border-white/20 animate-slide-up">
        <h2 className="text-2xl font-bold mb-6 text-gray-100 flex items-center">
          <Wallet className="mr-3 text-blue-400" /> {translations.addBank}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="accountName" className="block text-sm font-medium text-gray-300 mb-2">{translations.bankName}</label>
            <input id="accountName" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Itaú, Nubank" required className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-blue-500 text-white outline-none transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label htmlFor="accountCurrency" className="block text-sm font-medium text-gray-300 mb-2">{translations.category}</label>
              <input id="accountCurrency" type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="BRL" required className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-blue-500 text-white outline-none uppercase" />
            </div>
            <div>
              <label htmlFor="accountType" className="block text-sm font-medium text-gray-300 mb-2">{translations.type}</label>
              <select id="accountType" value={type} onChange={e => setType(e.target.value)} className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-blue-500 text-white outline-none">
                <option>Corrente</option> <option>Investimento</option> <option>Caixa</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="initialBalance" className="block text-sm font-medium text-gray-300 mb-2">{translations.initialBalance}</label>
            <input id="initialBalance" type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="0.00" step="0.01" required className="w-full p-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-blue-500 text-white outline-none" />
          </div>
          {error && <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
          <div className="flex justify-end gap-4 pt-6 border-t border-white/10">
            <button type="button" onClick={onClose} className="btn-secondary">{translations.cancel}</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : translations.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Main Component ---
const FinanceManager: React.FC = () => {
  const { translations } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rates, setRates] = useState<Rates | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isPayExpenseModalOpen, setIsPayExpenseModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Transaction | null>(null);

  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Alimentação');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'PIX' | 'Card'>('PIX');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, isAuthenticated, isAuthLoading } = useAuth();

  useEffect(() => {
    const loadInitialData = async () => {
        if (!token) { setLoading(false); return; }
        setLoading(true); setError(null);
        try {
            const [accountsRes, transactionsRes, ratesRes] = await Promise.all([
                fetch('/api/accounts', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/transactions', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/exchange-rates', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (!accountsRes.ok || !transactionsRes.ok || !ratesRes.ok) throw new Error('Failed to fetch essential data.');

            const [accountsData, transactionsData, ratesData] = await Promise.all([accountsRes.json(), transactionsRes.json(), ratesRes.json()]);

            setAccounts(accountsData);
            setTransactions(transactionsData);
            setRates(ratesData);

            if (accountsData.length > 0) {
                setAccountId(prevId => prevId || accountsData[0].id.toString());
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthLoading && isAuthenticated) {
        loadInitialData();
    } else if (!isAuthLoading && !isAuthenticated) {
        setLoading(false);
    }
  }, [token, isAuthLoading, isAuthenticated]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !accountId || !token) return;

    const isExpense = transactionType === 'expense';
    const isCard = isExpense && paymentType === 'Card';
    const finalAmount = isExpense ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));

    try {
        const body = {
            description: isCard ? `${description} (Fatura)` : description,
            amount: finalAmount,
            category,
            date,
            account_id: parseInt(accountId),
            payment_type: isExpense ? paymentType : 'PIX', // Default to PIX for income
            is_paid: !isCard
        };

        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error('Failed to add transaction.');
        const newTransaction = await response.json();

        setTransactions(prev => [newTransaction, ...prev]);
        setDescription('');
        setAmount('');

    } catch (err: any) {
        setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    if (!window.confirm(translations.confirmDelete)) return;
    try {
      const response = await fetch(`/api/transactions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error(`Failed to delete transaction.`);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (err: any) { setError(err.message); }
  };

  const handleAccountAdded = (newAccount: Account) => {
    setAccounts(prev => [...prev, newAccount]);
  };

  const handleTransferCompleted = (fromTransaction: Transaction, toTransaction: Transaction) => {
    setTransactions(prev => [fromTransaction, toTransaction, ...prev]);
  };

  const handleExpensePaid = (newTransaction: Transaction, paidExpenseId: number) => {
    setTransactions(prev => {
        const updatedTransactions = prev.filter(t => t.id !== paidExpenseId);
        return [newTransaction, ...updatedTransactions];
    });
  };

  const openPayModal = (expense: Transaction) => {
    setSelectedExpense(expense);
    setIsPayExpenseModalOpen(true);
  };

  const { currentTransactions, futureExpenses } = useMemo(() => {
    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return {
      currentTransactions: sortedTransactions.filter(t => t.is_paid),
      futureExpenses: sortedTransactions.filter(t => !t.is_paid),
    };
  }, [transactions]);

  const { totalBalanceBRL, accountBalances } = useMemo(() => {
    if (!rates || accounts.length === 0) return { totalBalanceBRL: 0, accountBalances: new Map() };
    const balances = new Map<number, number>();
    let totalBRL = 0;
    for (const acc of accounts) {
      const totalCurrentTransactions = transactions
        .filter(t => t.account_id === acc.id && t.is_paid)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const currentBalance = parseFloat(acc.initial_balance) + totalCurrentTransactions;
      balances.set(acc.id, currentBalance);
      const rateToBRL = rates[acc.currency] ? rates.BRL / rates[acc.currency] : 0;
      totalBRL += currentBalance * rateToBRL;
    }
    return { totalBalanceBRL: totalBRL, accountBalances: balances };
  }, [accounts, transactions, rates]);

  const pixExpenses = useMemo(() => currentTransactions.filter(t => t.payment_type === 'PIX' && parseFloat(t.amount) < 0), [currentTransactions]);
  const cardExpenses = useMemo(() => futureExpenses.filter(t => t.payment_type === 'Card' && parseFloat(t.amount) < 0), [futureExpenses]);

  if (loading || isAuthLoading) return <SkeletonLoader />;
  
  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="glass-panel p-12 max-w-2xl mx-auto border border-white/5 animate-fade-in">
          <PiggyBank size={64} className="mx-auto text-blue-400 mb-6" />
          <h2 className="text-3xl font-bold mb-4 text-gray-100">Gerenciador Financeiro</h2>
          <p className="text-lg text-gray-400">Você precisa estar logado para acessar e gerenciar suas finanças.</p>
        </div>
      </div>
    );
  }

  if (error) return <div className="text-center p-6 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl max-w-2xl mx-auto mt-10 shadow-lg">Erro: {error}</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 animate-fade-in relative z-10">
      {token && <AddAccountModal isOpen={isAccountModalOpen} token={token} onClose={() => setIsAccountModalOpen(false)} onAccountAdded={handleAccountAdded} />}
      {token && <TransferModal isOpen={isTransferModalOpen} token={token} accounts={accounts} onClose={() => setIsTransferModalOpen(false)} onTransferCompleted={handleTransferCompleted} />}
      {token && selectedExpense && <PayExpenseModal isOpen={isPayExpenseModalOpen} onClose={() => setIsPayExpenseModalOpen(false)} accounts={accounts} expense={selectedExpense} onExpensePaid={handleExpensePaid} token={token} />}

      <div className="flex items-center justify-center gap-4 mb-10">
        <h1 className="text-4xl font-extrabold text-center text-gradient">{translations.financeManagerTitle}</h1>
      </div>

      {/* Overview Section */}
      <div className="mb-10 p-8 glass-panel border border-white/5 shadow-xl animate-slide-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/10 pb-6">
            <h2 className="text-2xl font-bold text-gray-100 flex items-center">
              <DollarSign className="text-green-400 mr-2" /> {translations.totalBalance}
            </h2>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setIsTransferModalOpen(true)} disabled={accounts.length < 2} className="btn-secondary flex items-center gap-2 group border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <ArrowRightLeft size={18} className="text-purple-400 group-hover:scale-110 transition-transform" /> 
                <span className="font-medium">{translations.transfer}</span>
              </button>
              <button onClick={() => setIsAccountModalOpen(true)} className="btn-primary flex items-center gap-2">
                <PlusCircle size={18} /> 
                <span>{translations.addBank}</span>
              </button>
            </div>
        </div>
        
        <div className="text-center mb-10 bg-gray-900/40 py-8 rounded-2xl border border-white/5 shadow-inner">
            <p className="text-sm text-gray-400 font-medium uppercase tracking-wider mb-2">Saldo Geral Consolidado</p>
            <p className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
              {totalBalanceBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
        </div>
        
        {accounts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {accounts.map(acc => (
                  <div key={acc.id} className="bg-white/5 border border-white/10 p-5 rounded-xl flex justify-between items-center hover:bg-white/10 transition-colors group">
                      <div>
                        <p className="font-bold text-gray-200 mb-1 flex items-center gap-2">
                          <Wallet size={16} className="text-blue-400" /> {acc.name}
                        </p>
                        <p className="text-xl font-mono text-gray-100">{(accountBalances.get(acc.id) ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: acc.currency })}</p>
                      </div>
                      <button onClick={() => handleDelete(acc.id)} className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100" title={translations.delete}>
                        <Trash2 size={20} />
                      </button>
                  </div>
              ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 italic">Adicione uma conta para começar a gerenciar suas finanças.</p>
        )}
      </div>

      {/* Add Transaction & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <div className="lg:col-span-1 glass-panel p-6 sm:p-8 h-fit border border-white/5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-2xl font-bold mb-6 text-gray-100 border-b border-white/10 pb-4 flex items-center">
            <PlusCircle className="mr-2 text-blue-400" size={24} />
            {translations.addTransaction}
          </h2>
          <form onSubmit={handleAddTransaction} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Descrição</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={translations.transactionDescription} className="w-full px-4 py-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none text-white transition-all" required />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Valor</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" step="0.01" className="w-full px-4 py-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none text-white transition-all font-mono" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Tipo</label>
                  <select value={transactionType} onChange={e => setTransactionType(e.target.value as 'income' | 'expense')} className={`w-full px-4 py-3 bg-gray-900/50 rounded-lg border focus:ring-2 outline-none text-white font-medium transition-all ${transactionType === 'income' ? 'border-green-500/50 focus:ring-green-500 text-green-400' : 'border-red-500/50 focus:ring-red-500 text-red-400'}`}>
                      <option value="income" className="text-green-400">{translations.income} (+)</option>
                      <option value="expense" className="text-red-400">{translations.expense} (-)</option>
                  </select>
                </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Conta</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full px-4 py-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none text-white transition-all" required>
                <option value="" disabled>Selecione um banco</option>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Data</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none text-gray-300 transition-all" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Categoria</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-3 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none text-white transition-all">
                  <option>Alimentação</option> <option>Salário</option> <option>Transporte</option> <option>Moradia</option>
                  <option>Lazer</option> <option>Saúde</option> <option>Outros</option>
                </select>
              </div>
            </div>

            {transactionType === 'expense' && (
                <div className="pt-2">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Forma de Pagamento</label>
                    <div className="flex gap-3 bg-gray-900/50 p-1 rounded-lg border border-white/10">
                        <button type="button" onClick={() => setPaymentType('PIX')} className={`flex-1 py-2.5 rounded-md font-medium text-sm transition-all ${paymentType === 'PIX' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}>PIX / Débito</button>
                        <button type="button" onClick={() => setPaymentType('Card')} className={`flex-1 py-2.5 rounded-md font-medium text-sm transition-all ${paymentType === 'Card' ? 'bg-purple-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}>Cartão de Crédito</button>
                    </div>
                </div>
            )}
            
            <button type="submit" className="w-full btn-primary py-3.5 text-lg mt-4 shadow-blue-500/20">
              {translations.addTransaction}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="glass-panel p-6 border border-white/5 flex flex-col h-full">
                <h3 className="text-xl font-bold mb-6 text-gray-100 flex items-center border-b border-white/10 pb-4">
                  <span className="w-3 h-3 rounded-full bg-blue-500 mr-3"></span>
                  Despesas: {translations.pix}
                </h3>
                <div className="flex-grow flex items-center justify-center">
                  {pixExpenses.length > 0 ? <CategoryChart transactions={pixExpenses} /> : <p className="text-gray-500 italic text-sm">Sem dados no período</p>}
                </div>
            </div>
            <div className="glass-panel p-6 border border-white/5 flex flex-col h-full">
                <h3 className="text-xl font-bold mb-6 text-gray-100 flex items-center border-b border-white/10 pb-4">
                  <span className="w-3 h-3 rounded-full bg-purple-500 mr-3"></span>
                  Despesas: {translations.card}
                </h3>
                <div className="flex-grow flex items-center justify-center">
                  {cardExpenses.length > 0 ? <CategoryChart transactions={cardExpenses} /> : <p className="text-gray-500 italic text-sm">Sem dados no período</p>}
                </div>
            </div>
        </div>
      </div>

      {/* Future Expenses */}
      {futureExpenses.length > 0 && (
        <div className="mb-10 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <h2 className="text-2xl font-bold mb-6 text-gray-100 flex items-center">
            <CreditCard className="mr-3 text-yellow-500" /> {translations.futureExpenses} 
            <span className="ml-3 text-sm bg-yellow-500/20 text-yellow-400 py-1 px-3 rounded-full font-medium border border-yellow-500/30">Faturas de Cartão</span>
          </h2>
          <div className="glass-panel border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-gray-400 text-sm uppercase tracking-wider">
                    <th className="p-4 font-medium">Descrição</th>
                    <th className="p-4 font-medium">Categoria</th>
                    <th className="p-4 font-medium text-right">Valor</th>
                    <th className="p-4 font-medium text-center">Ação</th>
                    <th className="p-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {futureExpenses.map(expense => (
                    <tr key={expense.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-4">
                        <p className="font-semibold text-gray-200">{expense.description}</p>
                        <p className="text-xs text-gray-500 mt-1">{new Date(expense.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs rounded-full font-medium">{expense.category}</span>
                      </td>
                      <td className="p-4 text-right font-mono text-red-400 font-medium">
                        {parseFloat(expense.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => openPayModal(expense)} className="bg-green-500/20 hover:bg-green-500/40 text-green-400 border border-green-500/30 hover:border-green-500/50 font-bold py-1.5 px-4 rounded-lg transition-colors text-sm">
                          {translations.pay}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleDelete(expense.id)} className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="animate-slide-up" style={{ animationDelay: '0.4s' }}>
        <h2 className="text-2xl font-bold mb-6 text-gray-100 flex items-center">
          <ArrowRightLeft className="mr-3 text-blue-400" /> {translations.recentTransactions}
        </h2>
        <div className="glass-panel border border-white/5 overflow-hidden">
          {currentTransactions.length > 0 ? (
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
                  {currentTransactions.map(t => {
                    const isExpense = parseFloat(t.amount) < 0;
                    return (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-4">
                          <p className="font-semibold text-gray-200">{t.description}</p>
                          <p className="text-xs text-gray-500 mt-1">{new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 text-xs rounded-full font-medium border ${t.payment_type === 'PIX' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-purple-500/20 text-purple-300 border-purple-500/30'}`}>
                            {t.category}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <p className={`font-mono font-bold text-lg ${isExpense ? 'text-red-400' : 'text-green-400'}`}>
                            {isExpense ? '' : '+'}{parseFloat(t.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 flex justify-end items-center gap-1">
                            <Wallet size={12} /> {t.account_name}
                          </p>
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleDelete(t.id)} className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
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
              <ArrowRightLeft size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg">Nenhuma transação registrada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinanceManager;