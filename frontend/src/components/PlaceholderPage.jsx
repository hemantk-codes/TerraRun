/**
 * Shared shell for pages that don't have real functionality yet. Each real
 * page file (see src/pages/) renders this with its own title/phase/note —
 * swap the contents out phase by phase without touching routing.
 */
export default function PlaceholderPage({ title, phase, note, children }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="rounded-full border border-ground-700 bg-ground-900 px-3 py-1 font-display text-xs uppercase tracking-widest text-territory-400">
        {phase}
      </span>
      <h1 className="font-display text-3xl font-semibold text-ground-100 sm:text-4xl">
        {title}
      </h1>
      {note && <p className="max-w-md text-sm leading-relaxed text-ground-300">{note}</p>}
      {children}
    </div>
  )
}
