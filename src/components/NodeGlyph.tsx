import type { MindNode } from '@/types/mindmap'

export const STATUS_STYLE = {
  todo: { fill: '#ffffff', stroke: 'rgb(136,136,136)', label: 'To do' },
  doing: { fill: '#FF5F1F', stroke: '#d14a12', label: 'In progress' },
  done: { fill: '#008a00', stroke: '#006e00', label: 'Done' },
  blocked: { fill: '#c0391a', stroke: '#9c2f16', label: 'Blocked' },
} as const

export const PRIORITY_WIDTH = { low: 1, medium: 2, high: 3.25 } as const

function polygonPoints(sides: number, r: number, offset = -Math.PI / 2): string {
  return Array.from({ length: sides }, (_, i) => {
    const a = offset + (i / sides) * Math.PI * 2
    return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`
  }).join(' ')
}

function starburstPoints(r: number, spikes = 12): string {
  const inner = r * 0.72
  return Array.from({ length: spikes * 2 }, (_, i) => {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
    const rad = i % 2 === 0 ? r : inner
    return `${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`
  }).join(' ')
}

export type NodeKind = 'root' | 'phase' | 'workstream' | 'task' | 'milestone'

export function nodeKind(node: MindNode, depth: number): NodeKind {
  if (depth === 0) return 'root'
  if (node.milestone) return 'milestone'
  if (depth === 1) return 'phase'
  if (depth === 2) return 'workstream'
  return 'task'
}

export function nodeRadius(depth: number): number {
  if (depth === 0) return 34
  if (depth === 1) return 24
  return 17
}

interface GlyphProps {
  node: MindNode
  depth: number
  progress: { done: number; total: number }
  selected: boolean
}

/**
 * Shape-coded node glyph — dual coding (Paivio): kind is read from the shape,
 * status from the fill, priority from the ring weight, progress from the arc.
 */
export function NodeGlyph({ node, depth, progress, selected }: GlyphProps) {
  const kind = nodeKind(node, depth)
  const r = nodeRadius(depth)
  const status = STATUS_STYLE[node.status]
  const strokeW = PRIORITY_WIDTH[node.priority]
  const isParent = progress.total > 0 && node.children.length > 0
  const pct = progress.total ? progress.done / progress.total : 0
  const ringR = r + 6
  const circumference = 2 * Math.PI * ringR

  const fill = kind === 'root' ? '#FF5F1F' : status.fill
  const stroke = kind === 'root' ? '#d14a12' : status.stroke

  return (
    <g>
      {selected && (
        <circle
          r={ringR + 7}
          fill="none"
          stroke="#FF5F1F"
          strokeWidth={2}
          strokeDasharray="3 4"
          opacity={0.9}
        />
      )}

      {isParent && (
        <>
          <circle r={ringR} fill="none" stroke="rgba(17,17,17,0.12)" strokeWidth={3} />
          <circle
            r={ringR}
            fill="none"
            stroke={pct === 1 ? '#008a00' : '#FF5F1F'}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${(pct * circumference).toFixed(1)} ${circumference.toFixed(1)}`}
            transform="rotate(-90)"
          />
        </>
      )}

      {kind === 'root' && (
        <g className="root-starburst">
          <polygon points={starburstPoints(r)} fill={fill} stroke={stroke} strokeWidth={2.5} />
        </g>
      )}
      {kind === 'phase' && (
        <polygon points={polygonPoints(6, r)} fill={fill} stroke={stroke} strokeWidth={strokeW} />
      )}
      {kind === 'workstream' && (
        <rect
          x={-r * 0.85}
          y={-r * 0.85}
          width={r * 1.7}
          height={r * 1.7}
          rx={3}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
        />
      )}
      {kind === 'milestone' && (
        <rect
          x={-r * 0.8}
          y={-r * 0.8}
          width={r * 1.6}
          height={r * 1.6}
          transform="rotate(45)"
          fill={node.status === 'done' ? STATUS_STYLE.done.fill : '#ffffff'}
          stroke={node.status === 'done' ? STATUS_STYLE.done.stroke : '#b06200'}
          strokeWidth={strokeW + 0.5}
        />
      )}
      {kind === 'task' && (
        <circle r={r} fill={fill} stroke={stroke} strokeWidth={strokeW} />
      )}

      {node.status === 'done' && (
        <path
          d={`M ${-r * 0.42} 0 L ${-r * 0.1} ${r * 0.36} L ${r * 0.46} ${-r * 0.34}`}
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {node.status === 'blocked' && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={r * 1.05}
          fontWeight={700}
          fill="#ffffff"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          !
        </text>
      )}
    </g>
  )
}
