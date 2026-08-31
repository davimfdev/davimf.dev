import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Trash2, PlusCircle, ArrowRightLeft, DollarSign, Wallet, CreditCard, PiggyBank, Loader2, Tag, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import CategoryChart from '../components/CategoryChart';

// --- Types ---
interface Account { id: number; name: string; currency: string; type: string; initial_balance: string; }
interface Transaction { id: number; description: string; amount: string; category: string; date: string; account_id: number; account_name: string; payment_type: 'PIX' | 'Card'; is_paid?: boolean; }

// --- Modals Secundários (Transfer e AddAccount já ajustados para o estilo) ---
const TransferModal: React.FC<{ isOpen: boolean; onClose: () => void; onTransferCompleted: any; accounts: Account[]; token: string; }> = ({ isOpen, onClose, onTransferCompleted, accounts, token }) => {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId || !amount) return;
    setLoading(true);
    try {
      await fetch('/api/getTransactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fromAccountId, toAccountId, amount, type: 'transfer' }),
      });
      onTransferCompleted();
      onClose();
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
        <div className="glass-panel p-8 w-full max-w-md border border-line-strong animate-slide-up">
          <h2 className="text-2xl font-bold mb-6 text-fg flex items-center"><ArrowRightLeft className="mr-3 text-accent" /> Transferir entre Contas</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)} className="w-full p-3 bg-surface-1/50 rounded-lg border border-line text-fg outline-none">
              <option value="">Sair de (Origem)</option>
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
            <select value={toAccountId} onChange={e => setToAccountId(e.target.value)} className="w-full p-3 bg-surface-1/50 rounded-lg border border-line text-fg outline-none">
              <option value="">Entrar em (Destino)</option>
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Valor R$" className="w-full p-3 bg-surface-1/50 rounded-lg border border-line text-fg outline-none" />
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 text-fg-muted">Cancelar</button>
              <button type="submit" className="bg-accent px-6 py-2 rounded-lg text-bg font-bold">{loading ? 'Processando...' : 'Confirmar Transferência'}</button>
            </div>
          </form>
        </div>
      </div>
  );
};

