import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { DATA_PALETTE_CATEGORY } from '../lib/palettes/dataPalettes';

ChartJS.register(ArcElement, Tooltip, Legend);

/** Chart.js pinta em canvas, onde `var()` não resolve: o token é lido do DOM. */
function tokenColor(name: string, alpha: number): string {
  const channels = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${name}`)
    .trim();
  return `rgb(${channels} / ${alpha})`;
}

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
          backgroundColor: [...DATA_PALETTE_CATEGORY],
          // Cromo de interface, não dado: sai do token como o resto do site.
          borderColor: tokenColor('fg', 0.1),
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
          color: tokenColor('fg-muted', 1),
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
        backgroundColor: tokenColor('surface-3', 0.95),
        titleColor: tokenColor('fg', 1),
        bodyColor: tokenColor('fg-soft', 1),
        padding: 12,
        borderColor: tokenColor('fg', 0.1),
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