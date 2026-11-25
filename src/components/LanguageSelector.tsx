import type { Language } from '../types.ts';

interface LanguageSelectorProps {
  language: Language;
  onChange: (lang: Language) => void;
  compact?: boolean;
}

const OPTIONS: Array<{ code: Language; label: string }> = [
  { code: 'mr', label: 'मराठी' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'en', label: 'English' },
];

export function LanguageSelector({ language, onChange, compact = false }: LanguageSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Select language"
      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-100/80 p-1"
    >
      {OPTIONS.map((opt) => {
        const active = language === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => onChange(opt.code)}
            className={`min-h-[36px] whitespace-nowrap shrink-0 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
              compact ? 'px-2.5' : 'px-3.5'
            } ${
              active
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-stone-700 hover:bg-white/80 hover:text-stone-950'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
