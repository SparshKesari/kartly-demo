export function HeartIcon({ filled, size = 20 }: { filled: boolean; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#e11d48" : "none"} stroke={filled ? "#e11d48" : "currentColor"} strokeWidth="2">
      <path d="M12 21s-7.5-4.6-9.5-9.2C1.1 8.6 3.2 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5c3.4 0 5.5 3.6 4.1 6.8C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}
