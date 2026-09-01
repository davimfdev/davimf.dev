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

/**
 * Tamanho do rótulo em user units do viewBox (320×260 fixo — ver `compact`
 * abaixo). O que chega ao olho é `fontSize × escala`, e a escala muda com o
 * layout, não com o SVG:
 *
 * - Desktop: o SVG renderiza a ~440px de largura, escala ≈ 440/320 = 1.375,
 *   então 9px viram ~12.4px efetivos.
 * - Mobile (`compact`): `Hero.tsx` trava o wrapper em `max-w-[320px]`, e o
 *   viewBox continua 320 de largura — escala vira 320/320 = 1.0. Alvo: ~12px
 *   efetivos, iguais ao desktop → 12 / 1.0 = 12px.
 */
const LABEL_FONT_SIZE = 9;
const LABEL_FONT_SIZE_COMPACT = 12;

// Largura do viewBox (ver <svg> abaixo). Um rótulo cujo nó fica perto de uma
// borda vertical precisa ancorar para dentro em vez de centralizar no nó —
// senão o texto vaza pela borda do SVG. A margem de segurança é a mesma dos
// dois lados: um nó a menos de VIEWBOX_MARGIN da esquerda ancora em `start`
// no x=0, um nó a menos de VIEWBOX_MARGIN da direita ancora em `end` no
// x=VIEWBOX_WIDTH.
const VIEWBOX_WIDTH = 320;
const VIEWBOX_MARGIN = 80;

export function EcosystemGraph({ compact = false }: { compact?: boolean }) {
  // Os cinco nós sempre aparecem — inclusive no mobile compacto, que hoje
  // cabe a cruz inteira (320px de largura a escala 1.0). `compact` só ajusta
  // o tamanho do rótulo (ver LABEL_FONT_SIZE_COMPACT).
  const nodes = ECOSYSTEM_NODES;
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
        // Nós perto de uma borda vertical (POSTGRESQL à esquerda, BASEBOT à
        // direita) ancoram para dentro em vez de centralizar no próprio x —
        // senão o rótulo vaza pela borda do viewBox. Ver VIEWBOX_MARGIN.
        const labelAnchor: 'start' | 'middle' | 'end' =
          node.x < VIEWBOX_MARGIN
            ? 'start'
            : node.x > VIEWBOX_WIDTH - VIEWBOX_MARGIN
              ? 'end'
              : 'middle';
        const labelX = labelAnchor === 'start' ? 0 : labelAnchor === 'end' ? VIEWBOX_WIDTH : node.x;
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
              x={labelX}
              y={core ? node.y + 26 : node.y + (node.y > 130 ? 22 : -14)}
              textAnchor={labelAnchor}
              className="text-eyebrow"
              fill={core ? 'rgb(var(--accent))' : 'rgb(var(--fg-muted))'}
              style={{
                fontSize: compact ? `${LABEL_FONT_SIZE_COMPACT}px` : `${LABEL_FONT_SIZE}px`,
                letterSpacing: '0.08em',
              }}
            >
              {node.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
