import type { ReactNode } from 'react';

/**
 * A compact, collapsed-by-default card that expands in place: an icon, a
 * title, a one-line summary of what is inside, and a chevron. Built on the
 * native <details>/<summary> pair, so it opens with a click, Enter or Space,
 * and its expanded state is announced without any extra ARIA. The summary is
 * read with the title (it is part of the accessible name), so it must say
 * something true about the content, never something invented.
 */
export default function ExpandableCard({
  icon,
  title,
  summary,
  testId,
  children,
}: {
  icon: ReactNode;
  title: string;
  summary: ReactNode;
  testId: string;
  children: ReactNode;
}) {
  return (
    <details
      className="group min-w-0 rounded-lg border border-hairline bg-white transition-colors open:border-brand/30 open:shadow-card"
      data-testid={testId}
    >
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 hover:bg-canvas group-open:rounded-b-none group-open:border-b group-open:border-hairline [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-light text-brand"
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="block truncate text-xs text-muted" data-testid={`${testId}-summary`}>
            {summary}
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="px-3 pb-3 pt-3">{children}</div>
    </details>
  );
}
