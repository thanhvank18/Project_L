import { useRef, useState } from 'react'
import { ArrowRight, CheckCircle, Circle, VideoCameraSlash } from '@phosphor-icons/react'
import type {
  LearningActions,
  PortalData,
  PortalLocale,
  PortalState,
} from '@/features/learning/types'
import '@/styles/learning-schedule.css'

interface LearningScheduleProps {
  locale: PortalLocale
  data: PortalData
  state: PortalState
  actions: LearningActions
  onAssignment: (id: string) => void
}

type BookingNotice = 'booked' | 'rescheduled' | 'cancelled' | 'failed' | null

const TIME_ZONE = 'Asia/Ho_Chi_Minh'
const WEEK_START = Date.parse('2026-10-12T00:00:00+07:00')
const WEEK_END = Date.parse('2026-10-19T00:00:00+07:00')
const WEEK_DAYS = Array.from({ length: 7 }, (_, index) => WEEK_START + index * 86_400_000)

const copy = {
  vi: {
    classes: 'Lớp học trong tuần',
    noClass: 'Không có lớp học',
    zoom: 'Zoom chưa kết nối',
    consultation: 'Tư vấn 1:1',
    intro: 'Chọn giờ tư vấn phù hợp. Bạn có thể đặt lịch trước khi nộp đủ bài tập bắt buộc.',
    local: 'Lịch thử lưu trên thiết bị này, không gửi email.',
    choose: 'Chọn khung giờ',
    chooseAnother: 'Chọn khung giờ thay thế',
    book: 'Đặt lịch thử',
    confirmChange: 'Xác nhận đổi lịch',
    keepBooking: 'Giữ lịch hiện tại',
    reserved: 'Lịch đã lưu trong bản mẫu',
    reschedule: 'Đổi lịch',
    cancel: 'Hủy lịch',
    cancelQuestion: 'Hủy lịch tư vấn đã lưu trên thiết bị này?',
    confirmCancel: 'Xác nhận hủy lịch',
    keep: 'Giữ lịch',
    noSlots: 'Chưa có khung giờ tư vấn trong tuần mẫu này.',
    noOtherSlots: 'Không còn khung giờ khác trong tuần mẫu này.',
    noOtherWeeks: 'Bản mẫu chỉ có tuần 12–18/10/2026; chưa thể xem hoặc đặt lịch tuần khác.',
    homework: 'Bài tập trước buổi tư vấn',
    homeworkInfo:
      'Điều kiện trong bản mẫu: nộp đủ các bài bắt buộc trước buổi tư vấn. Bạn vẫn có thể đặt lịch trước.',
    submitted: 'Đã nộp trong bản mẫu',
    pending: 'Chưa nộp',
    ready: 'Đã nộp đủ bài trong bản mẫu. Zoom/email chưa kết nối.',
    missing: 'Còn bài bắt buộc chưa nộp. Zoom/email chưa kết nối.',
    noHomework: 'Chưa có bài tập bắt buộc trong dữ liệu mẫu.',
    integrations: 'Zoom/email chưa kết nối.',
    course: 'Lớp học mẫu',
    booked: 'Đã lưu lịch thử trên thiết bị này. Không gửi email.',
    rescheduled: 'Đã đổi lịch thử trên thiết bị này. Không gửi email.',
    cancelled: 'Đã hủy lịch thử trên thiết bị này. Không gửi email.',
    failed: 'Không lưu được thay đổi. Hãy thử lại; lịch trước đó được giữ nguyên.',
  },
  en: {
    classes: 'Classes this week',
    noClass: 'No classes',
    zoom: 'Zoom is not connected',
    consultation: '1:1 consultation',
    intro:
      'Choose a consultation time. You can reserve a slot before submitting all required assignments.',
    local: 'Trial bookings are saved on this device. No email is sent.',
    choose: 'Choose a time',
    chooseAnother: 'Choose a replacement time',
    book: 'Save trial booking',
    confirmChange: 'Confirm new time',
    keepBooking: 'Keep current booking',
    reserved: 'Booking saved in this demo',
    reschedule: 'Reschedule',
    cancel: 'Cancel booking',
    cancelQuestion: 'Cancel the consultation booking saved on this device?',
    confirmCancel: 'Confirm cancellation',
    keep: 'Keep booking',
    noSlots: 'There are no consultation slots in this sample week.',
    noOtherSlots: 'There are no other slots in this sample week.',
    noOtherWeeks:
      'This demo includes only 12–18 October 2026. Other weeks are not available to view or book.',
    homework: 'Before your consultation',
    homeworkInfo:
      'Demo rule: submit all required assignments before your consultation. You can reserve a time first.',
    submitted: 'Submitted in this demo',
    pending: 'Not submitted',
    ready: 'All required work is submitted in this demo. Zoom/email are not connected.',
    missing: 'Some required assignments are not submitted yet. Zoom/email are not connected.',
    noHomework: 'The sample data has no required assignments.',
    integrations: 'Zoom/email are not connected.',
    course: 'Sample class',
    booked: 'Trial booking saved on this device. No email was sent.',
    rescheduled: 'Trial booking rescheduled on this device. No email was sent.',
    cancelled: 'Trial booking cancelled on this device. No email was sent.',
    failed: 'The change could not be saved. Try again; your previous booking has been kept.',
  },
} satisfies Record<PortalLocale, Record<string, string>>