const AddAccountModal: React.FC<{ isOpen: boolean; onClose: () => void; onAccountAdded: any; token: string; }> = ({ isOpen, onClose, onAccountAdded, token }) => {
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/getAccounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, initial_balance: initialBalance, type: 'Corrente' }),
      });
      if (response.ok) { onAccountAdded(); onClose(); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
        <div className="glass-panel p-8 w-full max-w-md border border-line-strong animate-slide-up">
          <h2 className="text-2xl font-bold mb-6 text-fg flex items-center"><Wallet className="mr-3 text-accent" /> Nova Conta Bancária</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome do Banco (Ex: Nubank)" className="w-full p-3 bg-surface-1/50 rounded-lg border border-line text-fg outline-none" required />
            <input type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="Saldo Inicial" className="w-full p-3 bg-surface-1/50 rounded-lg border border-line text-fg outline-none" />
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 text-fg-muted">Cancelar</button>
              <button type="submit" className="bg-accent px-6 py-2 rounded-lg text-bg font-bold">{loading ? 'Salvando...' : 'Adicionar Banco'}</button>
            </div>
          </form>
        </div>
      </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const FinanceManager: React.FC = () => {
  const { translations } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Estados do Modal de Confirmação Customizado
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Alimentação');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('discord_token');

  const loadData = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const [accRes, transRes] = await Promise.all([
        fetch('/api/getAccounts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/getTransactions', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (accRes.ok) setAccounts(await accRes.json());
      if (transRes.ok) setTransactions(await transRes.json());
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !accountId || !token) return;
    const finalAmount = transactionType === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));
    try {
      const response = await fetch('/api/getTransactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          description, amount: finalAmount, category, date, account_id: parseInt(accountId),
          payment_type: 'PIX', is_paid: true
        }),
      });
      if (response.ok) { setDescription(''); setAmount(''); loadData(); }
    } catch (err) { console.error(err); }
  };

  // REGRAS DE EXCLUSÃO COM MODAL CUSTOM
  const triggerDeleteTransaction = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Transação?',
      message: 'Esta ação removerá o registro financeiro permanentemente.',
      onConfirm: async () => {
        await fetch('/api/getTransactions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ id }),
        });
        loadData();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const triggerDeleteAccount = (id: number, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remover Banco?',
      message: `Ao excluir o banco "${name}", todas as transações vinculadas serão perdidas.`,
      onConfirm: async () => {
        const response = await fetch('/api/getAccounts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ id }),
        });
        if (response.ok) loadData();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const totalBalance = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + parseFloat(curr.initial_balance), 0) +
        transactions.filter(t => t.is_paid).reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
  }, [accounts, transactions]);

  if (!token) return <div className="text-fg p-20 text-center">Login necessário via Discord.</div>;
  if (loading) return <div className="text-center p-20"><Loader2 className="animate-spin text-accent mx-auto" size={40}/></div>;

  return (
      <div className="max-w-7xl mx-auto p-4 animate-fade-in relative z-10">
        <AddAccountModal isOpen={isAccountModalOpen} token={token} onClose={() => setIsAccountModalOpen(false)} onAccountAdded={loadData} />
        <TransferModal isOpen={isTransferModalOpen} token={token} accounts={accounts} onClose={() => setIsTransferModalOpen(false)} onTransferCompleted={loadData} />

        {/* MODAL DE CONFIRMAÇÃO CUSTOMIZADO */}
        <ConfirmModal
            isOpen={confirmModal.isOpen}
            title={confirmModal.title}
            message={confirmModal.message}
            onConfirm={confirmModal.onConfirm}
            onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        />

        <h1 className="text-4xl font-extrabold text-center text-gradient mb-10">Gerenciador Financeiro</h1>

        <div className="mb-10 p-8 glass-panel border border-line shadow-xl animate-slide-up">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h2 className="text-2xl font-bold text-fg flex items-center"><DollarSign className="text-ok mr-2" /> Saldo Consolidado</h2>
            <div className="flex gap-3">
              <button onClick={() => setIsTransferModalOpen(true)} className="btn-secondary px-4 py-2 text-xs flex items-center gap-2 border border-line rounded-lg hover:bg-surface-2 transition-all"><ArrowRightLeft size={14}/> Transferir</button>
              <button onClick={() => setIsAccountModalOpen(true)} className="btn-primary px-4 py-2 text-xs flex items-center gap-2 rounded-lg font-bold"><PlusCircle size={14}/> Novo Banco</button>
            </div>
          </div>
          <div className="text-center py-8 bg-surface-1/40 rounded-2xl border border-line shadow-inner mb-8">
            <p className="text-5xl md:text-6xl font-black text-fg">{totalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map(acc => {
              const individualBalance = parseFloat(acc.initial_balance) +
                  transactions.filter(t => t.account_id === acc.id && t.is_paid)
                      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
              return (
                  <div key={acc.id} className="bg-surface-1 border border-line p-5 rounded-xl flex justify-between items-center hover:bg-surface-2 transition-all group relative">
                    <div>
                      <p className="text-fg-muted text-[10px] font-black uppercase tracking-widest mb-1">{acc.name}</p>
                      <p className="text-xl font-mono text-fg">{individualBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => triggerDeleteAccount(acc.id, acc.name)} className="p-2 text-fg-muted hover:text-danger transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                      <Wallet size={18} className="text-accent/30" />
                    </div>
                  </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          <div className="lg:col-span-1 glass-panel p-6 border border-line flex flex-col">
            <h3 className="text-xl font-bold mb-6 text-fg flex items-center border-b border-line pb-4"><PlusCircle className="mr-2 text-accent" /> Registrar Movimento</h3>
            <form onSubmit={handleAddTransaction} className="space-y-4 flex-grow">
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição" className="w-full p-3 bg-surface-1/50 border border-line rounded-lg text-fg outline-none focus:border-accent transition-all" required />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Valor R$" className="w-full p-3 bg-surface-1/50 border border-line rounded-lg text-fg font-mono" required />
                <select value={transactionType} onChange={e => setTransactionType(e.target.value as any)} className="w-full p-3 bg-surface-1/50 border border-line rounded-lg font-bold outline-none text-fg">
                  <option value="expense">Despesa (-)</option>
                  <option value="income">Receita (+)</option>
                </select>
              </div>
              <div className="space-y-4">
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 bg-surface-1/50 border border-line rounded-lg text-fg">
                  <option>Alimentação</option> <option>Salário</option> <option>Transporte</option> <option>Lazer</option> <option>Saúde</option> <option>Outros</option>
                </select>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full p-3 bg-surface-1/50 border border-line rounded-lg text-fg" required>
                  <option value="">Selecione o Banco...</option>
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full btn-primary py-4 font-bold text-lg mt-4 shadow-lg shadow-accent/10">Registrar</button>
            </form>
          </div>

          <div className="lg:col-span-2 glass-panel p-6 border border-line flex flex-col min-h-[450px] animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="text-xl font-bold mb-6 text-fg flex items-center border-b border-line pb-4"><Tag className="mr-3 text-ok" /> Distribuição de Gastos</h3>
            <div className="relative flex-1 w-full min-h-0">
              {transactions.length > 0 ? (
                  <CategoryChart transactions={transactions.filter(t => parseFloat(t.amount) < 0 && t.category !== 'Transferência')} />
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-fg-muted italic space-y-4"><PiggyBank size={48} className="opacity-20" /><p>Sem despesas registradas.</p></div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel border border-line overflow-hidden shadow-2xl animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-1 text-fg-muted text-[10px] font-black uppercase tracking-widest border-b border-line">
              <tr><th className="p-5">Descrição / Data</th><th className="p-5">Categoria</th><th className="p-5 text-right">Valor</th><th className="p-5 text-right">Ação</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
              {[...transactions].sort((a,b) => b.id - a.id).map(t => (
                  <tr key={t.id} className="hover:bg-surface-1 transition-all group">
                    <td className="p-5">
                      <p className="font-bold text-fg">{t.description}</p>
                      <p className="text-[10px] text-fg-muted flex items-center gap-1 mt-1 font-mono"><CalendarIcon size={10}/> {new Date(t.date).toLocaleDateString('pt-BR')}</p>
                    </td>
                    <td className="p-5"><span className="px-3 py-1 bg-surface-1 rounded-full text-[10px] text-fg-muted border border-line font-medium">{t.category}</span></td>
                    <td className={`p-5 text-right font-mono font-bold text-lg ${parseFloat(t.amount) < 0 ? 'text-danger' : 'text-ok'}`}>{parseFloat(t.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="p-5 text-right">
                      <button onClick={() => triggerDeleteTransaction(t.id)} className="p-2 text-fg-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                    </td>
                  </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
};

// --- MODAL DE CONFIRMAÇÃO ---
const ConfirmModal: React.FC<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; }> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-[100] p-4 animate-fade-in">
        <div className="glass-panel p-8 w-full max-w-sm border border-line-strong shadow-2xl animate-slide-up text-center">
          <div className="w-16 h-16 bg-danger/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-danger/30">
            <AlertCircle size={32} className="text-danger" />
          </div>
          <h3 className="text-2xl font-bold text-fg mb-2">{title}</h3>
          <p className="text-fg-muted mb-8 leading-relaxed">{message}</p>
          <div className="flex flex-col gap-3">
            <button onClick={onConfirm} className="w-full py-3 bg-danger hover:bg-danger text-fg font-bold rounded-xl transition-all shadow-lg shadow-danger/20">Confirmar Exclusão</button>
            <button onClick={onCancel} className="w-full py-3 bg-surface-1 hover:bg-surface-2 text-fg-muted font-medium rounded-xl transition-all">Cancelar</button>
          </div>
        </div>
      </div>
  );
};

export default FinanceManager;
