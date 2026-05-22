import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/i18n/config";
import { Languages } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

type Lang = "tr" | "en";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const current = (i18n.language?.toLowerCase().startsWith("en") ? "en" : "tr") as Lang;

  // Position the portal dropdown relative to the button
  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + window.scrollY + 6,
        right: window.innerWidth - r.right,
      });
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [open]);

  const labels: Record<Lang, string> = { tr: "TR", en: "EN" };
  const names: Record<Lang, string> = { tr: "Türkçe", en: "English" };

  const dropdown = open ? createPortal(
    <div
      className="fixed z-[9999] min-w-[130px] rounded-md border border-border bg-surface p-1 shadow-xl"
      style={{ top: pos.top, right: pos.right }}
      onClick={(e) => e.stopPropagation()}
    >
      {(["tr", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => { changeLanguage(l); setOpen(false); }}
          className={`flex w-full items-center justify-between rounded px-3 py-2 text-left font-mono text-[11px] uppercase tracking-widest transition-colors hover:bg-surface-2 ${
            current === l ? "text-atlantix" : "text-muted-foreground"
          }`}
        >
          <span>{names[l]}</span>
          <span className="ml-3">{labels[l]}</span>
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/50 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        aria-label="Language"
      >
        <Languages className="h-3.5 w-3.5" strokeWidth={1.5} />
        {!compact && <span>{labels[current]}</span>}
      </button>
      {dropdown}
    </div>
  );
}
