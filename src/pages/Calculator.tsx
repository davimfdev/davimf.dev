import { useState, useMemo } from 'react';
import { Produto, ItemCalculo } from '../types/calculator.types';
import { useLanguage } from '../context/LanguageContext';

const PRODUTOS: Produto[] = [
    { nome: "Five-Seven", valorComParceria: 278.35, valorSemParceria: 303.08, polvora: 11 / 20, dinheiro: 600 / 20 },
    { nome: "Glock", valorComParceria: 226.1, valorSemParceria: 251.25, polvora: 7 / 20, dinheiro: 1000 / 20 },
    { nome: "AKS", valorComParceria: 307.10, valorSemParceria: 341.25, polvora: 11 / 20, dinheiro: 1000 / 20 },
    { nome: "M4A1", valorComParceria: 307.1, valorSemParceria: 341.25, polvora: 11 / 20, dinheiro: 1000 / 20 },
    { nome: "Remington", valorComParceria: 327.35, valorSemParceria: 363.75, polvora: 12 / 20, dinheiro: 1000 / 20 },
    { nome: "G36", valorComParceria: 405.00, valorSemParceria: 450.00, polvora: 15 / 20, dinheiro: 1200},
    { nome: "Sniper", valorComParceria: 10776.00, valorSemParceria: 11962.00, polvora: 365 / 20, dinheiro: 40000 / 20 },
    { nome: "Maconha", valorComParceria: 320.00, valorSemParceria: 350.00, polvora: 2, dinheiro: 0 },
];

