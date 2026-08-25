export function Logo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2.5 29.5 16 16 29.5 2.5 16 16 2.5Z" fill="var(--color-primary)" opacity="0.18" />
      <path d="M16 6.5 25.5 16 16 25.5 6.5 16 16 6.5Z" fill="var(--color-primary)" />
      <path d="M16 11.5 20.5 16 16 20.5 11.5 16 16 11.5Z" fill="var(--color-background)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Logo className="size-7" />
      <span className="text-lg font-semibold tracking-tight">Finova</span>
    </span>
  );
}
