import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ArrowCounterClockwise, GitBranch, PencilLine, Plus, Trash } from '@phosphor-icons/react'
import { studyLimits, type StudyWorkspace, type StudyStroke } from '../../../shared/study'
import type { Locale } from '../../../shared/portal'
import { layoutMap, removeMapBranch } from '@/features/live/study-helpers'

export function WritingMap({
  value,
  onChange,
  locale,
  disabled,
  onDrawingChange,
}: {
  value: StudyWorkspace['mindMap']
  onChange: (next: StudyWorkspace['mindMap']) => void
  locale: Locale
  disabled: boolean
  onDrawingChange?: (drawing: boolean) => void
}) {
  const [mode, setMode] = useState<'map' | 'draw'>('map')
  const [selected, setSelected] = useState('')
  const [stroke, setStroke] = useState<StudyStroke | null>(null)
  const pending = useRef<StudyStroke | null>(null)
  const drawingPointer = useRef<number | null>(null)
  const isDrawing = stroke !== null
  useEffect(() => {
    onDrawingChange?.(isDrawing)
  }, [isDrawing, onDrawingChange])
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const current = value.nodes.find((node) => node.id === selected) ?? value.nodes[0]
  const layout = layoutMap(value.nodes)
  const points = value.strokes.reduce((sum, item) => sum + item.points.length, 0)
  const point = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    }
  }
  const finish = (event: PointerEvent<SVGSVGElement>) => {
    if (drawingPointer.current !== event.pointerId) return
    const completed = pending.current
    pending.current = null
    drawingPointer.current = null
    setStroke(null)
    onDrawingChange?.(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    // Keep a stroke already started even if access or prompt versions changed mid-gesture.
    if (completed && completed.points.length)
      onChange({ ...value, strokes: [...value.strokes, completed] })
  }
  return (
    <section className="mis-panel mis-stack study-map">
      <div className="live-heading">
        <div>
          <h2>{t('Không gian lên ý tưởng', 'Planning space')}</h2>
          <p className="live-help">
            {t(
              'Sơ đồ và bản vẽ cùng được giữ lại. Chỉ bạn xem được; không gửi kèm bài nộp.',
              'Both your map and drawing are kept. Private to you; excluded from submissions.',
            )}
          </p>
        </div>
        <div className="study-mode" aria-label={t('Kiểu lên ý tưởng', 'Planning mode')}>
          <button
            className="mis-button"
            aria-pressed={mode === 'map'}
            disabled={isDrawing}
            onClick={() => setMode('map')}
          >
            <GitBranch size={18} aria-hidden="true" />
            {t('Nút & nhánh', 'Nodes & branches')}
          </button>
          <button
            className="mis-button"
            aria-pressed={mode === 'draw'}
            disabled={isDrawing}
            onClick={() => setMode('draw')}
          >
            <PencilLine size={18} aria-hidden="true" />
            {t('Vẽ tay', 'Freehand')}
          </button>
        </div>
      </div>
      {mode === 'map' ? (
        <>
          {/* This overflow region needs focus so keyboard users can scroll a wide map. */}
          {/* eslint-disable jsx-a11y/no-noninteractive-tabindex */}
          <div
            className="study-map-scroll"
            tabIndex={0}
            role="region"
            aria-label={t('Sơ đồ ý tưởng', 'Idea map')}
          >
            {value.nodes.length ? (
              <div
                className="study-map-canvas"
                style={{ width: layout.width, height: layout.height }}
              >
                <svg
                  className="study-map-lines"
                  width={layout.width}
                  height={layout.height}
                  aria-hidden="true"
                >
                  {value.nodes.map((node) => {
                    const from = node.parentId && layout.positions.get(node.parentId)
                    const to = layout.positions.get(node.id)
                    return from && to ? (
                      <path
                        key={node.id}
                        d={`M ${from.x + 166} ${from.y + 25} C ${from.x + 185} ${from.y + 25}, ${to.x - 20} ${to.y + 25}, ${to.x} ${to.y + 25}`}
                      />
                    ) : null
                  })}
                </svg>
                {value.nodes.map((node) => {
                  const position = layout.positions.get(node.id)!
                  return (
                    <button
                      key={node.id}
                      className="study-map-node"
                      aria-pressed={current?.id === node.id}
                      style={{ left: position.x, top: position.y }}
                      onClick={() => setSelected(node.id)}
                    >
                      {node.text || t('Ý chưa đặt tên', 'Untitled idea')}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="study-map-empty">
                {t(
                  'Bắt đầu với ý chính, rồi thêm các nhánh để xây dựng dàn ý.',
                  'Start with a central idea, then add branches to build your outline.',
                )}
              </p>
            )}
          </div>
          {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
          <fieldset className="live-fieldset study-map-edit" disabled={disabled}>
            {current && (
              <label className="mis-field">
                {t('Nội dung ý đang chọn', 'Selected idea')}
                <textarea
                  rows={2}
                  maxLength={300}
                  value={current.text}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      nodes: value.nodes.map((node) =>
                        node.id === current.id ? { ...node, text: event.target.value } : node,
                      ),
                    })
                  }
                />
              </label>
            )}
            <div className="live-actions">
              <button
                className="mis-button"
                disabled={value.nodes.length >= 80}
                onClick={() => {
                  const id = crypto.randomUUID()
                  onChange({
                    ...value,
                    nodes: [
                      ...value.nodes,
                      { id, parentId: current?.id ?? null, text: t('Ý mới', 'New idea') },
                    ],
                  })
                  setSelected(id)
                }}
              >
                <Plus size={18} aria-hidden="true" />
                {current ? t('Thêm nhánh', 'Add branch') : t('Thêm ý chính', 'Add central idea')}
              </button>
              {current && (
                <button
                  className="mis-button"
                  onClick={() => {
                    onChange({ ...value, nodes: removeMapBranch(value.nodes, current.id) })
                    setSelected('')
                  }}
                >
                  <Trash size={18} aria-hidden="true" />
                  {t('Xóa ý và nhánh con', 'Delete idea and branches')}
                </button>
              )}
            </div>
          </fieldset>
        </>
      ) : (
        <>
          <p className="live-help" id="study-draw-help">
            {t(
              'Dùng chuột, bút hoặc ngón tay để vẽ trong khung. Dùng sơ đồ nút–nhánh khi thao tác bằng bàn phím.',
              'Draw inside the board with a mouse, pen or finger. Use nodes and branches for keyboard input.',
            )}
          </p>
          <svg
            className="study-drawing"
            viewBox="0 0 1000 540"
            preserveAspectRatio="none"
            role="img"
            aria-label={t('Bảng vẽ ý tưởng riêng', 'Private idea drawing board')}
            aria-describedby="study-draw-help"
            onPointerDown={(event) => {
              if (
                disabled ||
                drawingPointer.current !== null ||
                value.strokes.length >= 100 ||
                points >= 10000 ||
                event.button !== 0
              )
                return
              event.currentTarget.setPointerCapture(event.pointerId)
              drawingPointer.current = event.pointerId
              pending.current = { id: crypto.randomUUID(), points: [point(event)] }
              setStroke(pending.current)
              onDrawingChange?.(true)
            }}
            onPointerMove={(event) => {
              if (drawingPointer.current !== event.pointerId || !pending.current || disabled) return
              const next = point(event)
              const previous = pending.current.points.at(-1)!
              if (
                Math.hypot(next.x - previous.x, next.y - previous.y) < 0.002 ||
                pending.current.points.length >= 500 ||
                points + pending.current.points.length >= 10000
              )
                return
              pending.current = { ...pending.current, points: [...pending.current.points, next] }
              setStroke(pending.current)
            }}
            onPointerUp={finish}
            onPointerCancel={finish}
            onLostPointerCapture={finish}
          >
            {[...value.strokes, ...(stroke ? [stroke] : [])].map((item) =>
              item.points.length === 1 ? (
                <circle
                  key={item.id}
                  cx={item.points[0]!.x * 1000}
                  cy={item.points[0]!.y * 540}
                  r={1.5}
                  fill="var(--mis-primary)"
                />
              ) : (
                <polyline
                  key={item.id}
                  points={item.points.map((p) => `${p.x * 1000},${p.y * 540}`).join(' ')}
                />
              ),
            )}
          </svg>
          <div className="live-actions">
            <button
              className="mis-button"
              disabled={disabled || !value.strokes.length || Boolean(stroke)}
              onClick={() => onChange({ ...value, strokes: value.strokes.slice(0, -1) })}
            >
              <ArrowCounterClockwise size={18} aria-hidden="true" />
              {t('Xóa nét cuối', 'Undo last stroke')}
            </button>
            <span className="live-help">
              {value.strokes.length}/{studyLimits.strokes} {t('nét', 'strokes')}
              {points >= 10000 &&
                ` · ${t('Đã đạt giới hạn điểm vẽ; xóa nét để vẽ tiếp.', 'Point limit reached; undo strokes to continue.')}`}
            </span>
          </div>
        </>
      )}
    </section>
  )
}
