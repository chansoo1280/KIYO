import { useEffect, useRef, useState } from "react";
import { ICON_OPTIONS } from "@/constants/icons";

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

const IconPicker = ({ value, onChange }: IconPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
      >
        <span className="text-2xl">{value}</span>
        <span className="text-xs text-[var(--color-text-muted)]">변경</span>
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="absolute z-50 mt-2 w-full max-w-md rounded-2xl bg-[var(--color-bg)] p-4 shadow-xl border border-[var(--color-border)]"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[var(--color-text-h)]">아이콘 선택</h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-6 gap-2 max-h-60 overflow-y-auto">
            {ICON_OPTIONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => {
                  onChange(icon);
                  setIsOpen(false);
                }}
                className={`aspect-square rounded-xl text-2xl transition ${
                  value === icon
                    ? "bg-[var(--color-accent-bg)] ring-2 ring-[var(--color-accent)]"
                    : "bg-[var(--color-code-bg)] hover:bg-[var(--color-border)]"
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IconPicker;