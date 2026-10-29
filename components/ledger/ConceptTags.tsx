/** A lesson's concepts as small ruled tags. Words only, no colour coding. */
export function ConceptTags({ concepts, className = "" }: { concepts: readonly string[]; className?: string }) {
  if (concepts.length === 0) return null;
  return (
    <div className={className}>
      <p className="sr-only">Concepts in this lesson:</p>
      <ul className="flex flex-wrap gap-2" aria-label="Concepts">
        {concepts.map((c) => (
          <li key={c} className="rounded-btn border border-ink bg-sheet px-2.5 py-1 text-sm leading-snug text-ink">
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