const Calculator = () => {
    const { translations } = useLanguage();
    const [itens, setItens] = useState<ItemCalculo[]>([]);
    const [produtoSelecionado, setProdutoSelecionado] = useState<Produto>(PRODUTOS[0]);
    const [quantidade, setQuantidade] = useState(1);
    const [comParceria, setComParceria] = useState(true);

    const handleAddProduto = () => {
        if (!produtoSelecionado || quantidade <= 0) return;

        const itemExistenteIndex = itens.findIndex(item => item.produto.nome === produtoSelecionado.nome);

        if (itemExistenteIndex > -1) {
            const novosItens = [...itens];
            novosItens[itemExistenteIndex].quantidade += quantidade;
            setItens(novosItens);
        } else {
            setItens([...itens, { produto: produtoSelecionado, quantidade }]);
        }
        setQuantidade(1);
    };
    
    const handleRemoveItem = (nomeProduto: string) => {
        setItens(itens.filter(item => item.produto.nome !== nomeProduto));
    };

    const calculos = useMemo(() => {
        const totalPolvora = itens.reduce((acc, item) => acc + (item.produto.polvora * item.quantidade), 0);
        const totalDinheiro = itens.reduce((acc, item) => acc + (item.produto.dinheiro * item.quantidade), 0);
        const totalVenda = itens.reduce((acc, item) => {
            const valor = comParceria ? item.produto.valorComParceria : item.produto.valorSemParceria;
            return acc + (valor * item.quantidade);
        }, 0);
        const totalComissao = totalVenda * 0.20;
        const totalFaccao = totalVenda - totalComissao;

        return { totalPolvora, totalDinheiro, totalVenda, totalComissao, totalFaccao };
    }, [itens, comParceria]);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
    
    const formatNumber = (value: number) => {
        return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    };

    return (
        <div className="glass-panel p-8 w-full max-w-4xl mx-auto my-12 border-t-4 border-t-warn shadow-2xl animate-fade-in relative z-10">
            <h1 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-warn to-warn text-center">{translations.calculatorTitle}</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-6 bg-surface-1 rounded-xl border border-line shadow-inner animate-slide-up">
                <div className="md:col-span-2">
                    <label htmlFor="produto" className="block text-sm font-semibold text-fg-muted mb-2">{translations.calculatorProduct}</label>
                    <select
                        id="produto"
                        value={produtoSelecionado.nome}
                        onChange={(e) => setProdutoSelecionado(PRODUTOS.find(p => p.nome === e.target.value) || PRODUTOS[0])}
                        className="w-full px-4 py-3 bg-surface-1/50 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-warn text-fg cursor-pointer transition-all"
                    >
                        {PRODUTOS.map(p => <option key={p.nome} value={p.nome}>{p.nome}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="quantidade" className="block text-sm font-semibold text-fg-muted mb-2">{translations.quantity}</label>
                    <input
                        type="number"
                        id="quantidade"
                        value={quantidade}
                        onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        className="w-full px-4 py-3 bg-surface-1/50 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-warn text-fg transition-all"
                    />
                </div>
                <div className="md:col-span-3 text-center mt-2">
                    <button
                        onClick={handleAddProduto}
                        className="w-full md:w-auto bg-gradient-to-r from-warn to-warn hover:from-warn hover:to-warn text-bg font-bold py-3 px-8 rounded-lg transition-all transform hover:-translate-y-1 shadow-lg shadow-warn/20"
                    >
                        {translations.calculatorAddProduct}
                    </button>
                </div>
            </div>

            <div className="mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <h2 className="text-2xl font-bold mb-4 text-warn">{translations.calculatorAddedItems}</h2>
                {itens.length === 0 ? (
                    <div className="border-2 border-dashed border-line rounded-xl p-8 text-center bg-surface-1">
                        <p className="text-fg-muted text-lg">{translations.calculatorNoItems}</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {itens.map((item, index) => (
                            <li key={item.produto.nome} className="flex justify-between items-center bg-surface-1 border border-line p-4 rounded-xl hover:bg-surface-2 transition-colors animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 bg-warn/20 rounded-lg flex items-center justify-center border border-warn/30">
                                        <span className="text-warn font-bold text-sm">x{item.quantidade}</span>
                                    </div>
                                    <span className="font-bold text-lg text-fg">{item.produto.nome}</span>
                                </div>
                                <button onClick={() => handleRemoveItem(item.produto.nome)} className="text-danger hover:text-danger font-medium px-3 py-1 rounded-lg hover:bg-danger/10 transition-colors">
                                    {translations.calculatorRemove}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <h2 className="text-2xl font-bold mb-6 text-warn">{translations.calculatorSummary}</h2>
                <div className="bg-surface-1 border border-line p-6 rounded-xl space-y-6 shadow-inner">
                    <div className="flex items-center justify-center space-x-6 p-4 bg-surface-1/50 rounded-lg border border-line">
                        <span className={`font-semibold transition-colors ${!comParceria ? 'text-warn' : 'text-fg-muted'}`}>{translations.calculatorWithoutPartnership}</span>
                        <label htmlFor="parceria-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="parceria-toggle" className="sr-only peer" checked={comParceria} onChange={() => setComParceria(!comParceria)} />
                            <div className="w-14 h-7 bg-surface-3 rounded-full peer peer-focus:ring-4 peer-focus:ring-warn/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-warn"></div>
                        </label>
                        <span className={`font-semibold transition-colors ${comParceria ? 'text-warn' : 'text-fg-muted'}`}>{translations.calculatorWithPartnership}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-surface-1/50 p-5 rounded-xl border border-line hover:border-line transition-colors">
                            <p className="text-fg-muted text-sm font-medium mb-1">{translations.calculatorGunpowder}</p>
                            <p className="font-bold text-2xl text-fg">{formatNumber(calculos.totalPolvora)}</p>
                        </div>
                        <div className="bg-surface-1/50 p-5 rounded-xl border border-line hover:border-line transition-colors">
                            <p className="text-fg-muted text-sm font-medium mb-1">{translations.calculatorMoneyUsed}</p>
                            <p className="font-bold text-2xl text-fg">{formatCurrency(calculos.totalDinheiro)}</p>
                        </div>
                        <div className="bg-surface-1/50 p-5 rounded-xl border border-ok/20 bg-gradient-to-br from-ok/5 to-transparent">
                            <p className="text-ok/80 text-sm font-medium mb-1">{translations.calculatorTotalCharge}</p>
                            <p className="font-bold text-2xl text-ok">{formatCurrency(calculos.totalVenda)}</p>
                        </div>
                        <div className="bg-surface-1/50 p-5 rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
                            <p className="text-accent/80 text-sm font-medium mb-1">{translations.calculatorCommission}</p>
                            <p className="font-bold text-2xl text-accent">{formatCurrency(calculos.totalComissao)}</p>
                        </div>
                        <div className="bg-surface-1/50 p-6 rounded-xl sm:col-span-2 border border-accent/30 bg-gradient-to-br from-accent/10 to-transparent shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                            <p className="text-accent/80 text-sm font-medium mb-1 uppercase tracking-wider">{translations.calculatorTotalFaction}</p>
                            <p className="font-extrabold text-4xl text-accent">{formatCurrency(calculos.totalFaccao)}</p>
                        </div>
                    </div>
                     {itens.length > 0 && (
                        <div className="text-center pt-6 border-t border-line mt-6">
                            <button
                                onClick={() => setItens([])}
                                className="px-6 py-2 rounded-lg font-medium text-danger hover:text-bg hover:bg-danger border border-danger/30 hover:border-danger transition-all"
                            >
                                {translations.calculatorClearAll}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Calculator;
