import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative w-fit">
      <select
        data-slot="native-select"
        className={cn(
          'border-input h-10 w-full min-w-0 appearance-none rounded-md border bg-card text-foreground py-1 pr-8 pl-3 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50',
          'focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[3px]',
          className,
        )}
        {...props}
      />
      <ChevronDownIcon
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
    </div>
  );
}

export { NativeSelect };