export function LearningSchedule({
  locale,
  data,
  state,
  actions,
  onAssignment,
}: LearningScheduleProps) {
  const text = copy[locale]
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [notice, setNotice] = useState<BookingNotice>(null)
  const bookingHeadingRef = useRef<HTMLHeadingElement>(null)
  const dateLocale = locale === 'vi' ? 'vi-VN' : 'en-GB'
  const dayFormat = new Intl.DateTimeFormat(dateLocale, {
    timeZone: TIME_ZONE,
    weekday: 'short',
  })
  const dateFormat = new Intl.DateTimeFormat(dateLocale, {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
  })
  const longDateFormat = new Intl.DateTimeFormat(dateLocale, {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const timeFormat = new Intl.DateTimeFormat(dateLocale, {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const formatTime = (value: string) => timeFormat.format(new Date(value))
  const booking = data.slots.find((slot) => slot.id === state.bookingSlotId)
  const slots = data.slots
    .filter((slot) => {
      const start = Date.parse(slot.start)
      return start >= WEEK_START && start < WEEK_END && slot.id !== booking?.id
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId)
  const requiredAssignments = data.assignments.filter((assignment) => assignment.required)
  const submittedCount = requiredAssignments.filter((assignment) =>
    state.submittedIds.includes(assignment.id),
  ).length
  const allSubmitted = submittedCount === requiredAssignments.length

  const saveBooking = () => {
    if (!selectedSlot) return
    if (!actions.bookSlot(selectedSlot.id)) {
      setNotice('failed')
      return
    }
    setNotice(booking ? 'rescheduled' : 'booked')
    setSelectedSlotId(null)
    setIsRescheduling(false)
    setIsCancelling(false)
    requestAnimationFrame(() => bookingHeadingRef.current?.focus())
  }

  const cancelBooking = () => {
    if (!actions.cancelBooking()) {
      setNotice('failed')
      return
    }
    setNotice('cancelled')
    setSelectedSlotId(null)
    setIsRescheduling(false)
    setIsCancelling(false)
    requestAnimationFrame(() => bookingHeadingRef.current?.focus())
  }

  return (
    <div className="ls-schedule">
      <div className="ls-layout">
        <section className="ls-agenda" aria-labelledby="ls-classes-heading">
          <h2 id="ls-classes-heading">{text.classes}</h2>
          <ol className="ls-days">
            {WEEK_DAYS.map((day) => {
              const sessions = data.sessions
                .filter((session) => {
                  const start = Date.parse(session.start)
                  return session.type === 'class' && start >= day && start < day + 86_400_000
                })
                .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))

              return (
                <li className="ls-day" key={day}>
                  <time
                    className="ls-day-date"
                    dateTime={new Date(day + 7 * 3_600_000).toISOString().slice(0, 10)}
                  >
                    <span>{dayFormat.format(day)}</span>
                    <strong>{dateFormat.format(day)}</strong>
                  </time>
                  {sessions.length === 0 ? (
                    <p className="ls-no-class">{text.noClass}</p>
                  ) : (
                    <ul className="ls-sessions">
                      {sessions.map((session) => {
                        const course = data.courses.find((item) => item.id === session.courseId)
                        return (
                          <li className="ls-session" key={session.id}>
                            <p className="ls-session-time">
                              <time dateTime={session.start}>{formatTime(session.start)}</time>
                              <span aria-hidden="true">–</span>
                              <time dateTime={session.end}>{formatTime(session.end)}</time>
                            </p>
                            <h3>{session.title[locale]}</h3>
                            <p className="ls-course">{course?.title[locale] ?? text.course}</p>
                            <p className="ls-connection">
                              <VideoCameraSlash size={16} aria-hidden="true" />
                              {text.zoom}
                            </p>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        </section>

        <div className="ls-consultation-column">
          <section className="ls-booking" aria-labelledby="ls-booking-heading">
            <h2 id="ls-booking-heading" ref={bookingHeadingRef} tabIndex={-1}>
              {text.consultation}
            </h2>
            <p className="ls-intro">{text.intro}</p>
            <p className="ls-local-note" id="ls-local-note">
              {text.local}
            </p>

            {booking && (
              <div className="ls-reservation">
                <p className="ls-reservation-label">
                  <CheckCircle size={19} aria-hidden="true" />
                  {text.reserved}
                </p>
                <p className="ls-reservation-date">
                  <time dateTime={booking.start}>
                    {longDateFormat.format(new Date(booking.start))}
                  </time>
                </p>
                <p className="ls-reservation-time">
                  {formatTime(booking.start)}–{formatTime(booking.end)}
                  <span>{booking.host[locale]}</span>
                </p>
                <div className="ls-actions">
                  <button
                    type="button"
                    className="lp-button"
                    aria-expanded={isRescheduling}
                    onClick={() => {
                      setIsRescheduling(!isRescheduling)
                      setIsCancelling(false)
                      setSelectedSlotId(null)
                      setNotice(null)
                    }}
                  >
                    {text.reschedule}
                  </button>
                  <button
                    type="button"
                    className="ls-text-button"
                    aria-expanded={isCancelling}
                    onClick={() => {
                      setIsCancelling(!isCancelling)
                      setIsRescheduling(false)
                      setNotice(null)
                    }}
                  >
                    {text.cancel}
                  </button>
                </div>
                {isCancelling && (
                  <div className="ls-cancel-confirmation">
                    <p>{text.cancelQuestion}</p>
                    <div className="ls-actions">
                      <button type="button" className="lp-button" onClick={cancelBooking}>
                        {text.confirmCancel}
                      </button>
                      <button
                        type="button"
                        className="ls-text-button"
                        onClick={() => setIsCancelling(false)}
                      >
                        {text.keep}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(!booking || isRescheduling) && (
              <div className="ls-picker">
                {slots.length > 0 ? (
                  <form
                    aria-describedby="ls-local-note"
                    onSubmit={(event) => {
                      event.preventDefault()
                      saveBooking()
                    }}
                  >
                    <fieldset className="ls-slots">
                      <legend>{booking ? text.chooseAnother : text.choose}</legend>
                      {slots.map((slot) => (
                        <label className="ls-slot" htmlFor={`ls-slot-${slot.id}`} key={slot.id}>
                          <input
                            id={`ls-slot-${slot.id}`}
                            type="radio"
                            name="consultation-slot"
                            value={slot.id}
                            checked={selectedSlotId === slot.id}
                            required
                            onChange={() => {
                              setSelectedSlotId(slot.id)
                              setNotice(null)
                            }}
                          />
                          <span className="ls-slot-content">
                            {longDateFormat.format(new Date(slot.start))}
                            <strong>
                              {formatTime(slot.start)}–{formatTime(slot.end)}
                            </strong>
                            <span className="ls-slot-host">{slot.host[locale]}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <button
                      type="submit"
                      className="lp-button lp-primary ls-save"
                      disabled={!selectedSlot}
                    >
                      {booking ? text.confirmChange : text.book}
                    </button>
                  </form>
                ) : (
                  <div className="lp-empty ls-empty">
                    <p>{booking ? text.noOtherSlots : text.noSlots}</p>
                    <p>{text.noOtherWeeks}</p>
                  </div>
                )}
                {isRescheduling && (
                  <button
                    type="button"
                    className="ls-text-button ls-keep-booking"
                    onClick={() => {
                      setIsRescheduling(false)
                      setSelectedSlotId(null)
                      setNotice(null)
                    }}
                  >
                    {text.keepBooking}
                  </button>
                )}
              </div>
            )}

            <div className="ls-feedback" role="status" aria-live="polite" aria-atomic="true">
              {notice && (
                <p className={`lp-status${notice === 'failed' ? ' ls-error' : ''}`}>
                  {text[notice]}
                </p>
              )}
            </div>
          </section>

          <section className="ls-homework" aria-labelledby="ls-homework-heading">
            <div className="ls-homework-heading">
              <h2 id="ls-homework-heading">{text.homework}</h2>
              <span className="ls-homework-count">
                {submittedCount}/{requiredAssignments.length}
              </span>
            </div>
            <p className="ls-intro">{text.homeworkInfo}</p>
            {requiredAssignments.length > 0 ? (
              <ul className="ls-assignment-list">
                {requiredAssignments.map((assignment) => {
                  const submitted = state.submittedIds.includes(assignment.id)
                  const StatusIcon = submitted ? CheckCircle : Circle
                  return (
                    <li key={assignment.id}>
                      <button
                        className="ls-assignment"
                        type="button"
                        onClick={() => onAssignment(assignment.id)}
                      >
                        <StatusIcon
                          className={submitted ? 'ls-submitted' : ''}
                          size={20}
                          aria-hidden="true"
                        />
                        <span>
                          <strong>{assignment.title[locale]}</strong>
                          <small>{submitted ? text.submitted : text.pending}</small>
                        </span>
                        <ArrowRight size={17} aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="ls-empty-homework">{text.noHomework}</p>
            )}
            <p className="ls-access-status">
              {requiredAssignments.length === 0
                ? text.integrations
                : allSubmitted
                  ? text.ready
                  : text.missing}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
