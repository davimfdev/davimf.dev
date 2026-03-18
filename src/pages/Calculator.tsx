import { useState, useMemo } from 'react';
import { Produto, ItemCalculo } from '../types/calculator.types';

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
        <div className="glass-panel p-8 w-full max-w-4xl mx-auto my-12 border-t-4 border-t-yellow-500 shadow-2xl animate-fade-in relative z-10">
            <h1 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 text-center">Calculadora de Produção</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-6 bg-white/5 rounded-xl border border-white/10 shadow-inner animate-slide-up">
                <div className="md:col-span-2">
                    <label htmlFor="produto" className="block text-sm font-semibold text-gray-300 mb-2">Produto</label>
                    <select
                        id="produto"
                        value={produtoSelecionado.nome}
                        onChange={(e) => setProdutoSelecionado(PRODUTOS.find(p => p.nome === e.target.value) || PRODUTOS[0])}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-white cursor-pointer transition-all"
                    >
                        {PRODUTOS.map(p => <option key={p.nome} value={p.nome}>{p.nome}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="quantidade" className="block text-sm font-semibold text-gray-300 mb-2">Quantidade</label>
                    <input
                        type="number"
                        id="quantidade"
                        value={quantidade}
                        onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        className="w-full px-4 py-3 bg-gray-900/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-white transition-all"
                    />
                </div>
                <div className="md:col-span-3 text-center mt-2">
                    <button
                        onClick={handleAddProduto}
                        className="w-full md:w-auto bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-gray-900 font-bold py-3 px-8 rounded-lg transition-all transform hover:-translate-y-1 shadow-lg shadow-yellow-500/20"
                    >
                        Adicionar Produto
                    </button>
                </div>
            </div>

            <div className="mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <h2 className="text-2xl font-bold mb-4 text-yellow-500">Itens Adicionados</h2>
                {itens.length === 0 ? (
                    <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center bg-white/5">
                        <p className="text-gray-400 text-lg">Nenhum item adicionado ainda.</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {itens.map((item, index) => (
                            <li key={item.produto.nome} className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition-colors animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 bg-yellow-500/20 rounded-lg flex items-center justify-center border border-yellow-500/30">
                                        <span className="text-yellow-500 font-bold text-sm">x{item.quantidade}</span>
                                    </div>
                                    <span className="font-bold text-lg text-gray-100">{item.produto.nome}</span>
                                </div>
                                <button onClick={() => handleRemoveItem(item.produto.nome)} className="text-red-400 hover:text-red-300 font-medium px-3 py-1 rounded-lg hover:bg-red-400/10 transition-colors">
                                    Remover
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <h2 className="text-2xl font-bold mb-6 text-yellow-500">Resumo do Cálculo</h2>
                <div className="bg-white/5 border border-white/10 p-6 rounded-xl space-y-6 shadow-inner">
                    <div className="flex items-center justify-center space-x-6 p-4 bg-gray-900/50 rounded-lg border border-white/5">
                        <span className={`font-semibold transition-colors ${!comParceria ? 'text-yellow-400' : 'text-gray-500'}`}>Sem Parceria</span>
                        <label htmlFor="parceria-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="parceria-toggle" className="sr-only peer" checked={comParceria} onChange={() => setComParceria(!comParceria)} />
                            <div className="w-14 h-7 bg-gray-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-yellow-500/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                        </label>
                        <span className={`font-semibold transition-colors ${comParceria ? 'text-yellow-400' : 'text-gray-500'}`}>Com Parceria</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-gray-900/50 p-5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                            <p className="text-gray-400 text-sm font-medium mb-1">Total de Pólvora Usada</p>
                            <p className="font-bold text-2xl text-gray-100">{formatNumber(calculos.totalPolvora)}</p>
                        </div>
                        <div className="bg-gray-900/50 p-5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                            <p className="text-gray-400 text-sm font-medium mb-1">Total de Dinheiro Usado</p>
                            <p className="font-bold text-2xl text-gray-100">{formatCurrency(calculos.totalDinheiro)}</p>
                        </div>
                        <div className="bg-gray-900/50 p-5 rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
                            <p className="text-green-400/80 text-sm font-medium mb-1">Total a Cobrar do Cliente</p>
                            <p className="font-bold text-2xl text-green-400">{formatCurrency(calculos.totalVenda)}</p>
                        </div>
                        <div className="bg-gray-900/50 p-5 rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
                            <p className="text-blue-400/80 text-sm font-medium mb-1">Comissão (20%)</p>
                            <p className="font-bold text-2xl text-blue-400">{formatCurrency(calculos.totalComissao)}</p>
                        </div>
                        <div className="bg-gray-900/50 p-6 rounded-xl sm:col-span-2 border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                            <p className="text-purple-400/80 text-sm font-medium mb-1 uppercase tracking-wider">Total para Facção</p>
                            <p className="font-extrabold text-4xl text-purple-400">{formatCurrency(calculos.totalFaccao)}</p>
                        </div>
                    </div>
                     {itens.length > 0 && (
                        <div className="text-center pt-6 border-t border-white/10 mt-6">
                            <button
                                onClick={() => setItens([])}
                                className="px-6 py-2 rounded-lg font-medium text-red-400 hover:text-white hover:bg-red-500 border border-red-500/30 hover:border-red-500 transition-all"
                            >
                                Limpar Tudo
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Calculator;