import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TestTypeBadge } from '@/features/test-cases/components/status-badges';
import {
  formatDateTime,
  formatRelative,
} from '@/features/test-cases/lib/format';
import type { TestCaseSummary } from '@/features/test-cases/types/test-case';
import { useHydrated } from '@/lib/use-hydrated';
import { LayoutList, Plus } from 'lucide-react';
import { Link } from 'react-router';

export function TestCasesList({
  testCases,
  isLoading,
}: {
  testCases: TestCaseSummary[];
  isLoading: boolean;
}) {
  // "3m ago" cannot be computed identically on the server and the client, so
  // render the absolute timestamp until hydration takes over.
  const hydrated = useHydrated();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Test cases</h1>
          <p className="text-sm text-muted-foreground">
            Define load tests and dispatch runs against your target systems.
          </p>
        </div>
        <Button asChild>
          <Link to="/test-cases/new">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New test case
          </Link>
        </Button>
      </header>

      {isLoading && testCases.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : testCases.length === 0 ? (
        <Empty
          icon={<LayoutList className="h-5 w-5" aria-hidden="true" />}
          title="No test cases yet"
          description="Create your first test case to start running load tests."
          action={
            <Button asChild variant="outline">
              <Link to="/test-cases/new">Create a test case</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Target</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Environment
                </TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  Created
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testCases.map((testCase) => (
                <TableRow key={testCase.id}>
                  <TableCell>
                    <Link
                      to={`/test-cases/${testCase.id}`}
                      className="font-medium hover:underline"
                    >
                      {testCase.name}
                    </Link>
                    {testCase.description ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {testCase.description}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <TestTypeBadge type={testCase.testType} />
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">
                    {testCase.targetSystem.baseUrl}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant="secondary">
                      {testCase.targetSystem.environment}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {testCase.runCount}
                  </TableCell>
                  <TableCell className="hidden text-right text-sm text-muted-foreground sm:table-cell">
                    {hydrated
                      ? formatRelative(testCase.createdAt)
                      : formatDateTime(testCase.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
