'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { BUILTIN_TEMPLATES } from '@docrequest/shared';
import { cn } from '@/lib/utils';

interface Template {
  name: string;
  usedBy: string;
  items: { title: string; help: string; types: string[]; optional?: boolean }[];
}

/** The same built-in templates the app uses, so this section always matches the product. */
const TEMPLATES: Template[] = BUILTIN_TEMPLATES.map((t) => ({
  name: t.name,
  usedBy: t.usedBy ?? '',
  items: t.items.map((i) => ({
    title: i.title,
    help: i.helpText,
    types: i.allowedTypes,
    optional: !i.required,
  })),
}));
const NEW_TENANT: Template = TEMPLATES[0] ?? { name: '', usedBy: '', items: [] };

export function TemplateExplorer() {
  const [active, setActive] = useState(0);
  const t = TEMPLATES[active] ?? NEW_TENANT;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-10">
      <div
        role="tablist"
        aria-label="Checklist templates"
        className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
      >
        {TEMPLATES.map((tpl, i) => {
          const on = i === active;
          return (
            <button
              key={tpl.name}
              role="tab"
              aria-selected={on}
              aria-controls="template-panel"
              onClick={() => setActive(i)}
              className={cn(
                'shrink-0 rounded-xl border px-4 py-3 text-left transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                on ? 'border-brand/40 bg-card shadow-sm' : 'border-transparent hover:bg-card/70',
              )}
            >
              <span
                className={cn(
                  'block text-[15px] font-semibold whitespace-nowrap',
                  on ? 'text-ink' : 'text-ink/75',
                )}
              >
                {tpl.name}
              </span>
              <span className="block text-[13px] whitespace-nowrap text-muted-foreground">
                {tpl.usedBy}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id="template-panel"
        role="tabpanel"
        className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-7"
      >
        <div key={t.name} className="animate-in fade-in duration-300 motion-reduce:animate-none">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-xl font-semibold text-ink">{t.name}</h3>
            <span className="text-sm text-muted-foreground">
              {t.items.length} documents, edit any of them per client
            </span>
          </div>
          <ul className="mt-5 divide-y">
            {t.items.map((item, i) => (
              <li
                key={item.title}
                className="flex gap-3.5 py-3.5 first:pt-0 last:pb-0 animate-in fade-in slide-in-from-bottom-1"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
              >
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 border-input text-transparent">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
                    {item.title}
                    {item.optional && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Optional
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.help}</p>
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {item.types.map((ty) => (
                      <span
                        key={ty}
                        className="rounded border px-1.5 py-px font-mono text-[10.5px] text-muted-foreground"
                      >
                        {ty}
                      </span>
                    ))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
