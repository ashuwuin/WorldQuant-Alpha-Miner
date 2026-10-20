import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = {
  value: string | number;
  label: string;
  sub?: string;
};

type CustomSelectProps = {
  value: string | number;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
};

export function CustomSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const active =
    options.find((opt) => String(opt.value) === String(value)) || options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className={`custom-select ${open ? "is-open" : ""} ${className}`.trim()}
    >
      <button
        type="button"
        className="custom-select-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="custom-select-label">{active?.label || value}</span>
        <ChevronDown size={15} className="custom-select-chevron" />
      </button>

      {open && (
        <div className="custom-select-menu" role="listbox">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`custom-select-option ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  onChange(String(opt.value));
                  setOpen(false);
                }}
              >
                <div className="custom-select-option-copy">
                  <strong>{opt.label}</strong>
                  {opt.sub && <small>{opt.sub}</small>}
                </div>
                {isSelected && <Check size={14} className="opt-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
