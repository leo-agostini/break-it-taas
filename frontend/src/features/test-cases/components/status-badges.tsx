import { Badge } from '@/components/ui/badge';
import {
  runStatusStyles,
  testTypeStyles,
} from '@/features/test-cases/lib/status';
import type { TestType } from '@/features/test-cases/types/test-case';
import type { TestRunStatus } from '@/features/test-cases/types/test-run';
import { cn } from '@/lib/utils';

export function RunStatusBadge({ status }: { status: TestRunStatus }) {
  const style = runStatusStyles[status];

  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', style.badge)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
      {style.label}
    </Badge>
  );
}

export function TestTypeBadge({ type }: { type: TestType }) {
  return (
    <Badge
      variant="outline"
      className={cn('font-medium', testTypeStyles[type])}
    >
      {type.replace('_', ' ')}
    </Badge>
  );
}
