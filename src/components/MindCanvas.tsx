import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MindMapApi } from '@/hooks/useMindMap'
import { computeProgress, findNode, layoutRadial } from '@/lib/mindmap'
import { CHUNK_LIMIT } from '@/types/mindmap'
import { NodeGlyph, nodeRadius } from './NodeGlyph'

interface View {
  x: number
  y: number
  k: number
}

const MIN_K = 0.25
const MAX_K = 3

function truncate(title: string, max = 20): string {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title
}

export function MindCanvas({ api, padRight = 0 }: { api: MindMapApi; padRight?: number }) {
  const { data, focusedId, selectedId } = api
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 0.9 })
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const dragRef = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null)
  const [initialized, setInitialized] = useState(false)

  const focusRoot = useMemo(() => {
    if (!focusedId) return data.root
    return findNode(data.root, focusedId) ?? data.root
  }, [data.root, focusedId])

  const points = useMemo(() => layoutRadial(focusRoot), [focusRoot])

  const visibleIds = useMemo(() => new Set(points.keys()), [points])

  /* ---------- fit view ---------- */
  const fitView = useCallback(() => {
    const el = containerRef.current
    if (!el || points.size === 0) return
    const { width, height } = el.getBoundingClientRect()
    // leave room for the inspector on desktop so outward labels stay visible
    const reserve = window.innerWidth >= 768 ? padRight : 0
    const availW = width - reserve
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity
    points.forEach((p) => {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    })
    const pad = 120
    const bw = Math.max(maxX - minX + pad * 2, 320)
    const bh = Math.max(maxY - minY + pad * 2, 320)
    const k = Math.min(availW / bw, height / bh, 1.15)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    setView({ x: availW / 2 - cx * k, y: height / 2 - cy * k, k })
  }, [points, padRight])

  useEffect(() => {
    if (!initialized) {
      fitView()
      setInitialized(true)
    }
  }, [initialized, fitView])

  // refit when entering/exiting focus mode
  const prevFocus = useRef(focusedId)
  useEffect(() => {
    if (prevFocus.current !== focusedId) {
      prevFocus.current = focusedId
      fitView()
    }
  }, [focusedId, fitView])

  /* ---------- pan & zoom ---------- */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setView((v) => {
        const factor = Math.exp(-e.deltaY * 0.0012)
        const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor))
        const scale = k / v.k
        return { k, x: mx - (mx - v.x) * scale, y: my - (my - v.y) * scale }
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('[data-node]')) return
    dragRef.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current
    if (!d) return
    setView((v) => ({ ...v, x: d.vx + e.clientX - d.px, y: d.vy + e.clientY - d.py }))
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  const zoomBy = (factor: number) => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor))
      const scale = k / v.k
      return { k, x: width / 2 - (width / 2 - v.x) * scale, y: height / 2 - (height / 2 - v.y) * scale }
    })
  }

  /* ---------- rename ---------- */
  const startRename = (id: string) => {
    const node = findNode(data.root, id)
    if (!node) return
    api.select(id)
    setRenamingId(id)
    setRenameValue(node.title)
  }
  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      api.patchNode(renamingId, { title: renameValue.trim() })
    }
    setRenamingId(null)
  }

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return
      const sel = api.selectedId
      if (e.key === 'Tab') {
        e.preventDefault()
        api.addChild(sel ?? focusRoot.id)
      } else if (e.key === 'Enter' && sel) {
        e.preventDefault()
        api.addSibling(sel)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        api.deleteNode(sel)
      } else if (e.key === ' ' && sel) {
        e.preventDefault()
        api.toggleCollapse(sel)
      } else if ((e.key === 'f' || e.key === 'F') && sel) {
        e.preventDefault()
        api.setFocused(sel)
      } else if (e.key === 'Escape') {
        if (sel) api.select(null)
        else if (api.focusedId) api.setFocused(null)
      } else if (e.key === 'F2' && sel) {
        e.preventDefault()
        startRename(sel)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, focusRoot.id, data.root])

  /* ---------- edges ---------- */
  const edges = useMemo(() => {
    const out: Array<{ id: string; d: string; depth: number }> = []
    const walk = (nodeId: string, parentId: string | null) => {
      const p = points.get(nodeId)
      if (!p) return
      if (parentId) {
        const pp = points.get(parentId)
        if (pp) {
          const midR = (Math.hypot(pp.x, pp.y) + Math.hypot(p.x, p.y)) / 2
          const cx = Math.cos(p.angle) * midR
          const cy = Math.sin(p.angle) * midR
          out.push({
            id: `${parentId}->${nodeId}`,
            d: `M ${pp.x} ${pp.y} Q ${cx} ${cy} ${p.x} ${p.y}`,
            depth: p.depth,
          })
        }
      }
      const node = findNode(focusRoot, nodeId)
      if (node && !node.collapsed) node.children.forEach((c) => walk(c.id, nodeId))
    }
    walk(focusRoot.id, null)
    return out
  }, [points, focusRoot])

  const depArcs = useMemo(() => {
    return data.dependencies
      .filter((d) => visibleIds.has(d.from) && visibleIds.has(d.to))
      .map((d) => {
        const a = points.get(d.from)!
        const b = points.get(d.to)!
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy) || 1
        const off = Math.min(70, len * 0.22)
        const cx = mx - (dy / len) * off
        const cy = my + (dx / len) * off
        return { id: `${d.from}->${d.to}`, d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}` }
      })
  }, [data.dependencies, points, visibleIds])

  /* ---------- node rendering ---------- */
  const renderedNodes = useMemo(() => {
    const out: React.ReactNode[] = []
    // stagger leaf labels above/below to avoid collisions on crowded rings
    const ringCounter = new Map<number, number>()
    const walk = (nodeId: string) => {
      const node = findNode(focusRoot, nodeId)
      const p = points.get(nodeId)
      if (!node || !p) return
      const r = nodeRadius(p.depth)
      const progress = computeProgress(node)
      const overloaded = node.children.length > CHUNK_LIMIT
      const isRoot = nodeId === focusRoot.id && p.depth === 0
      const ringIdx = ringCounter.get(p.depth) ?? 0
      ringCounter.set(p.depth, ringIdx + 1)
      // labels sit radially outward; leaf nodes alternate between two lanes
      // so neighbours at similar angles never share a text line
      const lane = p.depth >= 2 ? (ringIdx % 2) * 24 : 0
      const cos = Math.cos(p.angle)
      const sin = Math.sin(p.angle)
      const labelX = p.depth === 0 ? 0 : cos * (r + 10 + lane)
      const labelY = p.depth === 0 ? r + 20 : sin * (r + 10 + lane)
      const anchor = p.depth === 0 ? 'middle' : cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle'
      const hiddenX = p.depth === 0 ? 0 : cos * (r + 26 + lane)
      const hiddenY = p.depth === 0 ? r + 35 : sin * (r + 26 + lane)
      // collapse handle sits perpendicular to the label direction
      const tgX = p.depth === 0 ? r + 13 : Math.cos(p.angle + Math.PI / 2) * (r + 13)
      const tgY = p.depth === 0 ? 0 : Math.sin(p.angle + Math.PI / 2) * (r + 13)
      out.push(
        <g
          key={node.id}
          data-node={node.id}
          className="mind-node node-enter"
          transform={`translate(${p.x}, ${p.y})`}
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            api.select(node.id)
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            startRename(node.id)
          }}
        >
          <title>{node.title}</title>
          {/* generous hit area (R4) */}
          <circle r={Math.max(r + 10, 22)} fill="transparent" />
          <NodeGlyph node={node} depth={p.depth} progress={progress} selected={selectedId === node.id} />

          {overloaded && (
            <g transform={`translate(${r * 0.85}, ${-r * 0.9})`}>
              <circle r={9} fill="#b06200" stroke="#fff" strokeWidth={1.5} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fontWeight={700}
                fill="#fff"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {node.children.length}
              </text>
              <title>
                {node.children.length} items — beyond the 7±2 chunking limit (Miller, 1956)
              </title>
            </g>
          )}

          {node.children.length > 0 && (
            <g
              transform={`translate(${tgX}, ${tgY})`}
              onClick={(e) => {
                e.stopPropagation()
                api.toggleCollapse(node.id)
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle r={8} fill="#fff" stroke="rgba(17,17,17,0.35)" strokeWidth={1.2} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={600}
                fill="rgb(17,17,17)"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {node.collapsed ? '+' : '−'}
              </text>
            </g>
          )}

          <text
            x={labelX}
            y={labelY}
            textAnchor={anchor}
            dominantBaseline="central"
            fontSize={isRoot ? 15 : 13}
            fontWeight={isRoot ? 650 : selectedId === node.id ? 600 : 450}
            fill={node.status === 'done' ? 'rgb(136,136,136)' : 'rgb(17,17,17)'}
            style={{
              userSelect: 'none',
              pointerEvents: 'none',
              textDecoration: node.status === 'done' ? 'line-through' : 'none',
              paintOrder: 'stroke',
              stroke: 'rgba(245,246,242,0.9)',
              strokeWidth: 3,
            }}
          >
            {truncate(node.title)}
          </text>
          {node.collapsed && p.hiddenChildren > 0 && (
            <text
              x={hiddenX}
              y={hiddenY}
              textAnchor={anchor}
              dominantBaseline="central"
              fontSize={10}
              className="font-mono-ui"
              fill="rgb(136,136,136)"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              +{p.hiddenChildren} hidden
            </text>
          )}
        </g>,
      )
      if (!node.collapsed) node.children.forEach((c) => walk(c.id))
    }
    walk(focusRoot.id)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRoot, points, selectedId, data.root])

  const renameNodePos = renamingId ? points.get(renamingId) : null

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <svg
        ref={svgRef}
        className="h-full w-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="application"
        aria-label="Mind map canvas"
      >
        <defs>
          <pattern id="dotgrid" width={26} height={26} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={1} fill="rgba(17,17,17,0.10)" />
          </pattern>
          <marker
            id="dep-arrow"
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={7}
            markerHeight={7}
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#b06200" />
          </marker>
        </defs>

        <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
          <rect x={-8000} y={-8000} width={16000} height={16000} fill="url(#dotgrid)" />

          {edges.map((e) => (
            <path
              key={e.id}
              d={e.d}
              fill="none"
              stroke={e.depth <= 1 ? 'rgba(17,17,17,0.4)' : 'rgba(17,17,17,0.22)'}
              strokeWidth={e.depth <= 1 ? 2 : 1.4}
            />
          ))}

          {depArcs.map((a) => (
            <path
              key={a.id}
              d={a.d}
              fill="none"
              stroke="#b06200"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              markerEnd="url(#dep-arrow)"
              opacity={0.85}
            />
          ))}

          {renderedNodes}
        </g>
      </svg>

      {/* inline rename overlay */}
      {renamingId && renameNodePos && (
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setRenamingId(null)
          }}
          className="field-input absolute z-20 shadow-lg"
          style={{
            left: renameNodePos.x * view.k + view.x - 90,
            top: renameNodePos.y * view.k + view.y - 16,
            width: 180,
            textAlign: 'center',
          }}
          aria-label="Rename node"
        />
      )}

      {/* zoom controls */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
        <button className="pill-btn" onClick={() => zoomBy(1.25)} aria-label="Zoom in">
          +
        </button>
        <button className="pill-btn" onClick={() => zoomBy(0.8)} aria-label="Zoom out">
          −
        </button>
        <button className="pill-btn" onClick={fitView}>
          Fit
        </button>
        <span className="micro-label ml-1 select-none">{Math.round(view.k * 100)}%</span>
      </div>
    </div>
  )
}
