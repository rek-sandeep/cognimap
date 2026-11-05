export type NodeStatus = 'todo' | 'doing' | 'done' | 'blocked'
export type NodePriority = 'low' | 'medium' | 'high'

export interface MindNode {
  id: string
  title: string
  note?: string
  status: NodeStatus
  priority: NodePriority
  due?: string
  assignee?: string
  milestone?: boolean
  collapsed?: boolean
  children: MindNode[]
}

/** `from` must be completed before `to` can start. */
export interface Dependency {
  from: string
  to: string
}

export interface MindMapData {
  version: 1
  name: string
  root: MindNode
  dependencies: Dependency[]
}

export interface LayoutPoint {
  x: number
  y: number
  angle: number
  depth: number
  leafCount: number
  hiddenChildren: number
}

export const CHUNK_LIMIT = 7 // Miller (1956): 7±2 chunks in working memory
export const WIP_LIMIT = 4 // Cowan (2001): ~4 items in the focus of attention
