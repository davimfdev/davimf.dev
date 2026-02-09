export interface Produto {
  nome: string;
  valorComParceria: number;
  valorSemParceria: number;
  polvora: number;
  dinheiro: number;
}

export interface ItemCalculo {
  produto: Produto;
  quantidade: number;
}
