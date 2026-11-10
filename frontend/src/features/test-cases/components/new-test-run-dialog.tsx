import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  ExecutionFields,
  LoadProfileFields,
} from '@/features/test-cases/components/run-configuration-fields';
import { toRunConfigurationFormValues } from '@/features/test-cases/mappers/run-configuration-mapper';
import { newTestRunFormSchema } from '@/features/test-cases/schemas/new-test-run-schema';
import type { RunConfigurationFormValues } from '@/features/test-cases/schemas/run-configuration-schema';
import type { TestCase } from '@/features/test-cases/types/test-case';
import { zodResolver } from '@hookform/resolvers/zod';
import { RotateCcw } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

/**
 * Starts a run at a load and on a container of the user's choosing, starting
 * from the test case default. Whatever is submitted is stored on the run, so
 * runs of the same case at different loads stay comparable.
 */
export function NewTestRunDialog({
  testCase,
  open,
  onOpenChange,
  isSubmitting,
  submitError,
  onSubmit,
}: {
  testCase: TestCase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (values: RunConfigurationFormValues) => Promise<void>;
}) {
  const defaults = useMemo(
    () =>
      toRunConfigurationFormValues(
        testCase.loadProfile,
        testCase.executionPolicy,
      ),
    [testCase.loadProfile, testCase.executionPolicy],
  );

  const schema = useMemo(
    () => newTestRunFormSchema(testCase.testType),
    [testCase.testType],
  );

  const form = useForm<RunConfigurationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: 'onSubmit',
  });
  const { handleSubmit, reset } = form;

  // Every time the dialog opens it starts again from the test case default.
  useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <DialogHeader>
              <DialogTitle>Configure test run</DialogTitle>
              <DialogDescription>
                Starts from this test case's default. Changes apply to this run
                only and are stored with it.
              </DialogDescription>
            </DialogHeader>

            <section className="space-y-4">
              <h3 className="text-sm font-medium">Load</h3>
              <LoadProfileFields testType={testCase.testType} />
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-medium">Runner</h3>
              <ExecutionFields
                timeoutPlaceholder={`${testCase.executionPolicy.timeoutSeconds} (default)`}
                timeoutDescription="Leave blank to keep the default, extended automatically when the load runs longer."
              />
            </section>

            {submitError ? (
              <p className="text-sm text-destructive">{submitError}</p>
            ) : null}

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => reset(defaults)}
              >
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                Reset to default
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Queuing…' : 'Start run'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
