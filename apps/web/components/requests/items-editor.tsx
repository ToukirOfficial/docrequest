'use client';

import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from 'lucide-react';
import { FILE_TYPES, type FileType, type ItemStatus } from '@docrequest/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface EditorItem {
  /** Local key for React; requests also keep the server id. */
  key: string;
  id?: string;
  title: string;
  helpText: string;
  required: boolean;
  allowedTypes: FileType[];
  /** Items the client has already uploaded to can't be removed. */
  status?: ItemStatus;
}

let seq = 0;
export const newItem = (partial: Partial<EditorItem> = {}): EditorItem => ({
  key: `new-${++seq}`,
  title: '',
  helpText: '',
  required: true,
  allowedTypes: [...FILE_TYPES],
  ...partial,
});

const typeLabel: Record<FileType, string> = { PDF: 'PDF', JPEG: 'JPEG', PNG: 'PNG', HEIC: 'HEIC' };

/** Edits a checklist: name, help text, required, accepted file types, order. */
export function ItemsEditor({
  items,
  onChange,
  disabled,
}: {
  items: EditorItem[];
  onChange: (items: EditorItem[]) => void;
  disabled?: boolean;
}) {
  const set = (i: number, patch: Partial<EditorItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...items];
    const [it] = next.splice(i, 1);
    if (it) next.splice(i + dir, 0, it);
    onChange(next);
  };

  return (
    <div className="grid gap-3">
      <ol className="grid gap-3">
        {items.map((it, i) => {
          const locked = !!it.status && it.status !== 'PENDING';
          return (
            <li key={it.key} className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <div className="grid min-w-0 flex-1 gap-2.5">
                  <Input
                    aria-label={`Document ${i + 1} name`}
                    placeholder="Document name, for example Passport"
                    value={it.title}
                    maxLength={120}
                    disabled={disabled}
                    onChange={(e) => set(i, { title: e.target.value })}
                  />
                  <Input
                    aria-label={`Document ${i + 1} help text`}
                    placeholder="Help for the client (optional), for example The page with your photo"
                    value={it.helpText}
                    maxLength={300}
                    disabled={disabled}
                    onChange={(e) => set(i, { helpText: e.target.value })}
                  />
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--brand)]"
                        checked={it.required}
                        disabled={disabled}
                        onChange={(e) => set(i, { required: e.target.checked })}
                      />
                      Required
                    </label>
                    <fieldset className="flex flex-wrap items-center gap-1.5" disabled={disabled}>
                      <legend className="sr-only">Accepted file types for document {i + 1}</legend>
                      {FILE_TYPES.map((t) => {
                        const on = it.allowedTypes.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={on}
                            onClick={() => {
                              const next = on
                                ? it.allowedTypes.filter((x) => x !== t)
                                : [...it.allowedTypes, t];
                              if (next.length > 0)
                                set(i, {
                                  allowedTypes: FILE_TYPES.filter((f) => next.includes(f)),
                                });
                            }}
                            className={cn(
                              'rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                              on
                                ? 'border-brand/40 bg-brand-soft text-brand-strong'
                                : 'text-muted-foreground hover:bg-accent',
                            )}
                          >
                            {typeLabel[t]}
                          </button>
                        );
                      })}
                    </fieldset>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Move up"
                    disabled={disabled || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Move down"
                    disabled={disabled || i === items.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={
                      locked ? 'Already uploaded, can’t be removed' : `Remove document ${i + 1}`
                    }
                    title={
                      locked ? 'The client has uploaded this, so it can’t be removed' : undefined
                    }
                    disabled={disabled || locked || items.length === 1}
                    onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                  >
                    {locked ? <Lock /> : <Trash2 />}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={disabled || items.length >= 30}
        onClick={() => onChange([...items, newItem()])}
      >
        <Plus /> Add a document
      </Button>
    </div>
  );
}

/** Strips local-only fields before sending to the API. */
export function toItemInput(it: EditorItem) {
  return {
    ...(it.id ? { id: it.id } : {}),
    title: it.title,
    helpText: it.helpText,
    required: it.required,
    allowedTypes: it.allowedTypes,
  };
}
