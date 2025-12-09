import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Trash2, PlusCircle, ArrowRightLeft } from 'lucide-react';
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
    <div className="h-8 bg-gray-700 rounded-md w-1/3 mx-auto mb-6"></div>

    {/* Overview Skeleton */}
    <div className="mb-8 p-6 bg-gray-800 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <div className="h-6 bg-gray-700 rounded-md w-1/4"></div>
        <div className="flex gap-2">
          <div className="h-10 bg-gray-700 rounded-md w-28"></div>
          <div className="h-10 bg-gray-700 rounded-md w-36"></div>
        </div>
      </div>
      <div className="text-center mb-4">
        <div className="h-10 bg-gray-700 rounded-md w-1/2 mx-auto"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-700 p-4 rounded-lg h-20"></div>
        <div className="bg-gray-700 p-4 rounded-lg h-20"></div>
        <div className="bg-gray-700 p-4 rounded-lg h-20"></div>
      </div>
    </div>

    {/* Add Transaction & Charts Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
      <div className="lg:col-span-1 bg-gray-800 p-6 rounded-lg h-fit space-y-4">
        <div className="h-6 bg-gray-700 rounded-md w-3/4"></div>
        <div className="h-10 bg-gray-700 rounded-md w-full"></div>
        <div className="h-10 bg-gray-700 rounded-md w-full"></div>
        <div className="h-10 bg-gray-700 rounded-md w-full"></div>
        <div className="h-10 bg-gray-700 rounded-md w-full"></div>
        <div className="h-10 bg-gray-700 rounded-md w-full"></div>
        <div className="h-10 bg-gray-700 rounded-md w-full"></div>
      </div>
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg h-64"></div>
        <div className="bg-gray-800 p-6 rounded-lg h-64"></div>
      </div>
    </div>

    {/* Transaction History Skeleton */}
    <div>
      <div className="h-6 bg-gray-700 rounded-md w-1/4 mb-4"></div>
      <div className="bg-gray-800 p-4 rounded-lg space-y-3">
        <div className="h-12 bg-gray-700 rounded-md w-full"></div>
        <div className="h-12 bg-gray-700 rounded-md w-full"></div>
        <div className="h-12 bg-gray-700 rounded-md w-full"></div>
        <div className="h-12 bg-gray-700 rounded-md w-full"></div>
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
        <h2 className="text-xl font-semibold mb-4">{translations.makeTransfer}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fromAccount" className="block text-sm font-medium text-gray-300 mb-1">{translations.from}</label>
            <select id="fromAccount" value={fromAccountId} onChange={e => setFromAccountId(e.target.value)} className="w-full p-2 bg-gray-700 rounded-md border border-gray-600">
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="toAccount" className="block text-sm font-medium text-gray-300 mb-1">{translations.to}</label>
            <select id="toAccount" value={toAccountId} onChange={e => setToAccountId(e.target.value)} className="w-full p-2 bg-gray-700 rounded-md border border-gray-600">
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="transferAmount" className="block text-sm font-medium text-gray-300 mb-1">{translations.amount}</label>
            <input id="transferAmount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required className="w-full p-2 bg-gray-700 rounded-md border border-gray-600" />
          </div>
          <div>
            <label htmlFor="transferDescription" className="block text-sm font-medium text-gray-300 mb-1">{translations.description}</label>
            <input id="transferDescription" type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder={translations.transferDescriptionPlaceholder} className="w-full p-2 bg-gray-700 rounded-md border border-gray-600" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-md">{translations.cancel}</button>
            <button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-md disabled:bg-purple-400">{loading ? translations.transferring : translations.transfer}</button>
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
        <h2 className="text-xl font-semibold mb-4">{translations.pay} {expense.description}</h2>
        <div className="space-y-4">
          <p>{translations.selectBankToPay}:</p>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded-md border border-gray-600"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-md">{translations.cancel}</button>
          <button onClick={handlePay} disabled={loading} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md disabled:bg-green-400">
            {loading ? 'Pagando...' : translations.pay}
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
        <h2 className="text-xl font-semibold mb-4">{translations.addBank}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="accountName" className="block text-sm font-medium text-gray-300 mb-1">{translations.bankName}</label>
            <input id="accountName" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Itaú, Wise, Reserva" required className="w-full p-2 bg-gray-700 rounded-md border border-gray-600" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="accountCurrency" className="block text-sm font-medium text-gray-300 mb-1">{translations.category}</label>
              <input id="accountCurrency" type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="Ex: BRL, USD" required className="w-full p-2 bg-gray-700 rounded-md border border-gray-600" />
            </div>
            <div>
              <label htmlFor="accountType" className="block text-sm font-medium text-gray-300 mb-1">{translations.type}</label>
              <select id="accountType" value={type} onChange={e => setType(e.target.value)} className="w-full p-2 bg-gray-700 rounded-md border border-gray-600">
                <option>Corrente</option> <option>Investimento</option> <option>Caixa</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="initialBalance" className="block text-sm font-medium text-gray-300 mb-1">{translations.initialBalance}</label>
            <input id="initialBalance" type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="0.00" required className="w-full p-2 bg-gray-700 rounded-md border border-gray-600" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-md">{translations.cancel}</button>
            <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md disabled:bg-blue-400">{loading ? 'Salvando...' : translations.add}</button>
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
  if (error) return <div className="text-center text-red-500">Erro: {error}</div>;

  return (
    <div className="max-w-7xl mx-auto p-4">
      {token && <AddAccountModal isOpen={isAccountModalOpen} token={token} onClose={() => setIsAccountModalOpen(false)} onAccountAdded={handleAccountAdded} />}
      {token && <TransferModal isOpen={isTransferModalOpen} token={token} accounts={accounts} onClose={() => setIsTransferModalOpen(false)} onTransferCompleted={handleTransferCompleted} />}
      {token && selectedExpense && <PayExpenseModal isOpen={isPayExpenseModalOpen} onClose={() => setIsPayExpenseModalOpen(false)} accounts={accounts} expense={selectedExpense} onExpensePaid={handleExpensePaid} token={token} />}

      <h1 className="text-3xl font-bold mb-6 text-center">{translations.financeManagerTitle}</h1>

      {/* Overview Section */}
      <div className="mb-8 p-6 bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{translations.totalBalance}</h2>
            <div className="flex gap-2">
              <button onClick={() => setIsTransferModalOpen(true)} disabled={accounts.length < 2} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed"><ArrowRightLeft size={20} /> {translations.transfer}</button>
              <button onClick={() => setIsAccountModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md"><PlusCircle size={20} /> {translations.addBank}</button>
            </div>
        </div>
        <div className="text-center mb-4">
            <p className="text-4xl font-bold text-green-400">{totalBalanceBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map(acc => (
                <div key={acc.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
                    <div><p className="font-bold">{acc.name}</p><p className="text-lg">{(accountBalances.get(acc.id) ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: acc.currency })}</p></div>
                    <button onClick={() => handleDelete(acc.id)} className="text-gray-500 hover:text-red-500 p-1" title={translations.delete}><Trash2 size={18} /></button>
                </div>
            ))}
        </div>
      </div>

      {/* Add Transaction & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-1 bg-gray-800 p-6 rounded-lg h-fit">
          <h2 className="text-xl font-semibold mb-4">{translations.addTransaction}</h2>
          <form onSubmit={handleAddTransaction} className="space-y-4">
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={translations.transactionDescription} className="w-full px-4 py-2 bg-gray-700 rounded-md" required />
            <div className="grid grid-cols-2 gap-4">
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={translations.amount} step="0.01" className="px-4 py-2 bg-gray-700 rounded-md" required />
                <select value={transactionType} onChange={e => setTransactionType(e.target.value as 'income' | 'expense')} className="px-4 py-2 bg-gray-700 rounded-md">
                    <option value="income">{translations.income}</option>
                    <option value="expense">{translations.expense}</option>
                </select>
            </div>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full px-4 py-2 bg-gray-700 rounded-md" required>
              <option value="">Selecione um banco</option>
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 bg-gray-700 rounded-md" required />
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2 bg-gray-700 rounded-md">
              <option>Alimentação</option> <option>Salário</option> <option>Transporte</option> <option>Moradia</option>
              <option>Lazer</option> <option>Saúde</option> <option>Outros</option>
            </select>
            {transactionType === 'expense' && (
                <div className="flex gap-2">
                    <button type="button" onClick={() => setPaymentType('PIX')} className={`w-full py-2 rounded-md ${paymentType === 'PIX' ? 'bg-sky-600' : 'bg-gray-700'}`}>{translations.pix}</button>
                    <button type="button" onClick={() => setPaymentType('Card')} className={`w-full py-2 rounded-md ${paymentType === 'Card' ? 'bg-purple-600' : 'bg-gray-700'}`}>{translations.card}</button>
                </div>
            )}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">{translations.addTransaction}</button>
          </form>
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">{translations.expenseByType} - {translations.pix}</h3>
                <CategoryChart transactions={pixExpenses} />
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">{translations.expenseByType} - {translations.card}</h3>
                <CategoryChart transactions={cardExpenses} />
            </div>
        </div>
      </div>

      {/* Future Expenses */}
      {futureExpenses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{translations.futureExpenses}</h2>
          <div className="bg-gray-800 p-4 rounded-lg">
            {futureExpenses.map(expense => (
              <div key={expense.id} className="grid grid-cols-6 gap-4 items-center border-b border-gray-700 py-3 last:border-b-0">
                <div className="col-span-2"><p className="font-semibold">{expense.description}</p><p className="text-sm text-gray-400">{new Date(expense.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p></div>
                <div className="text-center"><span className="px-2 py-1 bg-purple-700 text-xs rounded-full">{expense.category}</span></div>
                <div className="text-right font-mono text-red-400"><p>{parseFloat(expense.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                <div className="text-center">
                  <button onClick={() => openPayModal(expense)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-md">{translations.pay}</button>
                </div>
                <div className="text-right"><button onClick={() => handleDelete(expense.id)} className="text-gray-500 hover:text-red-500 p-1"><Trash2 size={18} /></button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{translations.recentTransactions}</h2>
        <div className="bg-gray-800 p-4 rounded-lg">
          {currentTransactions.length > 0 ?
            currentTransactions.map(t => (
              <div key={t.id} className="grid grid-cols-5 gap-4 items-center border-b border-gray-700 py-3 last:border-b-0">
                <div className="col-span-2"><p className="font-semibold">{t.description}</p><p className="text-sm text-gray-400">{new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p></div>
                <div className="text-center"><span className={`px-2 py-1 text-xs rounded-full ${t.payment_type === 'PIX' ? 'bg-sky-700' : 'bg-purple-700'}`}>{t.category}</span></div>
                <div className={`text-right font-mono ${parseFloat(t.amount) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  <p>{parseFloat(t.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  <p className="text-xs text-gray-400">{t.account_name}</p>
                </div>
                <div className="text-right"><button onClick={() => handleDelete(t.id)} className="text-gray-500 hover:text-red-500 p-1"><Trash2 size={18} /></button></div>
              </div>
            )) :
            <p className="text-center text-gray-400 py-4">Nenhuma transação registrada.</p>
          }
        </div>
      </div>
    </div>
  );
};

export default FinanceManager;
