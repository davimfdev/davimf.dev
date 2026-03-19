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

    transactions.forEach(t => {
      const amount = Math.abs(parseFloat(t.amount));
      if (categoryTotals[t.category]) {
        categoryTotals[t.category] += amount;
      } else {
        categoryTotals[t.category] = amount;
      }
    });

    return {
      labels: Object.keys(categoryTotals),
      datasets: [
        {
          data: Object.values(categoryTotals),
          backgroundColor: [
            '#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b',
            '#ef4444', '#06b6d4', '#8b5cf6', '#f43f5e', '#14b8a6', '#f97316'
          ],
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 2,
          hoverOffset: 20,
        },
      ],
    };
  }, [transactions]);

  const options = {
    plugins: {
      legend: {
        position: 'right' as const, // Mover para a direita economiza espaço vertical e evita cortes
        labels: {
          color: '#9ca3af',
          font: {
            size: 12,
            weight: 'bold' as const
          },
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 18, 20, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            let label = context.label || '';
            if (label) label += ': ';
            if (context.parsed !== null) {
              label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed);
            }
            return label;
          }
        }
      }
    },
    responsive: true,
    maintainAspectRatio: false, // OBRIGATÓRIO para preencher a div pai
  };

  return (
      <div className="w-full h-full min-h-0 relative">
        {expenseData.labels.length > 0 ? (
            <Pie data={expenseData} options={options} />
        ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 italic text-sm">Nenhum dado para exibir.</p>
            </div>
        )}
      </div>
  );
};

export default CategoryChart;