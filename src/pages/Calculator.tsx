import { useState, useMemo } from 'react';
import { useLanguage } from "../context/LanguageContext.tsx";
import { Categoria, Dados, ItemData } from "../types/calculator.types.ts";

const Calculator = () => {
    const { translations } = useLanguage();
    const [categoria, setCategoria] = useState<Categoria>('armas');
    const [quantidade, setQuantidade] = useState(1);

    const dadosBase: Dados = {
        'farm': { 'Aço': { preco: 300 }, 'Metal': { preco: 300 }, 'Pólvora': { preco: 300 }, 'Papel': { preco: 100 }, 'Agentes de Drogas': { preco: 75 } },
        'armas': { 'Five-Seven': { min: 59805, max: 66450 }, 'MP5': { min: 89910, max: 99900 }, 'AKS': { min: 99225, max: 110250 }, 'TEC-9': { min: 93285, max: 103650 }, 'M60': { min: 89910, max: 99900 }, 'M4A1': { min: 99225, max: 110250 }, 'Micro Uzi': { min: 93285, max: 103650 }, 'MTAR-21': { min: 95100, max: 120000 }, 'MPH': { min: 146745, max: 163050 }, 'AK-47': { min: 131760, max: 146400 }, 'G3-MK2': { min: 147841, max: 164268 }, 'Parafal': { min: 147841, max: 164268 }, 'Remington': { min: 93285, max: 103650 } },
        'municoes': { 'Five-Seven': { min: 5467, max: 6075 }, 'MP5': { min: 4950, max: 5250 }, 'AKS': { min: 6142, max: 6825 }, 'TEC-9': { min: 5332, max: 5925 }, 'M60': { min: 6142, max: 6825 }, 'M4A1': { min: 6142, max: 6825 }, 'Micro Uzi': { min: 5332, max: 5925 }, 'MTAR-21': { min: 6547, max: 7275 }, 'MPH': { min: 6547, max: 7275 }, 'AK-47': { min: 6547, max: 7275 }, 'G3-MK2': { min: 8100, max: 9000 }, 'Parafal': { min: 8100, max: 9000 }, 'Sniper': { min: 215325, max: 239250 }, 'Remington': { min: 6547, max: 7275 }, 'Glock': { min: 4522, max: 5025 } },
        'drogas': { 'Metafetamina': { min: 300, max: 350 }, 'Cocaína': { min: 300, max: 350 }, 'Maconha': { min: 300, max: 350 }, 'LSD': { min: 300, max: 350 } },
        'contrabando': { 'Algemas': { min: 6075, max: 6750 }, 'Capuz': { min: 6075, max: 6750 }, 'Colete': { min: 7290, max: 8100 }, 'Gás Lacrimogênio': { min: 10125, max: 11250 }, 'Lockpick': { min: 6075, max: 6750 }, 'Mochila Reforçada': { min: 10125, max: 11250 }, 'Pendrive': { min: 8100, max: 9000 }, 'Rastreador': { min: 20250, max: 22500 }, 'Silenciador': { min: 20250, max: 22500 }, 'Ticket': { min: 3240, max: 3600 }, 'Masterpick': { min: 8100, max: 9000 }, 'Energético': { min: 900, max: 1000 } },
        'servicos': {}
    };

    const dadosProcessados = useMemo(() => {
        const newDados = JSON.parse(JSON.stringify(dadosBase)) as Dados;
        for (const key in newDados.municoes) {
            newDados.municoes[key].min /= 20;
            newDados.municoes[key].max /= 20;
        }
        return newDados;
    }, [dadosBase]);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const itensDaCategoria = useMemo(() => {
        if (!categoria) return [];
        return Object.entries(dadosProcessados[categoria] as Record<string, ItemData>);
    }, [categoria, dadosProcessados]);

    return (
        <div className="bg-gray-800 rounded-lg p-8 w-full max-w-6xl mx-auto my-8 border border-yellow-500 shadow-xl">
            <h1 className="text-3xl font-bold mb-6 text-yellow-500 text-center">{translations.calculatorTitle} (FIVEM)</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="md:col-span-2">
                    <label htmlFor="categoria" className="block text-sm font-medium text-gray-400 mb-1">{translations.itemCategory}</label>
                    <select
                        id="categoria"
                        value={categoria}
                        onChange={(e) => setCategoria(e.target.value as Categoria)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    >
                        <option value="armas">{translations.weapons}</option>
                        <option value="municoes">{translations.ammunition}</option>
                        <option value="drogas">{translations.drugs}</option>
                        <option value="contrabando">{translations.contraband}</option>
                        <option value="farm">{translations.farm}</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="quantidade" className="block text-sm font-medium text-gray-400 mb-1">{translations.quantity}</label>
                    <input
                        type="number"
                        id="quantidade"
                        value={quantidade}
                        onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-gray-700 rounded-lg">
                    <thead>
                        <tr className="bg-gray-900">
                            <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-yellow-500">{translations.item}</th>
                            <th className="text-right py-3 px-4 uppercase font-semibold text-sm text-yellow-500">{translations.unitPriceWithPartnership}</th>
                            <th className="text-right py-3 px-4 uppercase font-semibold text-sm text-yellow-500">{translations.unitPriceWithoutPartnership}</th>
                            <th className="text-right py-3 px-4 uppercase font-semibold text-sm text-yellow-500">{translations.totalWithPartnership}</th>
                            <th className="text-right py-3 px-4 uppercase font-semibold text-sm text-yellow-500">{translations.totalWithoutPartnership}</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-300">
                        {itensDaCategoria.map(([nome, dados]) => {
                            const precoComParceria = 'min' in dados ? dados.min : null;
                            const precoSemParceria = 'max' in dados ? dados.max : ('preco' in dados ? dados.preco : null);

                            return (
                                <tr key={nome} className="border-b border-gray-800 hover:bg-gray-600">
                                    <td className="text-left py-3 px-4">{nome}</td>
                                    <td className="text-right py-3 px-4 font-mono">{precoComParceria ? formatCurrency(precoComParceria) : 'N/A'}</td>
                                    <td className="text-right py-3 px-4 font-mono">{precoSemParceria ? formatCurrency(precoSemParceria) : 'N/A'}</td>
                                    <td className="text-right py-3 px-4 font-mono font-bold text-yellow-400">{precoComParceria ? formatCurrency(precoComParceria * quantidade) : 'N/A'}</td>
                                    <td className="text-right py-3 px-4 font-mono font-bold text-yellow-400">{precoSemParceria ? formatCurrency(precoSemParceria * quantidade) : 'N/A'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Calculator;
