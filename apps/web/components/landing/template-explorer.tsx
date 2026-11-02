'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/* The five built-in checklists clients receive (PRD §3, item 4). */

type Item = { title: string; help: string; types: string[]; optional?: boolean };
interface Template {
  name: string;
  usedBy: string;
  items: Item[];
}

const ALL = ['PDF', 'JPEG', 'PNG', 'HEIC'];
const PDF = ['PDF'];

const NEW_TENANT: Template = {
  name: 'New tenant',
  usedBy: 'Letting agents',
  items: [
    {
      title: 'Passport or driving licence',
      help: 'A clear photo of the page with your photo on it.',
      types: ALL,
    },
    {
      title: 'Proof of address',
      help: 'A utility bill or council tax letter from the last 3 months.',
      types: ALL,
    },
    { title: 'Last 3 payslips', help: 'One file per month is fine.', types: PDF },
    {
      title: 'Bank statements',
      help: 'The last 3 months, showing your name and address.',
      types: PDF,
    },
    {
      title: 'Employer reference',
      help: 'A letter on company headed paper, if you have one.',
      types: PDF,
      optional: true,
    },
  ],
};

const TEMPLATES: Template[] = [
  NEW_TENANT,
  {
    name: 'New employee (right to work)',
    usedBy: 'Recruiters and care agencies',
    items: [
      {
        title: 'Passport or biometric residence permit',
        help: 'Every page with writing or a stamp on it.',
        types: ALL,
      },
      {
        title: 'Right to work share code',
        help: 'A screenshot of the result from GOV.UK.',
        types: ALL,
      },
      {
        title: 'National Insurance letter',
        help: 'Any letter from HMRC or DWP showing your number.',
        types: ALL,
      },
      {
        title: 'DBS certificate',
        help: 'Only if you already have one.',
        types: ALL,
        optional: true,
      },
      {
        title: 'Qualifications',
        help: 'Certificates for the role you are joining.',
        types: ALL,
        optional: true,
      },
    ],
  },
  {
    name: 'Self-assessment tax return',
    usedBy: 'Accountants',
    items: [
      { title: 'P60 or P45', help: 'From every employer you had this tax year.', types: ALL },
      { title: 'Bank interest statements', help: 'The annual summary from each bank.', types: PDF },
      {
        title: 'Pension contributions',
        help: 'Statements for any private pension payments.',
        types: PDF,
      },
      {
        title: 'Rental income and costs',
        help: 'Only if you let out a property.',
        types: PDF,
        optional: true,
      },
      {
        title: 'Expense receipts',
        help: 'Photos are fine. Group them into one file if you can.',
        types: ALL,
        optional: true,
      },
    ],
  },
  {
    name: 'Immigration case',
    usedBy: 'Solicitors',
    items: [
      { title: 'Passport, every page', help: 'Including blank pages, in order.', types: PDF },
      { title: 'Current visa or BRP', help: 'Both sides of the card.', types: ALL },
      { title: 'Proof of funds', help: 'Bank statements covering the last 6 months.', types: PDF },
      {
        title: 'English language certificate',
        help: 'Your test result or degree certificate.',
        types: ALL,
      },
      {
        title: 'Proof of relationship',
        help: 'Only for partner or family applications.',
        types: ALL,
        optional: true,
      },
    ],
  },
  {
    name: 'Mortgage application',
    usedBy: 'Brokers and solicitors',
    items: [
      { title: 'Photo ID', help: 'Passport or full driving licence.', types: ALL },
      {
        title: 'Last 3 payslips',
        help: 'Or 2 years of accounts if you are self-employed.',
        types: PDF,
      },
      { title: 'Bank statements', help: 'The last 3 months of your main account.', types: PDF },
      {
        title: 'Proof of deposit',
        help: 'Where the deposit comes from, like savings or a gift letter.',
        types: PDF,
      },
      { title: 'Latest P60', help: 'From your current employer.', types: ALL },
    ],
  },
];

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
