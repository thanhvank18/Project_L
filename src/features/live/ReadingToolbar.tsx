import { useEffect, useState } from 'react'
import { BookOpen, NotePencil, Pause, Play, Timer } from '@phosphor-icons/react'
import type { Locale } from '../../../shared/portal'
import { formatElapsed } from '@/features/live/reading-helpers'
import { createReadingVisitTimer } from '@/features/live/reading-timer'

export function ReadingToolbar({
  locale,
  panel,
  onPanel,
  size,
  onSize,
  comfortable,
  onComfortable,
}: {
  locale: Locale
  panel: 'notes' | 'dictionary' | null
  onPanel: (value: 'notes' | 'dictionary' | null) => void
  size: string
  onSize: (value: string) => void
  comfortable: boolean
  onComfortable: (value: boolean) => void
}) {
  const [seconds, setSeconds] = useState(0)
  const [paused, setPaused] = useState(false)
  const [timer] = useState(createReadingVisitTimer)
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  useEffect(() => {
    const update = () => setSeconds(timer.update(performance.now(), paused, document.hidden))
    timer.update(performance.now(), paused, document.hidden)
    const interval = window.setInterval(update, 1000)
    document.addEventListener('visibilitychange', update)
    return () => {
      timer.update(performance.now(), true, document.hidden)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', update)
    }
  }, [paused, timer])
  return (
    <div className="reading-toolbar">
      <div
        className="reading-clock"
        title={t(
          'Thời gian tham khảo, tự dừng khi ẩn trang và đặt lại khi mở lại bài; không phải thời hạn nộp bài.',
          'Informational time: pauses when the page is hidden and resets when you reopen the task; not the submission deadline.',
        )}
      >
        <Timer size={19} aria-hidden="true" />
        <span>
          <small>
            {paused ? t('Đã tạm dừng', 'Paused') : t('Thời gian phiên này', 'This visit')}
          </small>
          <time>{formatElapsed(seconds)}</time>
        </span>
        <button
          type="button"
          className="mis-button"
          aria-label={
            paused ? t('Tiếp tục đồng hồ', 'Resume timer') : t('Tạm dừng đồng hồ', 'Pause timer')
          }
          onClick={() => {
            const nextPaused = !paused
            setSeconds(timer.update(performance.now(), nextPaused, document.hidden))
            setPaused(nextPaused)
          }}
        >
          {paused ? <Play size={17} /> : <Pause size={17} />}
        </button>
      </div>
      <div className="reading-toolbar-controls">
        <label className="reading-size">
          {t('Cỡ chữ', 'Text size')}
          <select value={size} onChange={(event) => onSize(event.target.value)}>
            <option value="small">S</option>
            <option value="medium">M</option>
            <option value="large">L</option>
          </select>
        </label>
        <label className="reading-comfort">
          <input
            type="checkbox"
            checked={comfortable}
            onChange={(event) => onComfortable(event.target.checked)}
          />
          {t('Nền dịu', 'Soft background')}
        </label>
        <button
          type="button"
          className="mis-button"
          aria-expanded={panel === 'notes'}
          onClick={() => onPanel(panel === 'notes' ? null : 'notes')}
        >
          <NotePencil size={18} aria-hidden="true" />
          {t('Ghi chú', 'Notes')}
        </button>
        <button
          type="button"
          className="mis-button"
          aria-expanded={panel === 'dictionary'}
          onClick={() => onPanel(panel === 'dictionary' ? null : 'dictionary')}
        >
          <BookOpen size={18} aria-hidden="true" />
          {t('Tra từ', 'Dictionary')}
        </button>
      </div>
    </div>
  )
}
