import { COPYRIGHT_NOTICE, TRADEMARK_NOTICE } from '../../lib/brand';

/**
 * The portfolio's ownership notice: small, and only in the public landing
 * page's footer, the sign-in footer and About this data — never on the analyst
 * working screens.
 */
export default function OwnershipNotice({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-snug text-muted ${className}`} data-testid="ownership-notice">
      {TRADEMARK_NOTICE} {COPYRIGHT_NOTICE}
    </p>
  );
}
