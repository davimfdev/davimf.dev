export interface Produto {
  nome: string;
  valorComParceria: number;
  valorSemParceria: number;
  aco: number;
  dinheiro: number;
}

export interface ItemCalculo {
  produto: Produto;
  quantidade: number;
}
