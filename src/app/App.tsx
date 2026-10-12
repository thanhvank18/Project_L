import { lazy, Suspense } from 'react'
import { EliteLandingPage } from '@/pages/EliteLandingPage'
const CoursesPage = lazy(() => import('@/pages/LiveCoursesPage'))
const StudioDemoPage = lazy(() =>
  import('@/pages/StudioDemoPage').then((module) => ({ default: module.StudioDemoPage })),
)
const LearningPortalPage = lazy(() =>
  import('@/pages/LiveLearningPortalPage').then((module) => ({
    default: module.LiveLearningPortalPage,
  })),
)
const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage })),
)

export function App() {
  const path = window.location.pathname.replace(/\/$/, '')

  const page =
    path === '/login' ? (
      <LoginPage />
    ) : path === '/learn' || path === '/dashboard' ? (
      <LearningPortalPage />
    ) : path === '/courses' ? (
      <CoursesPage />
    ) : path === '/studio-demo' ? (
      <StudioDemoPage />
    ) : (
      <EliteLandingPage />
    )
  return (
    <Suspense
      fallback={
        <main className="route-loading" role="status">
          Đang tải / Loading…
        </main>
      }
    >
      {page}
    </Suspense>
  )
}
