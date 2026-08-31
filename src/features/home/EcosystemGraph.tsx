/**
 * O ecossistema real, como grafo em estrela.
 *
 * SVG inline e não <img> por dois motivos: as arestas se desenham com
 * stroke-dasharray, e os rótulos herdam os tokens de cor. Nada aqui é
 * ilustração — trocar um nome é trocar um fato sobre o que existe.
 *
 * Sem glow, sem gradiente, sem partícula: a sensação técnica vem da precisão
 * do traço de 1px, não de efeito. O único dourado é o nó central.
 *
 * `aria-hidden`: o conteúdo já está dito no texto ao lado; para um leitor de
 * tela isto é ruído.
 */

import { ECOSYSTEM_EDGES, ECOSYSTEM_NODES } from './homeData';

const byId = (id: string) => ECOSYSTEM_NODES.find((node) => node.id === id)!;

export function EcosystemGraph({ compact = false }: { compact?: boolean }) {
  // No mobile o grafo perde os dois nós horizontais: cinco nós numa coluna
  // estreita viram sopa de letras.
  const nodes = compact
    ? ECOSYSTEM_NODES.filter((node) => node.y !== 130 || node.kind === 'core')
    : ECOSYSTEM_NODES;
  const edges = ECOSYSTEM_EDGES.filter((edge) => nodes.some((node) => node.id === edge.to));

  return (
    <svg
      data-ecosystem
      viewBox="0 0 320 260"
      className="w-full h-auto"
      aria-hidden="true"
      focusable="false"
    >
      <g>
        {edges.map((edge, index) => {
          const from = byId(edge.from);
          const to = byId(edge.to);
          return (
            <line
              key={edge.to}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--line-strong)"
              strokeWidth="1"
              className="ecosystem-edge"
              style={{ animationDelay: `${240 + index * 90}ms` }}
            />
          );
        })}
      </g>

      {nodes.map((node, index) => {
        const core = node.kind === 'core';
        return (
          <g
            key={node.id}
            className="ecosystem-node"
            style={{ animationDelay: `${600 + index * 80}ms` }}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={core ? 7 : 4.5}
              fill={core ? 'rgb(var(--accent))' : 'none'}
              stroke={core ? 'rgb(var(--accent))' : 'rgb(var(--fg-muted))'}
              strokeWidth="1"
            />
            <text
              x={node.x}
              y={core ? node.y + 26 : node.y + (node.y > 130 ? 22 : -14)}
              textAnchor="middle"
              className="text-eyebrow"
              fill={core ? 'rgb(var(--accent))' : 'rgb(var(--fg-muted))'}
              style={{ fontSize: '9px', letterSpacing: '0.08em' }}
            >
              {node.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
