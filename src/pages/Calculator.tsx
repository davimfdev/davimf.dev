import { useState, useMemo } from 'react';
import { Produto, ItemCalculo } from '../types/calculator.types';

const PRODUTOS: Produto[] = [
    { nome: "Five-Seven", valorComParceria: 60000.00, valorSemParceria: 66000.00, polvora: 131, dinheiro: 4000 },
    { nome: "G36-MK2", valorComParceria: 150000.00, valorSemParceria: 164000.00, polvora: 365, dinheiro: 10000 },
    { nome: "AK-47", valorComParceria: 135000.00, valorSemParceria: 146000.00, polvora: 292, dinheiro: 8000 },
    { nome: "Mtar", valorComParceria: 100000.00, valorSemParceria: 120000.00, polvora: 256, dinheiro: 8000 },
    { nome: "Ramington", valorComParceria: 100000.00, valorSemParceria: 103000.00, polvora: 197, dinheiro: 8000 },
    { nome: "Munição Five", valorComParceria: 278.35 * 20, valorSemParceria: 303.08 * 20, polvora: 11, dinheiro: 600 },
    { nome: "Munição AKS", valorComParceria: 307.10 * 20, valorSemParceria: 341.25 * 20, polvora: 11, dinheiro: 1000 },
    { nome: "Munição M4A1", valorComParceria: 307.1 * 20, valorSemParceria: 341.25 * 20, polvora: 11, dinheiro: 1000 },
    { nome: "Munição Remington", valorComParceria: 327.35 * 20, valorSemParceria: 363.75 * 20, polvora: 12, dinheiro: 1000 },
    { nome: "Munição Glock", valorComParceria: 226.1 * 20, valorSemParceria: 251.25 * 20, polvora: 7, dinheiro: 1000 },
    { nome: "Munição Sniper", valorComParceria: 10776.00 * 20, valorSemParceria: 11962.00 * 20, polvora: 365, dinheiro: 40000 },
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
        const totalComissao = totalVenda * 0.25;

        return { totalPolvora, totalDinheiro, totalVenda, totalComissao };
    }, [itens, comParceria]);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
    
    const formatNumber = (value: number) => {
        return value.toLocaleString('pt-BR');
    };

    return (
        <div className="bg-gray-800 rounded-lg p-8 w-full max-w-4xl mx-auto my-8 border border-yellow-500 shadow-xl text-white">
            <h1 className="text-3xl font-bold mb-6 text-yellow-500 text-center">Calculadora de Produção</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-700 rounded-lg">
                <div className="md:col-span-2">
                    <label htmlFor="produto" className="block text-sm font-medium text-gray-300 mb-1">Produto</label>
                    <select
                        id="produto"
                        value={produtoSelecionado.nome}
                        onChange={(e) => setProdutoSelecionado(PRODUTOS.find(p => p.nome === e.target.value) || PRODUTOS[0])}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    >
                        {PRODUTOS.map(p => <option key={p.nome} value={p.nome}>{p.nome}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="quantidade" className="block text-sm font-medium text-gray-300 mb-1">Quantidade</label>
                    <input
                        type="number"
                        id="quantidade"
                        value={quantidade}
                        onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    />
                </div>
                <div className="md:col-span-3 text-center">
                    <button
                        onClick={handleAddProduto}
                        className="w-full md:w-auto bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-6 rounded-lg transition-colors"
                    >
                        Adicionar Produto
                    </button>
                </div>
            </div>

            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">Itens Adicionados</h2>
                {itens.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">Nenhum item adicionado ainda.</p>
                ) : (
                    <ul className="space-y-2">
                        {itens.map(item => (
                            <li key={item.produto.nome} className="flex justify-between items-center bg-gray-700 p-3 rounded-md">
                                <div>
                                    <span className="font-bold">{item.produto.nome}</span>
                                    <span className="text-gray-400"> x {item.quantidade}</span>
                                </div>
                                <button onClick={() => handleRemoveItem(item.produto.nome)} className="text-red-500 hover:text-red-400 font-bold">
                                    Remover
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-4 text-yellow-400">Resumo do Cálculo</h2>
                <div className="bg-gray-700 p-4 rounded-lg space-y-4">
                    <div className="flex items-center justify-center space-x-4 mb-4">
                        <span className={`font-bold ${!comParceria ? 'text-yellow-400' : 'text-gray-400'}`}>Sem Parceria</span>
                        <label htmlFor="parceria-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="parceria-toggle" className="sr-only peer" checked={comParceria} onChange={() => setComParceria(!comParceria)} />
                            <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-yellow-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                        </label>
                        <span className={`font-bold ${comParceria ? 'text-yellow-400' : 'text-gray-400'}`}>Com Parceria</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-lg">
                        <div className="bg-gray-800 p-4 rounded-md">
                            <p className="text-gray-400">Total de Pólvora Usada:</p>
                            <p className="font-bold text-xl">{formatNumber(calculos.totalPolvora)}</p>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-md">
                            <p className="text-gray-400">Total de Dinheiro Usado:</p>
                            <p className="font-bold text-xl">{formatCurrency(calculos.totalDinheiro)}</p>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-md">
                            <p className="text-gray-400">Total a Cobrar do Cliente:</p>
                            <p className="font-bold text-xl text-green-400">{formatCurrency(calculos.totalVenda)}</p>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-md">
                            <p className="text-gray-400">Comissão (25%):</p>
                            <p className="font-bold text-xl text-blue-400">{formatCurrency(calculos.totalComissao)}</p>
                        </div>
                    </div>
                     {itens.length > 0 && (
                        <div className="text-center mt-4">
                            <button
                                onClick={() => setItens([])}
                                className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
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
