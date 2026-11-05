import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { MindMapApi } from '@/hooks/useMindMap'
import {
  collectNodes,
  computeProgress,
  countByStatus,
  findNode,
  toMarkdownWBS,
} from '@/lib/mindmap'
import type { MindNode, NodePriority, NodeStatus } from '@/types/mindmap'
import { CHUNK_LIMIT } from '@/types/mindmap'
import { STATUS_STYLE } from './NodeGlyph'
import { SciencePanel } from './SciencePanel'

type Tab = 'details' | 'links' | 'science' | 'data'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'links', label: 'Links' },
  { id: 'science', label: 'Science' },
  { id: 'data', label: 'Data' },
]

const STATUS_ORDER: NodeStatus[] = ['todo', 'doing', 'done', 'blocked']
const PRIORITY_ORDER: NodePriority[] = ['low', 'medium', 'high']

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* ---------------- details tab ---------------- */

function DetailsTab({ api }: { api: MindMapApi }) {
  const node = api.selectedId ? findNode(api.data.root, api.selectedId) : null

  if (!node) {
    const stats = countByStatus(api.data.root)
    const total = stats.todo + stats.doing + stats.done + stats.blocked
    const overloaded = collectNodes(api.data.root).filter((n) => n.children.length > CHUNK_LIMIT)
    return (
      <div className="flex flex-col gap-4 text-[13px] leading-relaxed">
        <p className="text-[rgb(60,60,60)]">
          Select any node to edit it. Double-click a node to rename it in place.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_ORDER.map((s) => (
            <div
              key={s}
              className="flex items-center gap-2 rounded-lg border border-[rgba(17,17,17,0.12)] px-3 py-2"
            >
              <span
                className="inline-block h-3 w-3 rounded-full border"
                style={{ background: STATUS_STYLE[s].fill, borderColor: STATUS_STYLE[s].stroke }}
              />
              <span className="text-[12px]">{STATUS_STYLE[s].label}</span>
              <span className="ml-auto font-mono-ui text-[13px] font-semibold">{stats[s]}</span>
            </div>
          ))}
        </div>
        <p className="text-[rgb(60,60,60)]">
          <strong>{total}</strong> tasks · <strong>{api.data.dependencies.length}</strong>{' '}
          dependencies · <strong>{overloaded.length}</strong> overloaded branches
        </p>
        <div className="rounded-lg border border-dashed border-[rgba(17,17,17,0.25)] p-3">
          <div className="micro-label mb-2">Keyboard</div>
          <ul className="flex flex-col gap-1 font-mono-ui text-[11.5px] text-[rgb(60,60,60)]">
            <li><b>Tab</b> — add child · <b>Enter</b> — add sibling</li>
            <li><b>Space</b> — collapse / expand · <b>F</b> — focus branch</li>
            <li><b>F2</b> — rename · <b>Del</b> — delete · <b>Esc</b> — back</li>
          </ul>
        </div>
      </div>
    )
  }

  const progress = computeProgress(node)
  const isRoot = node.id === api.data.root.id
  const overloaded = node.children.length > CHUNK_LIMIT

  return (
    <div className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1">
        <span className="micro-label">Title</span>
        <input
          className="field-input"
          value={node.title}
          onChange={(e) => api.patchNode(node.id, { title: e.target.value })}
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="micro-label">Status</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Status">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={node.status === s}
              className={`pill-btn !px-3 !py-1.5 !text-[12px] ${node.status === s ? 'pill-btn--active' : ''}`}
              onClick={() => {
                api.patchNode(node.id, { status: s })
                // finishing a branch finishes everything inside it
                if (s === 'done') {
                  const cascade = (n: MindNode) => {
                    n.children.forEach((c) => {
                      api.patchNode(c.id, { status: 'done' })
                      cascade(c)
                    })
                  }
                  cascade(node)
                }
              }}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full border"
                style={{ background: STATUS_STYLE[s].fill, borderColor: STATUS_STYLE[s].stroke }}
              />
              {STATUS_STYLE[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="micro-label">Priority</span>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Priority">
          {PRIORITY_ORDER.map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={node.priority === p}
              className={`pill-btn !px-3 !py-1.5 !text-[12px] capitalize ${node.priority === p ? 'pill-btn--active' : ''}`}
              onClick={() => api.patchNode(node.id, { priority: p })}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="micro-label">Due</span>
          <input
            type="date"
            className="field-input"
            value={node.due ?? ''}
            onChange={(e) => api.patchNode(node.id, { due: e.target.value || undefined })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="micro-label">Assignee</span>
          <input
            className="field-input"
            placeholder="Name"
            value={node.assignee ?? ''}
            onChange={(e) => api.patchNode(node.id, { assignee: e.target.value || undefined })}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="micro-label">Note</span>
        <textarea
          className="field-input min-h-[64px] resize-y"
          placeholder="Context, links, acceptance criteria…"
          value={node.note ?? ''}
          onChange={(e) => api.patchNode(node.id, { note: e.target.value || undefined })}
        />
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#FF5F1F]"
          checked={Boolean(node.milestone)}
          onChange={(e) => api.patchNode(node.id, { milestone: e.target.checked })}
        />
        Milestone <span className="text-[rgb(136,136,136)]">(drawn as a diamond)</span>
      </label>

      {node.children.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="micro-label">
            Branch progress · {progress.done}/{progress.total} done
          </span>
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(17,17,17,0.1)]">
            <span
              className="block h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                background: progress.done === progress.total ? '#008a00' : '#FF5F1F',
              }}
            />
          </span>
        </div>
      )}

      {overloaded && (
        <p className="rounded-lg bg-[rgba(176,98,0,0.08)] p-2.5 text-[12.5px] leading-relaxed text-[#7a4500]">
          {node.children.length} direct items — past the 7±2 chunking limit (Miller, 1956).
          Group related items under an intermediate phase to keep this branch holdable in mind.
        </p>
      )}

      <div className="mt-1 flex flex-wrap gap-1.5 border-t border-dashed border-[rgba(17,17,17,0.25)] pt-3">
        <button className="pill-btn !text-[12px]" onClick={() => api.addChild(node.id)}>
          + Child
        </button>
        {!isRoot && (
          <button className="pill-btn !text-[12px]" onClick={() => api.addSibling(node.id)}>
            + Sibling
          </button>
        )}
        {node.children.length > 0 && (
          <button className="pill-btn !text-[12px]" onClick={() => api.toggleCollapse(node.id)}>
            {node.collapsed ? 'Expand' : 'Collapse'}
          </button>
        )}
        {!isRoot && (
          <button className="pill-btn !text-[12px]" onClick={() => api.setFocused(node.id)}>
            Focus
          </button>
        )}
        {!isRoot && (
          <button
            className="pill-btn !text-[12px] !text-[#c0391a] hover:!bg-[rgba(192,57,26,0.08)]"
            onClick={() => {
              if (window.confirm(`Delete “${node.title}” and its ${countDescendants(node)} sub-items?`)) {
                api.deleteNode(node.id)
                toast('Node deleted')
              }
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

function countDescendants(n: MindNode): number {
  return n.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0)
}

/* ---------------- links tab ---------------- */

function LinksTab({ api }: { api: MindMapApi }) {
  const [targetId, setTargetId] = useState('')
  const [direction, setDirection] = useState<'depends' | 'blocks'>('depends')
  const node = api.selectedId ? findNode(api.data.root, api.selectedId) : null

  const allNodes = useMemo(() => collectNodes(api.data.root), [api.data.root])

  if (!node) {
    return (
      <p className="text-[13px] leading-relaxed text-[rgb(60,60,60)]">
        Select a node to manage its dependencies. Cross-branch links are drawn on the canvas as
        amber arcs — the concept-mapping layer of the map.
      </p>
    )
  }

  const deps = api.data.dependencies
  const dependsOn = deps.filter((d) => d.to === node.id)
  const blocks = deps.filter((d) => d.from === node.id)

  const add = () => {
    if (!targetId) return
    const from = direction === 'depends' ? targetId : node.id
    const to = direction === 'depends' ? node.id : targetId
    const result = api.addDependency(from, to)
    if (!result.ok) {
      toast.error(result.reason ?? 'Could not add dependency')
    } else {
      toast.success('Dependency added')
      setTargetId('')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="micro-label">New link for “{node.title}”</span>
        <select
          className="field-input"
          value={direction}
          onChange={(e) => setDirection(e.target.value as 'depends' | 'blocks')}
        >
          <option value="depends">…depends on ↓</option>
          <option value="blocks">…blocks ↓</option>
        </select>
        <select className="field-input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          <option value="">Choose a task…</option>
          {allNodes
            .filter((n) => n.id !== node.id)
            .map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
        </select>
        <button className="pill-btn pill-btn--active self-start !text-[12px]" onClick={add} disabled={!targetId}>
          Add dependency
        </button>
      </div>

      {[
        { label: `Depends on (${dependsOn.length})`, list: dependsOn, other: (d: { from: string }) => d.from },
        { label: `Blocks (${blocks.length})`, list: blocks, other: (d: { to: string }) => d.to },
      ].map(({ label, list, other }) => (
        <div key={label} className="flex flex-col gap-1.5">
          <span className="micro-label">{label}</span>
          {list.length === 0 && <span className="text-[12px] text-[rgb(136,136,136)]">None</span>}
          {list.map((d) => {
            const otherNode = findNode(api.data.root, other(d as never))
            return (
              <div
                key={`${d.from}->${d.to}`}
                className="flex items-center gap-2 rounded-lg border border-[rgba(17,17,17,0.12)] px-2.5 py-1.5"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-[#b06200]" />
                <button
                  className="flex-1 truncate text-left text-[13px] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF5F1F]"
                  onClick={() => api.select(other(d as never))}
                >
                  {otherNode?.title ?? '—'}
                </button>
                <button
                  className="micro-label !text-[#c0391a] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF5F1F]"
                  onClick={() => api.removeDependency(d)}
                >
                  remove
                </button>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ---------------- data tab ---------------- */

function DataTab({ api }: { api: MindMapApi }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const slug = api.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cognimap'

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <section className="flex flex-col gap-2">
        <span className="micro-label">Export</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            className="pill-btn !text-[12px]"
            onClick={() => download(`${slug}.cognimap.json`, api.exportJSON(), 'application/json')}
          >
            JSON
          </button>
          <button
            className="pill-btn !text-[12px]"
            onClick={() => download(`${slug}.wbs.md`, toMarkdownWBS(api.data), 'text/markdown')}
          >
            Markdown WBS
          </button>
          <button
            className="pill-btn !text-[12px]"
            onClick={() => {
              navigator.clipboard
                .writeText(toMarkdownWBS(api.data))
                .then(() => toast.success('Work breakdown copied to clipboard'))
                .catch(() => toast.error('Clipboard unavailable'))
            }}
          >
            Copy outline
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="micro-label">Import</span>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            file.text().then((text) => {
              if (api.importJSON(text)) toast.success('Map imported')
              else toast.error('Not a valid CogniMap JSON file')
            })
            e.target.value = ''
          }}
        />
        <button className="pill-btn self-start !text-[12px]" onClick={() => fileRef.current?.click()}>
          Open JSON file…
        </button>
      </section>

      <section className="flex flex-col gap-2 border-t border-dashed border-[rgba(17,17,17,0.25)] pt-3">
        <span className="micro-label">Project</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            className="pill-btn !text-[12px]"
            onClick={() => {
              if (window.confirm('Replace the current map with the sample project?')) {
                api.loadSample()
                toast('Sample project loaded')
              }
            }}
          >
            Load sample
          </button>
          <button
            className="pill-btn !text-[12px]"
            onClick={() => {
              if (window.confirm('Start a new empty project? Your current map will be replaced.')) {
                api.newProject()
                toast('New project started')
              }
            }}
          >
            New project
          </button>
        </div>
        <p className="text-[12px] leading-relaxed text-[rgb(136,136,136)]">
          Your map auto-saves to this browser. Export JSON to move it between devices or into git.
        </p>
      </section>
    </div>
  )
}

/* ---------------- panel frame ---------------- */

export function Inspector({ api, open }: { api: MindMapApi; open: boolean }) {
  const [tab, setTab] = useState<Tab>('details')

  return (
    <aside
      className={`panel-surface absolute z-10 flex flex-col overflow-hidden rounded-2xl transition-all duration-[250ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] ${
        open
          ? 'pointer-events-auto opacity-100'
          : 'pointer-events-none translate-x-4 opacity-0'
      } inset-x-2 bottom-2 max-h-[52vh] md:inset-x-auto md:bottom-4 md:right-4 md:top-[76px] md:max-h-none md:w-[360px]`}
      aria-hidden={!open}
    >
      <div className="flex items-center gap-1 border-b border-[rgba(17,17,17,0.1)] px-3 pt-2.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-2.5 pb-2.5 pt-1 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF5F1F] ${
              tab === t.id ? 'text-[rgb(17,17,17)]' : 'text-[rgb(136,136,136)] hover:text-[rgb(17,17,17)]'
            }`}
            aria-selected={tab === t.id}
            role="tab"
          >
            {t.label}
            <span
              className={`absolute inset-x-2 bottom-0 h-[2px] rounded-full transition-opacity ${
                tab === t.id ? 'bg-[#FF5F1F] opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel">
        {tab === 'details' && <DetailsTab api={api} />}
        {tab === 'links' && <LinksTab api={api} />}
        {tab === 'science' && <SciencePanel api={api} />}
        {tab === 'data' && <DataTab api={api} />}
      </div>
    </aside>
  )
}
