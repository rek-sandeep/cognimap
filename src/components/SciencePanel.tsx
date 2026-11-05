import { useMemo, useState } from 'react'
import type { MindMapApi } from '@/hooks/useMindMap'
import { collectNodes, countByStatus } from '@/lib/mindmap'
import { CHUNK_LIMIT, WIP_LIMIT } from '@/types/mindmap'

interface Principle {
  name: string
  idea: string
  applied: string
  citation: string
}

const PRINCIPLES: Principle[] = [
  {
    name: 'Radiant thinking',
    idea:
      'Thought does not move in lists — it radiates outward from a central idea by association. Maps that grow from a core match the brain’s natural structure.',
    applied:
      'Your project lives at the center and every branch radiates outward. You navigate the map the way you think about the project: from goal to detail.',
    citation: 'Buzan, T. (1974). Use Your Head. BBC Books.',
  },
  {
    name: 'Chunking & the 7±2 limit',
    idea:
      'Working memory holds roughly seven (plus or minus two) chunks at once — and the focus of attention may be closer to four. Long flat lists overflow it; grouped hierarchies recycle the same capacity.',
    applied: `When a branch grows past ${CHUNK_LIMIT} items, CogniMap flags it with an amber badge and suggests grouping the items into an intermediate phase — turning 9 loose tasks into 3 memorable chunks.`,
    citation:
      'Miller, G. A. (1956). Psychological Review, 63(2), 81–97 · Cowan, N. (2001). Behavioral and Brain Sciences, 24(1).',
  },
  {
    name: 'Cognitive load theory',
    idea:
      'Working memory is limited; performance drops when extraneous load crowds out the task itself. Good design removes anything that does not serve the current goal.',
    applied:
      'Collapse branches you are not working on, or enter Focus mode (F) to isolate a single workstream. Everything irrelevant disappears, so planning happens with a clear head.',
    citation:
      'Sweller, J. (2020). Educational Technology Research and Development, 68, 1–16 · Kirschner, P. A. (2002). Learning and Instruction, 12(1) · Van Merriënboer & Sweller (2010). Medical Education, 44(1).',
  },
  {
    name: 'Dual coding',
    idea:
      'Verbal and visual information are processed through separate channels; encoding both ways roughly doubles the routes back to a memory.',
    applied:
      'No node carries meaning in text alone: shape says what kind of thing it is (phase, workstream, task, milestone), color says its status, ring weight says priority, and the arc says progress.',
    citation: 'Paivio, A. (1971). Imagery and Verbal Processes. Holt, Rinehart & Winston.',
  },
  {
    name: 'Concept mapping',
    idea:
      'Meaningful learning happens when new ideas are explicitly linked to existing ones — the cross-links between concepts are where understanding lives.',
    applied:
      'Dependencies are first-class links across branches, drawn as amber arcs. The cycle check protects you from logically impossible plans — a loop has no valid starting point.',
    citation:
      'Novak, J. D., & Cañas, A. J. (2008). The Theory Underlying Concept Maps and How to Construct and Use Them. IHMC.',
  },
  {
    name: 'Does mind mapping work?',
    idea:
      'In a controlled study, medical students using mind maps showed significantly higher long-term recall than their usual study techniques; a 2023 meta-analysis of 21 studies found a significant positive effect on cognitive learning outcomes.',
    applied:
      'The same mechanism applies to projects: a plan you can see whole is a plan you actually remember in the meeting.',
    citation:
      'Farrand, P., Hussain, F., & Hennessy, E. (2002). Medical Education, 36(5), 426–431 · Shi, Y., Yang, H., Dou, Y., & Zeng, Y. (2023). Asia Pacific Education Review, 24.',
  },
]

export function SciencePanel({ api }: { api: MindMapApi }) {
  const [open, setOpen] = useState<number>(0)
  const stats = useMemo(() => countByStatus(api.data.root), [api.data.root])
  const overloaded = useMemo(
    () => collectNodes(api.data.root).filter((n) => n.children.length > CHUNK_LIMIT),
    [api.data.root],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* live cognitive health */}
      <section className="rounded-lg border border-[rgba(17,17,17,0.12)] p-3">
        <div className="micro-label mb-2">Cognitive health — live</div>
        <ul className="flex flex-col gap-2 text-[13px]">
          <li className="flex items-start gap-2">
            <span
              className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: stats.doing > WIP_LIMIT ? '#b06200' : '#008a00' }}
            />
            <span>
              <strong>{stats.doing}</strong> task{stats.doing === 1 ? '' : 's'} in progress
              {stats.doing > WIP_LIMIT
                ? ` — above the ~${WIP_LIMIT}-item focus of attention. Finish or pause some before starting more.`
                : ` — within the ~${WIP_LIMIT}-item focus of attention.`}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span
              className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: overloaded.length ? '#b06200' : '#008a00' }}
            />
            <span>
              {overloaded.length === 0 ? (
                <>Every branch fits within the 7±2 chunking limit.</>
              ) : (
                <>
                  {overloaded.length} branch{overloaded.length === 1 ? '' : 'es'} past the 7±2
                  chunking limit:{' '}
                  {overloaded.map((n, i) => (
                    <span key={n.id}>
                      {i > 0 && ', '}
                      <button
                        className="font-medium text-[#b06200] underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF5F1F]"
                        onClick={() => api.select(n.id)}
                      >
                        {n.title}
                      </button>
                    </span>
                  ))}
                  . Group items under intermediate phases.
                </>
              )}
            </span>
          </li>
        </ul>
      </section>

      {/* principles accordion */}
      <section>
        <div className="micro-label mb-2">Why this works — the research</div>
        <div className="flex flex-col">
          {PRINCIPLES.map((p, i) => {
            const expanded = open === i
            return (
              <div key={p.name} className="border-b border-dashed border-[rgba(17,17,17,0.3)]">
                <button
                  className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-[13px] font-semibold text-[rgb(17,17,17)] hover:text-[#FF5F1F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF5F1F]"
                  onClick={() => setOpen(expanded ? -1 : i)}
                  aria-expanded={expanded}
                >
                  {p.name}
                  <span
                    className="accordion-chevron font-mono-ui text-[13px] text-[rgb(136,136,136)]"
                    style={{ transform: expanded ? 'rotate(45deg)' : 'none' }}
                    aria-hidden
                  >
                    +
                  </span>
                </button>
                {expanded && (
                  <div className="flex flex-col gap-2 pb-3 text-[13px] leading-relaxed text-[rgb(60,60,60)]">
                    <p>{p.idea}</p>
                    <p>
                      <span className="micro-label mr-1">In CogniMap</span>
                      {p.applied}
                    </p>
                    <p className="font-mono-ui text-[11px] leading-relaxed text-[rgb(136,136,136)]">
                      {p.citation}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
