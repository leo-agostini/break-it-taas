import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  FormRow,
  SelectField,
  toOptions,
} from '@/features/test-cases/components/form-controls';
import {
  HTTP_METHODS,
  type NewTestCaseFormValues,
} from '@/features/test-cases/schemas/new-test-case-schema';
import { Plus, Trash2 } from 'lucide-react';
import {
  type Control,
  Controller,
  type UseFormRegister,
  useFieldArray,
  useWatch,
} from 'react-hook-form';

const CHECK_KINDS = [
  'STATUS_CODE',
  'RESPONSE_TIME_LT',
  'BODY_CONTAINS',
  'JSON_PATH_EQUALS',
] as const;

type FormControl = Control<NewTestCaseFormValues>;
type FormRegister = UseFormRegister<NewTestCaseFormValues>;

function ChecksEditor({
  control,
  register,
  stepIndex,
}: {
  control: FormControl;
  register: FormRegister;
  stepIndex: number;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `steps.${stepIndex}.checks`,
  });

  const checks = useWatch({ control, name: `steps.${stepIndex}.checks` });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Checks</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ kind: 'STATUS_CODE', expected: '200' })}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Add check
        </Button>
      </div>

      {fields.map((field, checkIndex) => {
        const kind = checks?.[checkIndex]?.kind ?? 'STATUS_CODE';

        return (
          <div
            key={field.id}
            className="flex flex-wrap items-start gap-2 rounded-md border bg-muted/20 p-3"
          >
            <SelectField
              control={control}
              name={`steps.${stepIndex}.checks.${checkIndex}.kind`}
              ariaLabel={`Check ${checkIndex + 1} kind`}
              options={toOptions(CHECK_KINDS)}
              className="w-48"
            />

            {kind === 'STATUS_CODE' ? (
              <Controller
                control={control}
                name={`steps.${stepIndex}.checks.${checkIndex}.expected`}
                render={({ fieldState }) => (
                  <FormRow error={fieldState.error?.message} className="w-32">
                    <Input
                      placeholder="200"
                      {...register(
                        `steps.${stepIndex}.checks.${checkIndex}.expected`,
                      )}
                    />
                  </FormRow>
                )}
              />
            ) : null}

            {kind === 'RESPONSE_TIME_LT' ? (
              <Controller
                control={control}
                name={`steps.${stepIndex}.checks.${checkIndex}.maxMs`}
                render={({ fieldState }) => (
                  <FormRow error={fieldState.error?.message} className="w-32">
                    <Input
                      placeholder="500"
                      {...register(
                        `steps.${stepIndex}.checks.${checkIndex}.maxMs`,
                      )}
                    />
                  </FormRow>
                )}
              />
            ) : null}

            {kind === 'BODY_CONTAINS' ? (
              <Controller
                control={control}
                name={`steps.${stepIndex}.checks.${checkIndex}.value`}
                render={({ fieldState }) => (
                  <FormRow
                    error={fieldState.error?.message}
                    className="min-w-[12rem] flex-1"
                  >
                    <Input
                      placeholder="expected substring"
                      {...register(
                        `steps.${stepIndex}.checks.${checkIndex}.value`,
                      )}
                    />
                  </FormRow>
                )}
              />
            ) : null}

            {kind === 'JSON_PATH_EQUALS' ? (
              <>
                <Controller
                  control={control}
                  name={`steps.${stepIndex}.checks.${checkIndex}.path`}
                  render={({ fieldState }) => (
                    <FormRow
                      error={fieldState.error?.message}
                      className="min-w-[10rem] flex-1"
                    >
                      <Input
                        placeholder="$.status"
                        className="font-mono text-xs"
                        {...register(
                          `steps.${stepIndex}.checks.${checkIndex}.path`,
                        )}
                      />
                    </FormRow>
                  )}
                />
                <Controller
                  control={control}
                  name={`steps.${stepIndex}.checks.${checkIndex}.expected`}
                  render={({ fieldState }) => (
                    <FormRow
                      error={fieldState.error?.message}
                      className="min-w-[8rem] flex-1"
                    >
                      <Input
                        placeholder="ok"
                        {...register(
                          `steps.${stepIndex}.checks.${checkIndex}.expected`,
                        )}
                      />
                    </FormRow>
                  )}
                />
              </>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto"
              disabled={fields.length === 1}
              onClick={() => remove(checkIndex)}
              aria-label="Remove check"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export function StepsEditor({
  control,
  register,
  error,
}: {
  control: FormControl;
  register: FormRegister;
  error?: string;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'steps' });
  const steps = useWatch({ control, name: 'steps' });

  return (
    <div className="space-y-4">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {fields.map((field, stepIndex) => {
        const method = steps?.[stepIndex]?.method ?? 'GET';
        const supportsBody = method === 'POST' || method === 'PUT';

        return (
          <div key={field.id} className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-start gap-3">
              <SelectField
                control={control}
                name={`steps.${stepIndex}.method`}
                ariaLabel={`Step ${stepIndex + 1} HTTP method`}
                options={toOptions(HTTP_METHODS)}
                className="w-32"
              />
              <Controller
                control={control}
                name={`steps.${stepIndex}.path`}
                render={({ fieldState }) => (
                  <FormRow
                    error={fieldState.error?.message}
                    className="min-w-[12rem] flex-1"
                  >
                    <Input
                      placeholder="/health"
                      className="font-mono text-sm"
                      {...register(`steps.${stepIndex}.path`)}
                    />
                  </FormRow>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={fields.length === 1}
                onClick={() => remove(stepIndex)}
                aria-label="Remove step"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {supportsBody ? (
              <Controller
                control={control}
                name={`steps.${stepIndex}.bodyJson`}
                render={({ fieldState }) => (
                  <FormRow
                    label="Request body (JSON)"
                    error={fieldState.error?.message}
                  >
                    <Textarea
                      rows={4}
                      placeholder='{ "key": "value" }'
                      className="font-mono text-xs"
                      {...register(`steps.${stepIndex}.bodyJson`)}
                    />
                  </FormRow>
                )}
              />
            ) : null}

            <Separator />

            <ChecksEditor
              control={control}
              register={register}
              stepIndex={stepIndex}
            />
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({
            path: '/',
            method: 'GET',
            bodyJson: '',
            checks: [{ kind: 'STATUS_CODE', expected: '200' }],
          })
        }
      >
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Add step
      </Button>
    </div>
  );
}
