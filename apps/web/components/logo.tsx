import { cn } from '@/lib/utils';

/** The DocRequest mark: a document with a folded corner and a tick. */
export function LogoMark({
  inverse = false,
  className,
}: {
  inverse?: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-7 shrink-0', className)}>
      <path
        d="M9 3.5h10.5L27 11v16.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-22a2 2 0 0 1 2-2Z"
        fill={inverse ? '#ffffff' : 'var(--ink)'}
      />
      <path d="M19.5 3.5V9a2 2 0 0 0 2 2H27Z" fill={inverse ? '#c9d2e3' : '#41557f'} />
      <path
        d="m11.5 19 3.5 3.5 6.5-7"
        fill="none"
        stroke={inverse ? 'var(--brand)' : 'var(--brand-bright)'}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark inverse={inverse} />
      <span
        className={cn(
          'text-[17px] font-semibold tracking-[-0.02em]',
          inverse ? 'text-white' : 'text-ink',
        )}
      >
        DocRequest
      </span>
    </span>
  );
}
