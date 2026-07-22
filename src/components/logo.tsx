export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      role="img"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="white" strokeWidth="2" />
      <circle cx="16" cy="11.6" r="1.7" fill="white" />
      <rect x="10.4" y="15.1" width="11.2" height="1.8" rx="0.9" fill="white" />
      <circle cx="16" cy="20.4" r="1.7" fill="white" />
    </svg>
  )
}
