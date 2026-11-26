export interface OutlineRect {
  left: number
  top: number
  right: number
  bottom: number
}

interface Point {
  x: number
  y: number
}

export function annotationTextRects(range: Range) {
  const root = range.commonAncestorContainer
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const rects: DOMRect[] = []
  const text = document.createRange()
  for (let node = root instanceof Text ? root : walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node instanceof Text) || !range.intersectsNode(node)) continue
    if (node.parentElement?.closest("script, style, .katex-mathml, [data-footnote-ref], [data-footnote-backref]")) continue
    const start = node === range.startContainer ? range.startOffset : 0
    const end = node === range.endContainer ? range.endOffset : node.length
    const value = node.data.slice(start, end)
    if (!value.trim()) continue
    text.setStart(node, start + value.length - value.trimStart().length)
    text.setEnd(node, start + value.trimEnd().length)
    rects.push(...Array.from(text.getClientRects(), (rect) => rect).filter(({ width, height }) => width > 0 && height > 0))
  }
  return rects
}

function contourPoints(rects: readonly OutlineRect[], padding: number) {
  const ordered = [...rects].sort((a, b) => a.top - b.top || a.left - b.left)
  const rows: OutlineRect[] = []
  for (const { left, right, top, bottom } of ordered) {
    const previous = rows.at(-1)
    if (previous && top < previous.bottom && bottom > previous.top) {
      previous.left = Math.min(previous.left, left)
      previous.right = Math.max(previous.right, right)
      previous.bottom = Math.max(previous.bottom, bottom)
    } else {
      rows.push({ left, top, right, bottom })
    }
  }

  const first = rows[0]
  const last = rows.at(-1)!
  const left: Point[] = [{ x: first.left - padding, y: first.top - padding }]
  const right: Point[] = [{ x: first.right + padding, y: first.top - padding }]
  for (let index = 1; index < rows.length; index++) {
    const previous = rows[index - 1]
    const row = rows[index]
    const middle = (previous.bottom + row.top) / 2
    // Disjoint line ends need two distinct turns to form a continuous outline.
    const bridge = Math.min(3, Math.max(1, (row.top - previous.bottom) / 4))
    const rightY = middle + (previous.left >= row.right ? bridge : previous.right <= row.left ? -bridge : 0)
    const leftY = 2 * middle - rightY
    const previousRight = right.at(-1)!.x
    const previousLeft = left.at(-1)!.x
    if (Math.abs(previousRight - row.right - padding) > 0.1) {
      right.push({ x: previousRight, y: rightY }, { x: row.right + padding, y: rightY })
    }
    if (Math.abs(previousLeft - row.left + padding) > 0.1) {
      left.push({ x: previousLeft, y: leftY }, { x: row.left - padding, y: leftY })
    }
  }
  return [left[0], ...right, { x: right.at(-1)!.x, y: last.bottom + padding }, { x: left.at(-1)!.x, y: last.bottom + padding }, ...left.slice(1).reverse()]
}

export function createAnnotationContour(rects: readonly OutlineRect[], padding: number, radius: number) {
  const points = contourPoints(rects, padding)
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  const corners = points.map((point, index) => {
    const previous = points.at(index - 1)!
    const next = points[(index + 1) % points.length]
    const nextLength = distance(point, next)
    return { ...point, next, nextLength, radius: Math.min(radius, distance(previous, point) / 2, nextLength / 2) }
  })
  const start = corners[0]
  const path = new Path2D()
  path.moveTo(start.x + start.radius, start.y)
  let length = 0
  const turns: number[] = []
  for (let index = 1; index <= corners.length; index++) {
    const previous = corners[index - 1]
    const corner = corners[index % corners.length]
    path.arcTo(corner.x, corner.y, corner.next.x, corner.next.y, corner.radius)
    const arc = (Math.PI * corner.radius) / 2
    length += previous.nextLength - previous.radius - corner.radius
    turns.push(length + arc / 2)
    length += arc
  }
  path.closePath()
  return { path, length, turns }
}
