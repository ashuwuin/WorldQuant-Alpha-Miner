type AlphaLogoProps = {
  size?: number;
  className?: string;
  variant?: "badge" | "mark";
};

export function AlphaLogo({
  size = 42,
  className = "",
  variant = "badge",
}: AlphaLogoProps) {
  const color = variant === "badge" ? "#F2EFE9" : "currentColor";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1000 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`alpha-star-logo ${className}`.trim()}
      role="img"
      aria-label="WorldQuant Alpha emblem"
    >
      {variant === "badge" && (
        <>
          <rect width="1000" height="1000" rx="220" fill="#0A1410" />
          <rect
            x="20"
            y="20"
            width="960"
            height="960"
            rx="200"
            stroke="#C5A875"
            strokeOpacity=".32"
            strokeWidth="12"
          />
        </>
      )}
      <path
        d="M 110 880 L 378 122 L 486 435 Q 498 492 348 566 Q 492 528 516 558 L 652 880 Z"
        fill={color}
      />
      <path
        d="M 390 114 L 636 114 L 908 880 L 664 880 L 568 535 Q 554 484 710 444 Q 560 470 535 418 Z"
        fill={color}
      />
    </svg>
  );
}
