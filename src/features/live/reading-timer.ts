/** A visit-only stopwatch. Call with a monotonic millisecond timestamp (performance.now). */
export function createReadingVisitTimer() {
  let elapsedMilliseconds = 0
  let checkpoint: number | null = null
  return {
    update(timestamp: number, manuallyPaused: boolean, hidden: boolean): number {
      if (checkpoint !== null) elapsedMilliseconds += Math.max(0, timestamp - checkpoint)
      checkpoint = manuallyPaused || hidden ? null : timestamp
      return Math.floor(elapsedMilliseconds / 1000)
    },
  }
}
