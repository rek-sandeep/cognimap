import { useMemo } from 'react'
import type { MindMapApi } from '@/hooks/useMindMap'
import { computeProgress, countByStatus, findNode } from '@/lib/mindmap'
import { WIP_LIMIT } from '@/types/mindmap'

function StarburstMark() {
  const pts = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? 11 : 8
    return `${12 + Math.cos(a) * r},${12 + Math.sin(a) * r}`
  }).join(' ')
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden>
      <polygon points={pts} fill="#FF5F1F" stroke="#d14a12" strokeWidth={1.5} />
    </svg>
  )
}

export function HeaderBar({
  api,
  onTogglePanel,
  panelOpen,
}: {
  api: MindMapApi
  onTogglePanel: () => void
  panelOpen: boolean
}) {
  const { data, focusedId } = api

  const stats = useMemo(() => countByStatus(data.root), [data.root])
  const progress = useMemo(() => computeProgress(data.root), [data.root])
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const wipOver = stats.doing > WIP_LIMIT

  const crumbs = useMemo(() => {
    if (!focusedId) return [] as Array<{ id: string; title: string }>
    const path: Array<{ id: string; title: string }> = []
    const walk = (id: string, trail: Array<{ id: string; title: string }>): boolean => {
      const node = findNode(data.root, id)
      if (!node) return false
      const next = [...trail, { id: node.id, title: node.title }]
      if (node.id === focusedId) {
        path.push(...next)
        return true
      }
      return node.children.some((c) => walk(c.id, next))
    }
    walk(data.root.id, [])
    return path
  }, [data.root, focusedId])

  return (
    <>
      {/* top-left identity */}
      <header className="absolute left-4 top-4 z-10 flex max-w-[70vw] items-center gap-3">
        <div className="panel-surface flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-4">
          <StarburstMark />
          <div className="leading-tight">
            <input
              value={data.name}
              onChange={(e) => api.renameProject(e.target.value)}
              className="w-40 bg-transparent text-[15px] font-semibold tracking-tight text-[rgb(17,17,17)] focus:outline-none sm:w-56"
              aria-label="Project name"
            />
            <div className="micro-label">mind map · project</div>
          </div>
        </div>

        <div className="panel-surface hidden items-center gap-2 rounded-full px-3.5 py-2 sm:flex">
          <span className="micro-label">progress</span>
          <span className="text-[13px] font-semibold tabular-nums">{pct}%</span>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[rgba(17,17,17,0.1)]">
            <span
              className="block h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? '#008a00' : '#FF5F1F',
              }}
            />
          </span>
        </div>

        {wipOver && (
          <div
            className="panel-surface flex items-center gap-2 rounded-full px-3.5 py-2"
            title={`${stats.doing} tasks in progress — the focus of attention holds about ${WIP_LIMIT} items (Cowan, 2001). Finish or pause some.`}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-[#b06200]" />
            <span className="micro-label !text-[#b06200]">
              WIP {stats.doing}/{WIP_LIMIT}
            </span>
          </div>
        )}
      </header>

      {/* focus breadcrumb */}
      {focusedId && (
        <nav className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1.5">
          <button className="pill-btn" onClick={() => api.setFocused(null)}>
            ← Whole map
          </button>
          <div className="panel-surface flex items-center gap-1 rounded-full px-3 py-1.5">
            {crumbs.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-[rgb(136,136,136)]">/</span>}
                <button
                  onClick={() => api.setFocused(c.id === data.root.id ? null : c.id)}
                  className="text-[12px] font-medium text-[rgb(17,17,17)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF5F1F]"
                >
                  {c.title}
                </button>
              </span>
            ))}
          </div>
        </nav>
      )}

      {/* top-right actions */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button
          className={`pill-btn ${panelOpen ? 'pill-btn--active' : ''}`}
          onClick={onTogglePanel}
          aria-pressed={panelOpen}
        >
          Inspector
        </button>
      </div>
    </>
  )
}
