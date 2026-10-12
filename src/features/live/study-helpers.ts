import type { StudyAnnotation, StudyMapNode } from '../../../shared/study.ts'

export function promptSegments(text: string, annotations: StudyAnnotation[], locale: 'vi' | 'en') {
  const marks = annotations.filter(
    (item) => item.locale === locale && text.slice(item.start, item.end) === item.quote,
  )
  const bounds = [
    ...new Set([0, text.length, ...marks.flatMap((item) => [item.start, item.end])]),
  ].sort((a, b) => a - b)
  return bounds.slice(0, -1).map((start, index) => ({
    start,
    text: text.slice(start, bounds[index + 1]),
    highlighted: marks.some((item) => item.start <= start && item.end >= bounds[index + 1]!),
  }))
}

export function removeMapBranch(nodes: StudyMapNode[], id: string): StudyMapNode[] {
  const remove = new Set([id])
  let changed = true
  while (changed) {
    changed = false
    for (const node of nodes)
      if (node.parentId && remove.has(node.parentId) && !remove.has(node.id)) {
        remove.add(node.id)
        changed = true
      }
  }
  return nodes.filter((node) => !remove.has(node.id))
}

export function layoutMap(nodes: StudyMapNode[]) {
  const positions = new Map<string, { x: number; y: number }>()
  let row = 0
  const walk = (id: string, depth: number) => {
    const children = nodes.filter((node) => node.parentId === id)
    const first = row
    for (const child of children) walk(child.id, depth + 1)
    if (!children.length) row++
    positions.set(id, { x: 20 + depth * 200, y: 20 + ((first + row - 1) / 2) * 72 })
  }
  const root = nodes.find((node) => node.parentId === null)
  if (root) walk(root.id, 0)
  return {
    positions,
    width: Math.max(520, ...[...positions.values()].map((point) => point.x + 190)),
    height: Math.max(190, row * 72 + 30),
  }
}
