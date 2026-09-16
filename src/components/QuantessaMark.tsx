type QuantessaMarkProps = {
  className?: string;
};

export function QuantessaMark({ className = "size-11" }: QuantessaMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
    >
      <rect width="100" height="100" rx="24" fill="#1e1b3a" />
      <circle
        cx="38"
        cy="42"
        r="22"
        fill="none"
        stroke="#fbfbfd"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M 54 58 L 61 65"
        stroke="#fbfbfd"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}