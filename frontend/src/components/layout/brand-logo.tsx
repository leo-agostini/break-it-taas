import { cn } from '@/lib/utils';
import { Gauge } from 'lucide-react';

export function BrandLogo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Gauge className="h-4 w-4" aria-hidden="true" />
      </span>
      {showWordmark ? (
        <span className="text-sm font-semibold tracking-tight">
          Break<span className="text-primary">-It</span>
        </span>
      ) : null}
    </span>
  );
}
