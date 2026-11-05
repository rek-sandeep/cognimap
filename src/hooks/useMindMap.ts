import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dependency, MindMapData, MindNode } from '@/types/mindmap'
import {
  createNode,
  findNode,
  insertChild,
  insertSiblingAfter,
  isDescendant,
  parseMap,
  removeNode,
  serialize,
  updateNode,
  wouldCycle,
} from '@/lib/mindmap'
import { defaultProject, emptyProject } from '@/lib/sample'

const STORAGE_KEY = 'cognimap.v1'

function loadInitial(): MindMapData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = parseMap(raw)
      if (parsed) return parsed
    }
  } catch {
    /* corrupted storage → fall through to sample */
  }
  return defaultProject()
}

export interface MindMapApi {
  data: MindMapData
  selectedId: string | null
  focusedId: string | null
  select: (id: string | null) => void
  setFocused: (id: string | null) => void
  patchNode: (id: string, patch: Partial<MindNode>) => void
  addChild: (parentId: string) => string
  addSibling: (id: string) => string | null
  deleteNode: (id: string) => void
  toggleCollapse: (id: string) => void
  renameProject: (name: string) => void
  addDependency: (from: string, to: string) => { ok: boolean; reason?: string }
  removeDependency: (dep: Dependency) => void
  importJSON: (json: string) => boolean
  exportJSON: () => string
  loadSample: () => void
  newProject: () => void
}

export function useMindMap(): MindMapApi {
  const [data, setData] = useState<MindMapData>(loadInitial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serialize(data))
    } catch {
      /* storage full/blocked — session still works */
    }
  }, [data])

  const select = useCallback((id: string | null) => setSelectedId(id), [])
  const setFocused = useCallback((id: string | null) => {
    setFocusedId(id)
    setSelectedId(null)
  }, [])

  const patchNode = useCallback((id: string, patch: Partial<MindNode>) => {
    setData((d) => ({ ...d, root: updateNode(d.root, id, patch) }))
  }, [])

  const addChild = useCallback((parentId: string) => {
    const node = createNode('New task')
    setData((d) => {
      const parent = findNode(d.root, parentId)
      const root = insertChild(d.root, parentId, node)
      // auto-expand a collapsed parent so the new node is visible
      return { ...d, root: parent?.collapsed ? updateNode(root, parentId, { collapsed: false }) : root }
    })
    setSelectedId(node.id)
    return node.id
  }, [])

  const addSibling = useCallback((id: string) => {
    let created: string | null = null
    setData((d) => {
      if (d.root.id === id) return d // root has no siblings
      const node = createNode('New task')
      created = node.id
      return { ...d, root: insertSiblingAfter(d.root, id, node) }
    })
    if (created) setSelectedId(created)
    return created
  }, [])

  const dataRef = useRef(data)
  dataRef.current = data

  const deleteNode = useCallback((id: string) => {
    const d = dataRef.current
    if (d.root.id === id) return // never delete the project root
    const root = removeNode(d.root, id)
    setData({
      ...d,
      root,
      dependencies: d.dependencies.filter(
        (dep) =>
          dep.from !== id &&
          dep.to !== id &&
          findNode(root, dep.from) &&
          findNode(root, dep.to),
      ),
    })
    setSelectedId((sel) => (sel === id ? null : sel))
    // drop focus only if the focused node lived inside the deleted subtree
    setFocusedId((f) => (f && !findNode(root, f) ? null : f))
  }, [])

  const toggleCollapse = useCallback((id: string) => {
    setData((d) => {
      const node = findNode(d.root, id)
      if (!node || node.children.length === 0) return d
      return { ...d, root: updateNode(d.root, id, { collapsed: !node.collapsed }) }
    })
  }, [])

  const renameProject = useCallback((name: string) => {
    setData((d) => ({ ...d, name, root: { ...d.root, title: name || d.root.title } }))
  }, [])

  const addDependency = useCallback((from: string, to: string) => {
    const d = dataRef.current
    if (from === to) {
      return { ok: false, reason: 'A task cannot depend on itself.' }
    }
    if (!findNode(d.root, from) || !findNode(d.root, to)) {
      return { ok: false, reason: 'Unknown node.' }
    }
    if (isDescendant(d.root, from, to) || isDescendant(d.root, to, from)) {
      return {
        ok: false,
        reason: 'Dependencies link separate branches — parent/child tasks are already ordered.',
      }
    }
    if (d.dependencies.some((dep) => dep.from === from && dep.to === to)) {
      return { ok: false, reason: 'That dependency already exists.' }
    }
    if (wouldCycle(d.dependencies, from, to)) {
      return {
        ok: false,
        reason: 'Circular dependency — this would create a loop with no valid start point.',
      }
    }
    setData({ ...d, dependencies: [...d.dependencies, { from, to }] })
    return { ok: true } as { ok: boolean; reason?: string }
  }, [])

  const removeDependency = useCallback((dep: Dependency) => {
    setData((d) => ({
      ...d,
      dependencies: d.dependencies.filter((x) => !(x.from === dep.from && x.to === dep.to)),
    }))
  }, [])

  const importJSON = useCallback((json: string) => {
    const parsed = parseMap(json)
    if (!parsed) return false
    setData(parsed)
    setSelectedId(null)
    setFocusedId(null)
    return true
  }, [])

  const exportJSON = useCallback(() => serialize(data), [data])

  const loadSample = useCallback(() => {
    setData(defaultProject())
    setSelectedId(null)
    setFocusedId(null)
  }, [])

  const newProject = useCallback(() => {
    setData(emptyProject())
    setSelectedId(null)
    setFocusedId(null)
  }, [])

  return useMemo(
    () => ({
      data,
      selectedId,
      focusedId,
      select,
      setFocused,
      patchNode,
      addChild,
      addSibling,
      deleteNode,
      toggleCollapse,
      renameProject,
      addDependency,
      removeDependency,
      importJSON,
      exportJSON,
      loadSample,
      newProject,
    }),
    [
      data,
      selectedId,
      focusedId,
      select,
      setFocused,
      patchNode,
      addChild,
      addSibling,
      deleteNode,
      toggleCollapse,
      renameProject,
      addDependency,
      removeDependency,
      importJSON,
      exportJSON,
      loadSample,
      newProject,
    ],
  )
}
