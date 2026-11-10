import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  FormRow,
  SelectField,
  toOptions,
} from '@/features/test-cases/components/form-controls';
import {
  LOAD_MODES,
  loadModeLabels,
} from '@/features/test-cases/lib/load-profile';
import {
  loadModesByTestType,
  supportsVuLoad,
} from '@/features/test-cases/lib/status';
import {
  RESOURCE_PROFILES,
  type RunConfigurationFormValues,
  TIME_UNITS,
} from '@/features/test-cases/schemas/run-configuration-schema';
import type { TestType } from '@/features/test-cases/types/test-case';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form';

/*
| Load and runner-container fields, shared by the test case form (its default
| configuration) and the new run dialog (a per-run override). Both forms wrap
| these in a FormProvider; the fields read it as RunConfigurationFormValues.
*/

function ToggleField({
  name,
  label,
  error,
  options,
}: {
  name: 'loadSource' | 'loadMode' | 'preset.driver';
  label: string;
  error?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}) {
  const { control } = useFormContext<RunConfigurationFormValues>();

  return (
    <FormRow label={label} error={error}>
      {({ labelId }) => (
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <ToggleGroup
              type="single"
              variant="outline"
              aria-labelledby={labelId}
              value={field.value}
              onValueChange={(value) => value && field.onChange(value)}
              className="flex-wrap justify-start"
            >
              {options.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
      )}
    </FormRow>
  );
}

function StagesField({
  name,
  targetLabel,
}: {
  name: 'ramp.stages' | 'rampingVus.stages';
  targetLabel: string;
}) {
  const { control, register, formState } =
    useFormContext<RunConfigurationFormValues>();
  const stages = useFieldArray({ control, name });
  const group = name === 'ramp.stages' ? 'ramp' : 'rampingVus';
  const errors = formState.errors[group]?.stages;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Stages</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => stages.append({ target: '100', duration: '30' })}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Add stage
        </Button>
      </div>
      {errors?.message ? (
        <p className="text-xs text-destructive">{errors.message}</p>
      ) : null}

      {stages.fields.map((stage, index) => (
        <div key={stage.id} className="flex items-start gap-2">
          <FormRow error={errors?.[index]?.target?.message} className="flex-1">
            <Input
              placeholder={targetLabel}
              aria-label={`Stage ${index + 1} ${targetLabel}`}
              {...register(`${group}.stages.${index}.target`)}
            />
          </FormRow>
          <FormRow
            error={errors?.[index]?.duration?.message}
            className="flex-1"
          >
            <Input
              placeholder="duration"
              aria-label={`Stage ${index + 1} duration`}
              {...register(`${group}.stages.${index}.duration`)}
            />
          </FormRow>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={stages.fields.length === 1}
            onClick={() => stages.remove(index)}
            aria-label={`Remove stage ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
    </div>
  );
}

/** The VU pool an arrival-rate run draws from; blank lets the runner size it. */
function VuPoolFields({ group }: { group: 'constant' | 'ramp' }) {
  const { register, formState } = useFormContext<RunConfigurationFormValues>();
  const errors = formState.errors[group]?.vus;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormRow
        label="Pre-allocated VUs"
        description="Optional. Leave both blank to let the runner size the pool."
        error={errors?.preAllocated?.message}
      >
        <Input placeholder="auto" {...register(`${group}.vus.preAllocated`)} />
      </FormRow>
      <FormRow label="Max VUs" error={errors?.max?.message}>
        <Input placeholder="auto" {...register(`${group}.vus.max`)} />
      </FormRow>
    </div>
  );
}

export function LoadProfileFields({ testType }: { testType: TestType }) {
  const { control, register, setValue, formState } =
    useFormContext<RunConfigurationFormValues>();
  const errors = formState.errors;

  const loadSource = useWatch({ control, name: 'loadSource' });
  const loadMode = useWatch({ control, name: 'loadMode' });
  const presetDriver = useWatch({ control, name: 'preset.driver' });

  const allowedModes = loadModesByTestType[testType];
  const allowsVus = supportsVuLoad(testType);

  // Keep the load legal whenever the test type changes — the backend rejects
  // incompatible pairings outright.
  useEffect(() => {
    if (!allowedModes.includes(loadMode)) {
      setValue('loadMode', allowedModes[0]);
    }
    if (!allowsVus && presetDriver === 'VUS') {
      setValue('preset.driver', 'RATE');
    }
  }, [allowedModes, allowsVus, loadMode, presetDriver, setValue]);

  return (
    <>
      <ToggleField
        name="loadSource"
        label="Shape"
        error={errors.loadSource?.message}
        options={[
          { value: 'PRESET', label: 'Guided by test type' },
          { value: 'MANUAL', label: 'Manual profile' },
        ]}
      />

      {loadSource === 'PRESET' ? (
        <>
          <ToggleField
            name="preset.driver"
            label="Drive load by"
            error={errors.preset?.driver?.message}
            options={[
              { value: 'RATE', label: 'Request rate' },
              { value: 'VUS', label: 'Virtual users', disabled: !allowsVus },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <FormRow
              label={presetDriver === 'VUS' ? 'Peak VUs' : 'Peak rate'}
              description={
                presetDriver === 'VUS' ? undefined : 'Requests per time unit'
              }
              error={errors.preset?.peak?.message}
            >
              <Input placeholder="100" {...register('preset.peak')} />
            </FormRow>
            <FormRow
              label="Total duration"
              error={errors.preset?.duration?.message}
            >
              <Input placeholder="30" {...register('preset.duration')} />
            </FormRow>
            <SelectField
              control={control}
              name="preset.timeUnit"
              label="Time unit"
              options={toOptions(TIME_UNITS)}
            />
          </div>
        </>
      ) : null}

      {loadSource === 'MANUAL' ? (
        <>
          <ToggleField
            name="loadMode"
            label="Mode"
            error={errors.loadMode?.message}
            options={LOAD_MODES.map((mode) => ({
              value: mode,
              label: loadModeLabels[mode],
              disabled: !allowedModes.includes(mode),
            }))}
          />

          {loadMode === 'CONSTANT' ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormRow
                  label="Target rate"
                  description="Requests per time unit"
                  error={errors.constant?.targetRate?.message}
                >
                  <Input
                    placeholder="100"
                    {...register('constant.targetRate')}
                  />
                </FormRow>
                <FormRow
                  label="Duration"
                  error={errors.constant?.duration?.message}
                >
                  <Input placeholder="60" {...register('constant.duration')} />
                </FormRow>
                <SelectField
                  control={control}
                  name="constant.timeUnit"
                  label="Time unit"
                  options={toOptions(TIME_UNITS)}
                />
              </div>
              <VuPoolFields group="constant" />
            </div>
          ) : null}

          {loadMode === 'RAMP' ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow
                  label="Initial rate"
                  error={errors.ramp?.initialRate?.message}
                >
                  <Input placeholder="0" {...register('ramp.initialRate')} />
                </FormRow>
                <SelectField
                  control={control}
                  name="ramp.timeUnit"
                  label="Time unit"
                  options={toOptions(TIME_UNITS)}
                />
              </div>
              <StagesField name="ramp.stages" targetLabel="target rate" />
              <VuPoolFields group="ramp" />
            </div>
          ) : null}

          {loadMode === 'CONSTANT_VUS' ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <FormRow
                label="Virtual users"
                error={errors.constantVus?.vus?.message}
              >
                <Input placeholder="10" {...register('constantVus.vus')} />
              </FormRow>
              <FormRow
                label="Duration"
                error={errors.constantVus?.duration?.message}
              >
                <Input placeholder="60" {...register('constantVus.duration')} />
              </FormRow>
              <SelectField
                control={control}
                name="constantVus.timeUnit"
                label="Time unit"
                options={toOptions(TIME_UNITS)}
              />
            </div>
          ) : null}

          {loadMode === 'RAMPING_VUS' ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow
                  label="Starting VUs"
                  error={errors.rampingVus?.startVus?.message}
                >
                  <Input placeholder="0" {...register('rampingVus.startVus')} />
                </FormRow>
                <SelectField
                  control={control}
                  name="rampingVus.timeUnit"
                  label="Time unit"
                  options={toOptions(TIME_UNITS)}
                />
              </div>
              <StagesField name="rampingVus.stages" targetLabel="target VUs" />
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export function ExecutionFields({
  timeoutPlaceholder = '300',
  timeoutDescription,
}: {
  timeoutPlaceholder?: string;
  timeoutDescription?: string;
}) {
  const { control, register, formState } =
    useFormContext<RunConfigurationFormValues>();
  const errors = formState.errors.execution;
  const resourceProfile = useWatch({
    control,
    name: 'execution.resourceProfile',
  });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={control}
          name="execution.resourceProfile"
          label="Resource profile"
          options={toOptions(RESOURCE_PROFILES)}
        />
        <FormRow
          label="Timeout (seconds)"
          description={timeoutDescription}
          error={errors?.timeoutSeconds?.message}
        >
          <Input
            placeholder={timeoutPlaceholder}
            {...register('execution.timeoutSeconds')}
          />
        </FormRow>
      </div>

      {resourceProfile === 'CUSTOM' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow
            label="CPU (millicores)"
            error={errors?.cpuMillicores?.message}
          >
            <Input placeholder="500" {...register('execution.cpuMillicores')} />
          </FormRow>
          <FormRow label="Memory (MB)" error={errors?.memoryMb?.message}>
            <Input placeholder="512" {...register('execution.memoryMb')} />
          </FormRow>
        </div>
      ) : null}
    </>
  );
}
