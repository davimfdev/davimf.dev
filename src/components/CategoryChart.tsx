import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Transaction {
  amount: string;
  category: string;
}

interface CategoryChartProps {
  transactions: Transaction[];
}

const CategoryChart: React.FC<CategoryChartProps> = ({ transactions }) => {
  const expenseData = React.useMemo(() => {
    const categoryTotals: { [key: string]: number } = {};

    // Filtra apenas despesas (valores negativos) e agrupa por categoria
    transactions
      .filter(t => parseFloat(t.amount) < 0)
      .forEach(t => {
        const amount = Math.abs(parseFloat(t.amount));
        if (categoryTotals[t.category]) {
          categoryTotals[t.category] += amount;
        } else {
          categoryTotals[t.category] = amount;
        }
      });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    return {
      labels,
      datasets: [
        {
          label: 'Despesas por Categoria',
          data,
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
            '#E7E9ED', '#8DDF3C', '#F67019', '#F53794', '#537BC4', '#ACC236'
          ],
          borderColor: '#1F2937', // Cor de fundo do seu app
          borderWidth: 2,
        },
      ],
    };
  }, [transactions]);

  const options = {
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#E5E7EB', // Cor do texto da legenda
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed);
            }
            return label;
          }
        }
      }
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg" style={{ position: 'relative', height: '400px' }}>
      <h2 className="text-xl font-semibold mb-4 text-white">Despesas por Categoria</h2>
      {expenseData.labels.length > 0 ? (
        <Pie data={expenseData} options={options} />
      ) : (
        <p className="text-center text-gray-400 mt-16">Não há dados de despesas para exibir o gráfico.</p>
      )}
    </div>
  );
};

export default CategoryChart;
