/**
 * Shared shell for pages that don't have real functionality yet. Each real
 * page file (see src/pages/) renders this with its own title/phase/note —
 * swap the contents out phase by phase without touching routing.
 */
export default function PlaceholderPage({ title, phase, note, children }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center gap-5 px-6 text-center">
      {phase && <span className="ribbon-title">{phase}</span>}
      <h1 className="title-plaque">{title}</h1>
      {note && <p className="max-w-md text-sm leading-relaxed text-ground-300">{note}</p>}
      {children}
    </div>
  )
}
