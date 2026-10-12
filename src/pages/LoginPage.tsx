import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeSlash } from '@phosphor-icons/react'
import { PortalApiError, signIn } from '@/features/auth/client'
import type { PortalApiErrorCode } from '@/features/auth/client'
import { languageStorageKey } from '@/i18n/messages'
import type { Language } from '@/i18n/messages'
import '@/styles/login.css'

const errors: Record<PortalApiErrorCode, { vi: string; en: string }> = {
  credentials: {
    vi: 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra rồi thử lại.',
    en: 'The email or password is incorrect. Check your details and try again.',
  },
  expired: {
    vi: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    en: 'Your session has expired. Please sign in again.',
  },
  forbidden: {
    vi: 'Tài khoản chưa được cấp quyền truy cập cổng học tập.',
    en: 'This account does not have access to the learning portal.',
  },
  network: {
    vi: 'Chưa kết nối được dịch vụ đăng nhập. Kiểm tra dịch vụ cục bộ đang chạy rồi thử lại.',
    en: 'The sign-in service could not be reached. Check that the local service is running and try again.',
  },
  service: {
    vi: 'Dịch vụ đăng nhập tạm thời không phản hồi. Vui lòng thử lại.',
    en: 'The sign-in service is temporarily unavailable. Please try again.',
  },
  'login-busy': {
    vi: 'Đang có nhiều yêu cầu đăng nhập. Vui lòng đợi vài giây rồi thử lại.',
    en: 'Sign-in is busy. Please wait a few seconds and try again.',
  },
  'rate-limited': {
    vi: 'Có quá nhiều lần đăng nhập chưa thành công. Vui lòng đợi 15 phút rồi thử lại.',
    en: 'Too many unsuccessful sign-in attempts. Please wait 15 minutes and try again.',
  },
  'invalid-response': {
    vi: 'Không xác minh được thông tin tài khoản từ dịch vụ. Vui lòng thử lại.',
    en: 'Your account details could not be verified with the service. Please try again.',
  },
  unsupported: {
    vi: 'Vai trò của tài khoản này chưa được hỗ trợ. Hãy liên hệ quản trị viên để kiểm tra tài khoản.',
    en: 'This account role is not supported. Contact your administrator to check the account.',
  },
  storage: {
    vi: 'Trình duyệt không cho lưu phiên đăng nhập. Cho phép lưu trữ của trang rồi thử lại.',
    en: 'Your browser blocked session storage. Allow storage for this site and try again.',
  },
}

export function LoginPage() {
  const [locale, setLocale] = useState<Language>(() => {
    try {
      return localStorage.getItem(languageStorageKey) === 'en' ? 'en' : 'vi'
    } catch {
      return 'vi'
    }
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<PortalApiErrorCode | null>(null)
  const pending = useRef<AbortController | null>(null)
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = locale === 'vi' ? 'Đăng nhập · Elite Pathway' : 'Sign in · Elite Pathway'
    try {
      localStorage.setItem(languageStorageKey, locale)
    } catch {
      /* Language still works for this page. */
    }
  }, [locale])
  useEffect(() => () => pending.current?.abort(), [])

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password, controller.signal)
      const next = new URLSearchParams(window.location.search).get('next')
      window.location.replace(
        next === 'courses'
          ? '/learn#courses/open'
          : next === 'review'
            ? '/learn#schedule/consultations'
            : next === 'practice'
              ? '/learn#notebook/practice'
              : '/learn#overview',
      )
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof PortalApiError ? failure.code : 'network')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <div className="portal-login">
      <header className="login-topbar">
        <a href={locale === 'vi' ? '/vi' : '/en'} className="login-back">
          <ArrowLeft aria-hidden="true" size={17} />
          {t('Trang chủ', 'Home')}
        </a>
        <button
          type="button"
          className="login-language"
          onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
          aria-label={t('Switch to English', 'Chuyển sang tiếng Việt')}
        >
          {locale === 'vi' ? 'English' : 'Tiếng Việt'}
        </button>
      </header>
      <main className="login-layout">
        <section className="login-form-panel" aria-labelledby="login-title">
          <a
            className="login-brand"
            href={locale === 'vi' ? '/vi' : '/en'}
            aria-label="Elite Pathway"
          >
            <img src="/elite-reference/logo.svg" width="88" height="88" alt="Elite Pathway" />
          </a>
          <h1 id="login-title">{t('Đăng nhập cổng học tập', 'Sign in to your learning portal')}</h1>
          <p className="login-intro">
            {t(
              'Tiếp tục việc học và quản lý lớp của bạn.',
              'Continue learning and managing your classes.',
            )}
          </p>
          <form onSubmit={handleSubmit} aria-busy={busy}>
            <div className="login-field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={320}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setError(null)
                }}
                disabled={busy}
                aria-invalid={error === 'credentials' || undefined}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
            <div className="login-field">
              <label htmlFor="login-password">{t('Mật khẩu', 'Password')}</label>
              <div className="login-password">
                <input
                  id="login-password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  minLength={6}
                  maxLength={256}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError(null)
                  }}
                  disabled={busy}
                  aria-invalid={error === 'credentials' || undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={
                    visible
                      ? t('Ẩn mật khẩu', 'Hide password')
                      : t('Hiện mật khẩu', 'Show password')
                  }
                  aria-pressed={visible}
                >
                  {visible ? (
                    <EyeSlash size={20} aria-hidden="true" />
                  ) : (
                    <Eye size={20} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <p id="login-error" className="login-error" role="alert">
                {errors[error][locale]}
              </p>
            )}
            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? t('Đang xác minh…', 'Verifying…') : t('Đăng nhập', 'Sign in')}
              <ArrowRight size={19} aria-hidden="true" />
            </button>
            <p className="login-help">
              {t(
                'Dùng tài khoản đã được cấp. Vai trò được xác định từ tài khoản sau khi đăng nhập.',
                'Use your assigned account. Your account determines your role after sign-in.',
              )}
            </p>
          </form>
          <p className="login-local-note">
            {t(
              'Chưa có tài khoản hoặc cần khôi phục truy cập? Liên hệ quản trị viên của trung tâm.',
              'Need an account or help restoring access? Contact your centre administrator.',
            )}
          </p>
        </section>
      </main>
    </div>
  )
}
