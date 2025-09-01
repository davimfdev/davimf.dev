export type Vendedor = 'gerente' | 'autorizado';

export type Categoria = 'farm' | 'armas' | 'municoes' | 'drogas' | 'contrabando' | 'servicos' | '';

interface ItemPreco {
    preco: number;
}

interface ItemMinMax {
    min: number;
    max: number;
}

interface ServicoLavagemDesmanche {
    parceria: true;
    semParceria: { cliente: number; faccao: number; };
    comParceria: { cliente: number; faccao: number; };
}

interface ServicoSecagem {
    cliente: number;
    faccao: number;
}

interface ServicoArmaEnferrujada {
    acos: { cliente: number; faccao: number; };
    acosTotal: number;
}

interface ServicoSucata {
    materiais: { cliente: number; faccao: number; };
    materiaisTotal: number;
}

export type ServicoItem = ServicoLavagemDesmanche | ServicoSecagem | ServicoArmaEnferrujada | ServicoSucata;

export type ItemData = ItemPreco | ItemMinMax | ServicoItem;

export interface Dados {
    farm: Record<string, ItemPreco>;
    armas: Record<string, ItemMinMax>;
    municoes: Record<string, ItemMinMax>;
    drogas: Record<string, ItemMinMax>;
    contrabando: Record<string, ItemMinMax>;
    servicos: Record<string, ServicoItem>;
}