export function createMutationQueue() {
  let pending: Promise<unknown> = Promise.resolve()
  return function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = pending.then(work, work)
    pending = next.catch(() => undefined)
    return next
  }
}
