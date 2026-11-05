import type { MindMapData, MindNode } from '@/types/mindmap'
import { createNode } from './mindmap'

function task(
  title: string,
  partial: Partial<MindNode> = {},
  children: MindNode[] = [],
): MindNode {
  return createNode(title, { ...partial, children })
}

/** A realistic sample: website relaunch project. */
export function sampleProject(): MindMapData {
  const discovery = task('Discovery', { status: 'doing', priority: 'high' }, [
    task('Stakeholder interviews', { status: 'done', assignee: 'Amara', due: '2026-11-14' }),
    task('Analytics audit', { status: 'done', assignee: 'Ravi' }),
    task('User survey (n=200)', { status: 'doing', assignee: 'Amara', due: '2026-11-21' }),
    task('Competitor teardown', { status: 'todo', assignee: 'Lena' }),
  ])

  const information = task('Information architecture', { status: 'todo', priority: 'high' }, [
    task('Sitemap v2', { status: 'todo', assignee: 'Lena', milestone: true }),
    task('Content inventory', { status: 'todo' }),
    task('Navigation card-sort', { status: 'todo', assignee: 'Ravi' }),
  ])

  const design = task('Design', { status: 'todo', priority: 'high' }, [
    task('Moodboards', { status: 'done', assignee: 'Lena' }),
    task('Wireframes — core flows', { status: 'doing', assignee: 'Lena', due: '2026-11-28' }),
    task('Design system tokens', { status: 'todo' }),
    task('Hi-fi mockups', { status: 'todo', milestone: true, due: '2026-12-19' }),
    task('Usability testing round 1', { status: 'todo' }),
  ])

  const build = task('Build', { status: 'todo' }, [
    task('CMS migration', { status: 'todo', assignee: 'Ravi', priority: 'high' }),
    task('Frontend implementation', { status: 'todo', priority: 'high' }),
    task('SEO redirects map', { status: 'todo', priority: 'medium' }),
    task('Accessibility pass (WCAG 2.2)', { status: 'todo' }),
    task('Performance budget < 1.5MB', { status: 'todo', priority: 'low' }),
    task('QA on staging', { status: 'todo' }),
    task('Analytics wiring', { status: 'todo' }),
    task('Content entry', { status: 'blocked', note: 'Waiting on legal approval of copy' }),
  ])

  const launch = task('Launch', { status: 'todo' }, [
    task('Go/no-go review', { status: 'todo', milestone: true, due: '2027-01-15' }),
    task('Rollback plan', { status: 'todo' }),
    task('Announcement & comms', { status: 'todo', assignee: 'Amara' }),
  ])

  const root = createNode('Website Relaunch', {
    status: 'doing',
    priority: 'high',
    children: [discovery, information, design, build, launch],
  })

  return {
    version: 1,
    name: 'Website Relaunch',
    root,
    dependencies: [],
  }
}

export function withSampleDependencies(data: MindMapData): MindMapData {
  const byTitle = (n: typeof data.root, t: string): string | null => {
    if (n.title === t) return n.id
    for (const c of n.children) {
      const hit = byTitle(c, t)
      if (hit) return hit
    }
    return null
  }
  const pairs: Array<[string, string]> = [
    ['Sitemap v2', 'Wireframes — core flows'],
    ['Wireframes — core flows', 'Hi-fi mockups'],
    ['CMS migration', 'Content entry'],
    ['Hi-fi mockups', 'Frontend implementation'],
    ['QA on staging', 'Go/no-go review'],
  ]
  const dependencies = pairs
    .map(([a, b]) => ({ from: byTitle(data.root, a), to: byTitle(data.root, b) }))
    .filter((d): d is { from: string; to: string } => Boolean(d.from && d.to))
  return { ...data, dependencies }
}

export function defaultProject(): MindMapData {
  return withSampleDependencies(sampleProject())
}

export function emptyProject(): MindMapData {
  const root = createNode('New Project', {
    status: 'doing',
    children: [task('Phase 1', {}, [task('First task')])],
  })
  return { version: 1, name: 'New Project', root, dependencies: [] }
}
