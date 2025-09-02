import {useState, useEffect, useMemo, useCallback} from 'react';
import { useLanguage } from "../context/LanguageContext.tsx";
import { Categoria, Dados, ItemData, ServicoItem, Vendedor } from "../types/calculator.types.ts";

// Helper function to normalize item keys for comparison and use as value in selects
const normalizeKey = (key: string) =>
    key.toLowerCase().replace(/ /g, '-').replace(/á/g, 'a').replace(/é/g, 'e').replace(/ô/g, 'o').replace(/í/g, 'i');

const Calculator = () => {
    const { translations } = useLanguage();

    useEffect(() => {
        document.title = translations.calculatorTitle || "YKZ CALC";
    }, [translations.calculatorTitle]);

    const [vendedor, setVendedor] = useState<Vendedor>('gerente');
    const [categoria, setCategoria] = useState<Categoria>('');
    const [item, setItem] = useState('');
    const [quantidade, setQuantidade] = useState(1);
    const [parceria, setParceria] = useState(false);
    const [comissao, setComissao] = useState(false);
    const [valorTotal, setValorTotal] = useState(0);
    const [valorMembro, setValorMembro] = useState(0);
    const [valorFac, setValorFac] = useState(0);

    const dadosBase: Dados = {
        'farm': {
            'Aço': { preco: 300 },
            'Metal': { preco: 300 },
            'Pólvora': { preco: 300 },
            'Papel': { preco: 100 },
            'Agentes de Drogas': { preco: 75 }
        },
        'armas': {
            'Five-Seven': { min: 59805, max: 66450 },
            'MP5': { min: 89910, max: 99900 },
            'AKS': { min: 99225, max: 110250 },
            'TEC-9': { min: 93285, max: 103650 },
            'M60': { min: 89910, max: 99900 },
            'M4A1': { min: 99225, max: 110250 },
            'Micro Uzi': { min: 93285, max: 103650 },
            'MTAR-21': { min: 95100, max: 120000 },
            'MPH': { min: 146745, max: 163050 },
            'AK-47': { min: 131760, max: 146400 },
            'G3-MK2': { min: 147841, max: 164268 },
            'Parafal': { min: 147841, max: 164268 },
            'Remington': { min: 93285, max: 103650 }
        },
        'municoes': {
            'Five-Seven': { min: 5467, max: 6075 },
            'MP5': { min: 4950, max: 5250 },
            'AKS': { min: 6142, max: 6825 },
            'TEC-9': { min: 5332, max: 5925 },
            'M60': { min: 6142, max: 6825 },
            'M4A1': { min: 6142, max: 6825 },
            'Micro Uzi': { min: 5332, max: 5925 },
            'MTAR-21': { min: 6547, max: 7275 },
            'MPH': { min: 6547, max: 7275 },
            'AK-47': { min: 6547, max: 7275 },
            'G3-MK2': { min: 8100, max: 9000 },
            'Parafal': { min: 8100, max: 9000 },
            'Sniper': { min: 215325, max: 239250 },
            'Remington': { min: 6547, max: 7275 },
            'Glock': { min: 4522, max: 5025 }
        },
        'drogas': {
            'Metafetamina': { min: 300, max: 350 },
            'Cocaína': { min: 300, max: 350 },
            'Maconha': { min: 300, max: 350 },
            'LSD': { min: 300, max: 350 }
        },
        'contrabando': {
            'Algemas': { min: 6075, max: 6750 },
            'Capuz': { min: 6075, max: 6750 },
            'Colete': { min: 7290, max: 8100 },
            'Gás Lacrimogênio': { min: 10125, max: 11250 },
            'Lockpick': { min: 6075, max: 6750 },
            'Mochila Reforçada': { min: 10125, max: 11250 },
            'Pendrive': { min: 8100, max: 9000 },
            'Rastreador': { min: 20250, max: 22500 },
            'Silenciador': { min: 20250, max: 22500 },
            'Ticket': { min: 3240, max: 3600 },
            'Masterpick': { min: 8100, max: 9000 },
            'Energético': { min: 900, max: 1000 }
        },
        'servicos': {
            'Lavagem de Dinheiro': {
                parceria: true,
                semParceria: { cliente: 0.7, faccao: 0.3 },
                comParceria: { cliente: 0.8, faccao: 0.2 }
            },
            'Desmanche': {
                parceria: true,
                semParceria: { cliente: 0.7, faccao: 0.3 },
                comParceria: { cliente: 0.8, faccao: 0.2 }
            },
            'Secagem de Dinheiro': { cliente: 0.5, faccao: 0.2 },
            'Arma Enferrujada': { acos: { cliente: 10, faccao: 2 }, acosTotal: 12 },
            'Sucata': { materiais: { cliente: 6, faccao: 2 }, materiaisTotal: 8 }
        }
    };

    const porcentagemComissao: Record<Vendedor, number> = {
        'gerente': 0.23,
        'autorizado': 0.17
    };

    // Usar useMemo para calcular os dados processados sem mutar o estado original
    const dados = useMemo(() => {
        const newDados = JSON.parse(JSON.stringify(dadosBase)) as Dados;
        // Divisão dos preços de munições por 20
        for (const key in newDados.municoes) {
            newDados.municoes[key].min /= 20;
            newDados.municoes[key].max /= 20;
        }
        return newDados;
    }, [dadosBase]);

    // 1. Helper function to safely get item data using a type-safe switch
    const getItemData = useCallback((cat: Categoria, normalizedItem: string): { key: string, data: ItemData } | null => {
        if (!cat || !normalizedItem) return null;

        const findItem = (record: Record<string, ItemData>) => {
            const key = Object.keys(record).find(k => normalizeKey(k) === normalizedItem);
            return key ? { key, data: record[key] } : null;
        };

        switch (cat) {
            case 'farm': return findItem(dados.farm);
            case 'armas': return findItem(dados.armas);
            case 'municoes': return findItem(dados.municoes);
            case 'drogas': return findItem(dados.drogas);
            case 'contrabando': return findItem(dados.contrabando);
            case 'servicos': return findItem(dados.servicos);
            default: return null;
        }
    }, [dados]);

    const calcularValores = useCallback(() => {
        let valorTotalCalc = 0;
        let valorMembroCalc = 0;
        let valorFacCalc = 0;

        const itemInfo = getItemData(categoria, item);

        if (!itemInfo || quantidade <= 0) {
            setValorTotal(0);
            setValorMembro(0);
            setValorFac(0);
            return;
        }

        const { data: itemSelecionadoDados } = itemInfo;

        if (categoria === 'servicos') {
            const servico = itemSelecionadoDados as ServicoItem;
            if (item === 'lavagem-de-dinheiro' || item === 'desmanche') {
                if ('parceria' in servico) {
                    const dadosParceria = parceria ? servico.comParceria : servico.semParceria;
                    valorTotalCalc = 100;
                    valorMembroCalc = valorTotalCalc * dadosParceria.cliente;
                    valorFacCalc = valorTotalCalc * dadosParceria.faccao;
                }
            } else if (item === 'secagem-de-dinheiro' && 'cliente' in servico) {
                valorTotalCalc = 100;
                valorMembroCalc = valorTotalCalc * servico.cliente;
                valorFacCalc = valorTotalCalc * servico.faccao;
            } else if (item === 'arma-enferrujada' && 'acosTotal' in servico) {
                valorTotalCalc = servico.acosTotal;
                valorMembroCalc = servico.acos.cliente;
                valorFacCalc = servico.acos.faccao;
            } else if (item === 'sucata' && 'materiaisTotal' in servico) {
                valorTotalCalc = servico.materiaisTotal;
                valorMembroCalc = servico.materiais.cliente;
                valorFacCalc = servico.materiais.faccao;
            }
        } else {
            let precoUnitario = 0;
            if ('min' in itemSelecionadoDados && 'max' in itemSelecionadoDados) {
                precoUnitario = parceria ? itemSelecionadoDados.min : itemSelecionadoDados.max;
            } else if ('preco' in itemSelecionadoDados) {
                precoUnitario = itemSelecionadoDados.preco;
            }

            valorTotalCalc = precoUnitario * quantidade;

            if (comissao) {
                const comissaoValor = valorTotalCalc * porcentagemComissao[vendedor];
                valorMembroCalc = comissaoValor; // O vendedor recebe a comissão
                valorFacCalc = valorTotalCalc - comissaoValor;
            } else {
                valorFacCalc = valorTotalCalc;
            }
        }

        setValorTotal(valorTotalCalc);
        setValorMembro(valorMembroCalc);
        setValorFac(valorFacCalc);
    }, [categoria, item, quantidade, parceria, comissao, vendedor, dados, getItemData, porcentagemComissao]);

    useEffect(() => {
        calcularValores();
    }, [calcularValores]);

    // 2. Refactored to use a type-safe switch
    const getItemsForCategory = useCallback(() => {
        switch (categoria) {
            case 'farm': return Object.keys(dados.farm);
            case 'armas': return Object.keys(dados.armas);
            case 'municoes': return Object.keys(dados.municoes);
            case 'drogas': return Object.keys(dados.drogas);
            case 'contrabando': return Object.keys(dados.contrabando);
            case 'servicos': return Object.keys(dados.servicos);
            default: return [];
        }
    }, [categoria, dados]);

    const isServicos = categoria === 'servicos';

    // 3. Refactored to use the safe helper function
    const hasParceriaOption = useMemo(() => {
        const itemInfo = getItemData(categoria, item);
        if (!itemInfo) return false;
        if (isServicos) return item === 'lavagem-de-dinheiro' || item === 'desmanche';
        return 'min' in itemInfo.data;
    }, [categoria, item, isServicos, getItemData]);

    const isComissaoDisabled = isServicos;
    const isQuantidadeDisabled = isServicos;

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    return (
        <div className="bg-gray-800 rounded-lg p-8 w-full max-w-lg mx-auto my-8 border border-yellow-500 shadow-xl">
            <h1 className="text-3xl font-bold mb-6 text-yellow-500 text-center">{translations.calculatorTitle || 'YKZ CALC'}</h1>

            <div className="mb-4">
                <label htmlFor="vendedor" className="block text-sm font-medium text-gray-400 mb-1">{translations.sellerType}</label>
                <select
                    id="vendedor"
                    value={vendedor}
                    onChange={(e) => setVendedor(e.target.value as Vendedor)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-yellow-500"
                >
                    <option value="gerente">{translations.manager}</option>
                    <option value="autorizado">{translations.authorizedSeller}</option>
                </select>
            </div>

            <div className="mb-4">
                <label htmlFor="categoria" className="block text-sm font-medium text-gray-400 mb-1">{translations.itemCategory}</label>
                <select
                    id="categoria"
                    value={categoria}
                    onChange={(e) => {
                        setCategoria(e.target.value as Categoria);
                        setItem('');
                        setQuantidade(1);
                        setParceria(false);
                        setComissao(false);
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-yellow-500"
                >
                    <option value="">{translations.selectCategory}</option>
                    <option value="farm">{translations.farm}</option>
                    <option value="armas">{translations.weapons}</option>
                    <option value="municoes">{translations.ammunition}</option>
                    <option value="drogas">{translations.drugs}</option>
                    <option value="contrabando">{translations.contraband}</option>
                    <option value="servicos">{translations.illegalServices}</option>
                </select>
            </div>

            {categoria && (
                <div className="mb-4">
                    <label htmlFor="item" className="block text-sm font-medium text-gray-400 mb-1">{translations.item}</label>
                    <select
                        id="item"
                        value={item}
                        onChange={(e) => setItem(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    >
                        <option value="">{translations.selectItem}</option>
                        {getItemsForCategory().map((key) => (
                            <option key={key} value={normalizeKey(key)}>
                                {key}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {item && (
                <>
                    <div className="mb-4">
                        <label htmlFor="quantidade" className="block text-sm font-medium text-gray-400 mb-1">{translations.quantity}</label>
                        <input
                            type="number"
                            id="quantidade"
                            value={quantidade}
                            onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 0))}
                            min="1"
                            disabled={isQuantidadeDisabled}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                    </div>

                    <div className="flex justify-between items-center mb-6">
                        {hasParceriaOption && (
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="parceria"
                                    checked={parceria}
                                    onChange={(e) => setParceria(e.target.checked)}
                                    className="mr-2 h-4 w-4 text-yellow-500 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500"
                                />
                                <label htmlFor="parceria" className="text-sm text-gray-400">{translations.partnership}</label>
                            </div>
                        )}
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="comissao"
                                checked={comissao}
                                onChange={(e) => setComissao(e.target.checked)}
                                disabled={isComissaoDisabled}
                                className="mr-2 h-4 w-4 text-yellow-500 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500"
                            />
                            <label htmlFor="comissao" className="text-sm text-gray-400">{translations.getCommission}</label>
                        </div>
                    </div>
                </>
            )}

            <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">{translations.totalValue}:</span>
                    <span className="font-bold text-lg text-white">R$ {formatCurrency(valorTotal)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">{translations.sellerValue}:</span>
                    <span className="font-bold text-lg text-white">R$ {formatCurrency(valorMembro)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-600">
                    <span className="text-gray-400">{translations.factionValue}:</span>
                    <span className="font-bold text-lg text-yellow-500">R$ {formatCurrency(valorFac)}</span>
                </div>
            </div>
        </div>
    );
};

export default Calculator;