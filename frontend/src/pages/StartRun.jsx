import { useState } from 'react'
import { useRunTracker } from '../hooks/useRunTracker.js'
import RunMap from '../components/RunMap.jsx'
import RunSummary from '../components/RunSummary.jsx'
import { postActivity } from '../lib/api.js'

export default function StartRun() {
  const { status, path, error, start, pause, resume, stop, reset } = useRunTracker()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [activity, setActivity] = useState(null)

  const handleStop = async () => {
    stop()
    if (path.length < 2) {
      setSubmitError('Not enough GPS points recorded to save this activity.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const saved = await postActivity(path, {
        startTime: path[0].t,
        endTime: path[path.length - 1].t,
      })
      setActivity(saved)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismissSummary = () => {
    setActivity(null)
    reset()
  }

  if (activity) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <RunSummary activity={activity} onDismiss={handleDismissSummary} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-ground-100">Start a run</h1>

      <RunMap path={path} />

      <div className="flex items-center justify-between text-sm text-ground-300">
        <span>{path.length} GPS points recorded</span>
        <span className="capitalize">{status}</span>
      </div>

      {error && (
        <p className="rounded-md border border-invasion-500/40 bg-invasion-500/10 px-3 py-2 text-sm text-invasion-500">
          {error}
        </p>
      )}
      {submitError && (
        <p className="rounded-md border border-invasion-500/40 bg-invasion-500/10 px-3 py-2 text-sm text-invasion-500">
          {submitError}
        </p>
      )}

      <div className="flex gap-3">
        {(status === 'idle' || status === 'stopped') && (
          <button
            onClick={start}
            className="rounded-md bg-territory-500 px-4 py-2 text-sm font-semibold text-ground-950 transition-opacity hover:opacity-90"
          >
            Start
          </button>
        )}
        {status === 'tracking' && (
          <button
            onClick={pause}
            className="rounded-md border border-ground-700 px-4 py-2 text-sm font-semibold text-ground-100 hover:bg-ground-900"
          >
            Pause
          </button>
        )}
        {status === 'paused' && (
          <button
            onClick={resume}
            className="rounded-md bg-territory-500 px-4 py-2 text-sm font-semibold text-ground-950 transition-opacity hover:opacity-90"
          >
            Resume
          </button>
        )}
        {(status === 'tracking' || status === 'paused') && (
          <button
            onClick={handleStop}
            disabled={submitting}
            className="rounded-md bg-invasion-500 px-4 py-2 text-sm font-semibold text-ground-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Stop & Save'}
          </button>
        )}
      </div>
    </div>
  )
}
