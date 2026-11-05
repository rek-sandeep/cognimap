import type {
  Dependency,
  LayoutPoint,
  MindMapData,
  MindNode,
  NodePriority,
  NodeStatus,
} from '@/types/mindmap'

export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}

export function createNode(title: string, partial: Partial<MindNode> = {}): MindNode {
  return {
    id: uid(),
    title,
    status: 'todo',
    priority: 'medium',
    children: [],
    ...partial,
  }
}

/* ---------------- immutable tree helpers ---------------- */

export function findNode(node: MindNode, id: string): MindNode | null {
  if (node.id === id) return node
  for (const c of node.children) {
    const hit = findNode(c, id)
    if (hit) return hit
  }
  return null
}

export function findParent(node: MindNode, id: string): MindNode | null {
  for (const c of node.children) {
    if (c.id === id) return node
    const hit = findParent(c, id)
    if (hit) return hit
  }
  return null
}

export function updateNode(root: MindNode, id: string, patch: Partial<MindNode>): MindNode {
  if (root.id === id) return { ...root, ...patch }
  return {
    ...root,
    children: root.children.map((c) => updateNode(c, id, patch)),
  }
}

export function removeNode(root: MindNode, id: string): MindNode {
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== id)
      .map((c) => removeNode(c, id)),
  }
}

export function insertChild(root: MindNode, parentId: string, child: MindNode): MindNode {
  if (root.id === parentId) return { ...root, children: [...root.children, child] }
  return {
    ...root,
    children: root.children.map((c) => insertChild(c, parentId, child)),
  }
}

export function insertSiblingAfter(root: MindNode, siblingId: string, node: MindNode): MindNode {
  const idx = root.children.findIndex((c) => c.id === siblingId)
  if (idx >= 0) {
    const children = [...root.children]
    children.splice(idx + 1, 0, node)
    return { ...root, children }
  }
  return {
    ...root,
    children: root.children.map((c) => insertSiblingAfter(c, siblingId, node)),
  }
}

export function isDescendant(root: MindNode, ancestorId: string, id: string): boolean {
  const anc = findNode(root, ancestorId)
  if (!anc) return false
  return findNode(anc, id) !== null && ancestorId !== id
}

/* ---------------- analytics ---------------- */

export interface Progress {
  done: number
  total: number
}

/** Rollup over the node's descendants (a parent has no status of its own). */
export function computeProgress(node: MindNode): Progress {
  let done = 0
  let total = 0
  const walk = (n: MindNode, isRoot: boolean) => {
    if (!isRoot && n.children.length === 0) {
      total += 1
      if (n.status === 'done') done += 1
    }
    n.children.forEach((c) => walk(c, false))
  }
  walk(node, true)
  // parent that is itself a leaf counts as one task
  if (total === 0 && node.children.length === 0) {
    total = 1
    if (node.status === 'done') done = 1
  }
  return { done, total }
}

export function countByStatus(root: MindNode): Record<NodeStatus, number> {
  const counts: Record<NodeStatus, number> = { todo: 0, doing: 0, done: 0, blocked: 0 }
  const walk = (n: MindNode) => {
    if (n.children.length === 0) counts[n.status] += 1
    n.children.forEach(walk)
  }
  walk(root)
  return counts
}

export function collectNodes(root: MindNode): MindNode[] {
  const out: MindNode[] = []
  const walk = (n: MindNode) => {
    out.push(n)
    n.children.forEach(walk)
  }
  walk(root)
  return out
}

/* ---------------- dependencies ---------------- */

/** True if adding from→to would create a cycle (to already reaches from). */
export function wouldCycle(deps: Dependency[], from: string, to: string): boolean {
  if (from === to) return true
  const adj = new Map<string, string[]>()
  for (const d of deps) {
    const list = adj.get(d.from) ?? []
    list.push(d.to)
    adj.set(d.from, list)
  }
  // does `to` reach `from`?
  const stack = [to]
  const seen = new Set<string>()
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === from) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const nxt of adj.get(cur) ?? []) stack.push(nxt)
  }
  return false
}

/* ---------------- radial layout (radiant thinking) ---------------- */

const RING_GAP = 190
const ROOT_RADIUS = 0

function leafCount(node: MindNode): number {
  if (node.collapsed || node.children.length === 0) return 1
  return node.children.reduce((sum, c) => sum + leafCount(c), 0)
}

/**
 * Balloon/radial layout: every subtree receives an angular wedge proportional
 * to its visible leaf count; depth maps to ring radius. Root sits at center —
 * the map literally radiates from the project core.
 */
export function layoutRadial(root: MindNode): Map<string, LayoutPoint> {
  const points = new Map<string, LayoutPoint>()
  const total = leafCount(root)

  const place = (node: MindNode, startAngle: number, wedge: number, depth: number) => {
    const angle = startAngle + wedge / 2
    const r = depth === 0 ? ROOT_RADIUS : depth * RING_GAP
    points.set(node.id, {
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      angle,
      depth,
      leafCount: leafCount(node),
      hiddenChildren: node.collapsed ? node.children.length : 0,
    })
    if (node.collapsed) return
    let cursor = startAngle
    for (const child of node.children) {
      const childWedge = (leafCount(child) / total) * Math.PI * 2
      place(child, cursor, childWedge, depth + 1)
      cursor += childWedge
    }
  }

  place(root, 0, Math.PI * 2, 0)
  return points
}

/* ---------------- export ---------------- */

const STATUS_MARK: Record<NodeStatus, string> = {
  todo: '[ ]',
  doing: '[~]',
  done: '[x]',
  blocked: '[!]',
}

const PRIORITY_MARK: Record<NodePriority, string> = {
  high: ' !!!',
  medium: '',
  low: ' (low)',
}

export function toMarkdownWBS(data: MindMapData): string {
  const lines: string[] = [`# ${data.name}`, '']
  const walk = (n: MindNode, depth: number) => {
    const indent = '  '.repeat(depth)
    const meta: string[] = []
    if (n.milestone) meta.push('◆ milestone')
    if (n.due) meta.push(`due ${n.due}`)
    if (n.assignee) meta.push(`@${n.assignee}`)
    const metaStr = meta.length ? ` — *${meta.join(' · ')}*` : ''
    lines.push(
      `${indent}- ${STATUS_MARK[n.status]} **${n.title}**${PRIORITY_MARK[n.priority]}${metaStr}`,
    )
    n.children.forEach((c) => walk(c, depth + 1))
  }
  walk(data.root, 0)
  if (data.dependencies.length) {
    lines.push('', '## Dependencies', '')
    for (const d of data.dependencies) {
      const from = findNode(data.root, d.from)
      const to = findNode(data.root, d.to)
      if (from && to) lines.push(`- ${from.title} → ${to.title}`)
    }
  }
  return lines.join('\n')
}

export function serialize(data: MindMapData): string {
  return JSON.stringify(data, null, 2)
}

export function parseMap(json: string): MindMapData | null {
  try {
    const raw = JSON.parse(json) as MindMapData
    if (!raw || typeof raw !== 'object' || !raw.root || !Array.isArray(raw.root.children)) {
      return null
    }
    return {
      version: 1,
      name: typeof raw.name === 'string' ? raw.name : 'Untitled project',
      root: raw.root,
      dependencies: Array.isArray(raw.dependencies) ? raw.dependencies : [],
    }
  } catch {
    return null
  }
}
