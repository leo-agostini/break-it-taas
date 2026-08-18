import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  FormRow,
  FormSection,
  SelectField,
  toOptions,
} from '@/features/test-cases/components/form-controls';
import { StepsEditor } from '@/features/test-cases/components/steps-editor';
import { loadModesByTestType } from '@/features/test-cases/lib/status';
import {
  AUTH_KINDS,
  type NewTestCaseFormValues,
  RESOURCE_PROFILES,
  TEST_TYPES,
  TIME_UNITS,
  defaultNewTestCaseValues,
  newTestCaseFormSchema,
} from '@/features/test-cases/schemas/new-test-case-schema';
import type { TestCaseOwnerType } from '@/features/test-cases/types/test-case';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';

export function TestCaseForm({
  canSelectOrganization,
  ownerType,
  onOwnerTypeChange,
  isSubmitting,
  submitError,
  onSubmit,
}: {
  canSelectOrganization: boolean;
  ownerType: TestCaseOwnerType;
  onOwnerTypeChange: (ownerType: TestCaseOwnerType) => void;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (values: NewTestCaseFormValues) => Promise<void>;
}) {
  const form = useForm<NewTestCaseFormValues>({
    resolver: zodResolver(newTestCaseFormSchema),
    defaultValues: defaultNewTestCaseValues,
    mode: 'onSubmit',
  });

  const { control, register, handleSubmit, setValue, formState } = form;
  const errors = formState.errors;

  const testType = useWatch({ control, name: 'testType' });
  const loadMode = useWatch({ control, name: 'loadMode' });
  const authKind = useWatch({ control, name: 'auth.kind' });
  const resourceProfile = useWatch({
    control,
    name: 'execution.resourceProfile',
  });

  const allowedModes = loadModesByTestType[testType];

  // Keep the load mode legal whenever the test type changes — the backend
  // rejects incompatible pairings outright.
  useEffect(() => {
    if (!allowedModes.includes(loadMode)) {
      setValue('loadMode', allowedModes[0]);
    }
  }, [allowedModes, loadMode, setValue]);

  const stages = useFieldArray({ control, name: 'ramp.stages' });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto w-full max-w-3xl space-y-6"
    >
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/test-cases">
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            New test case
          </h1>
          <p className="text-sm text-muted-foreground">
            Creating a test case immediately queues its first run.
          </p>
        </div>
      </header>

      <FormSection title="Basics">
        <FormRow label="Name" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            placeholder="Checkout API spike test"
            {...register('name')}
          />
        </FormRow>

        <FormRow
          label="Description"
          htmlFor="description"
          error={errors.description?.message}
        >
          <Textarea
            id="description"
            rows={3}
            placeholder="What this test verifies"
            {...register('description')}
          />
        </FormRow>

        <SelectField
          control={control}
          name="testType"
          label="Test type"
          options={toOptions(TEST_TYPES)}
        />

        {canSelectOrganization ? (
          <FormRow
            label="Owner"
            description="Organization-owned test cases are visible to your whole organization."
          >
            {({ labelId }) => (
              <ToggleGroup
                type="single"
                variant="outline"
                aria-labelledby={labelId}
                value={ownerType}
                onValueChange={(value) =>
                  value && onOwnerTypeChange(value as TestCaseOwnerType)
                }
              >
                <ToggleGroupItem value="USER">Me</ToggleGroupItem>
                <ToggleGroupItem value="ORGANIZATION">
                  My organization
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </FormRow>
        ) : null}
      </FormSection>

      <FormSection title="Target system">
        <FormRow
          label="Base URL"
          htmlFor="baseUrl"
          error={errors.baseUrl?.message}
        >
          <Input
            id="baseUrl"
            className="font-mono text-sm"
            placeholder="https://api.example.com"
            {...register('baseUrl')}
          />
        </FormRow>

        <FormRow
          label="Environment"
          htmlFor="environment"
          error={errors.environment?.message}
        >
          <Input
            id="environment"
            placeholder="staging"
            {...register('environment')}
          />
        </FormRow>
      </FormSection>

      <FormSection
        title="Auth strategy"
        description="Secrets are referenced, never stored in the test case. Provide the secret provider and key."
      >
        <SelectField
          control={control}
          name="auth.kind"
          label="Kind"
          options={toOptions(AUTH_KINDS)}
        />

        {authKind === 'BEARER_TOKEN' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow
              label="Token secret provider"
              error={errors.auth?.tokenRef?.provider?.message}
            >
              <Input
                placeholder="vault"
                {...register('auth.tokenRef.provider')}
              />
            </FormRow>
            <FormRow
              label="Token secret key"
              error={errors.auth?.tokenRef?.key?.message}
            >
              <Input
                placeholder="checkout/api-token"
                {...register('auth.tokenRef.key')}
              />
            </FormRow>
          </div>
        ) : null}

        {authKind === 'BASIC_AUTH' ? (
          <div className="space-y-4">
            <FormRow
              label="Username"
              error={errors.auth?.basicUsername?.message}
            >
              <Input
                placeholder="service-account"
                {...register('auth.basicUsername')}
              />
            </FormRow>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow
                label="Password secret provider"
                error={errors.auth?.passwordRef?.provider?.message}
              >
                <Input
                  placeholder="vault"
                  {...register('auth.passwordRef.provider')}
                />
              </FormRow>
              <FormRow
                label="Password secret key"
                error={errors.auth?.passwordRef?.key?.message}
              >
                <Input
                  placeholder="checkout/password"
                  {...register('auth.passwordRef.key')}
                />
              </FormRow>
            </div>
          </div>
        ) : null}

        {authKind === 'API_KEY_HEADER' ? (
          <div className="space-y-4">
            <FormRow
              label="Header name"
              error={errors.auth?.apiKeyHeaderName?.message}
            >
              <Input
                placeholder="X-API-Key"
                {...register('auth.apiKeyHeaderName')}
              />
            </FormRow>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow
                label="Value secret provider"
                error={errors.auth?.valueRef?.provider?.message}
              >
                <Input
                  placeholder="vault"
                  {...register('auth.valueRef.provider')}
                />
              </FormRow>
              <FormRow
                label="Value secret key"
                error={errors.auth?.valueRef?.key?.message}
              >
                <Input
                  placeholder="search/api-key"
                  {...register('auth.valueRef.key')}
                />
              </FormRow>
            </div>
          </div>
        ) : null}

        {authKind === 'LOGIN_FLOW' ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <SelectField
                control={control}
                name="auth.loginMethod"
                label="Method"
                options={toOptions(['GET', 'POST', 'PUT', 'PATCH'])}
              />
              <FormRow
                label="Login path"
                error={errors.auth?.loginPath?.message}
              >
                <Input
                  className="font-mono text-sm"
                  placeholder="/auth/login"
                  {...register('auth.loginPath')}
                />
              </FormRow>
            </div>
            <FormRow
              label="Login body (JSON)"
              error={errors.auth?.loginBodyJson?.message}
            >
              <Textarea
                rows={4}
                className="font-mono text-xs"
                placeholder='{ "email": "user@example.com" }'
                {...register('auth.loginBodyJson')}
              />
            </FormRow>
            <FormRow
              label="Token JSON path"
              error={errors.auth?.tokenExtractionPath?.message}
            >
              <Input
                className="font-mono text-sm"
                placeholder="$.accessToken"
                {...register('auth.tokenExtractionPath')}
              />
            </FormRow>
            <SelectField
              control={control}
              name="auth.applyAs"
              label="Apply token as"
              options={toOptions(['BEARER_TOKEN', 'HEADER'])}
            />
          </div>
        ) : null}
      </FormSection>

      <FormSection
        title="Load profile"
        description={`${testType.replace('_', ' ')} supports ${allowedModes.join(' and ')} load.`}
      >
        <FormRow label="Mode" error={errors.loadMode?.message}>
          {({ labelId }) => (
            <Controller
              control={control}
              name="loadMode"
              render={({ field }) => (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  aria-labelledby={labelId}
                  value={field.value}
                  onValueChange={(value) => value && field.onChange(value)}
                >
                  {(['CONSTANT', 'RAMP'] as const).map((mode) => (
                    <ToggleGroupItem
                      key={mode}
                      value={mode}
                      disabled={!allowedModes.includes(mode)}
                    >
                      {mode}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
          )}
        </FormRow>

        {loadMode === 'CONSTANT' ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <FormRow
              label="Target rate"
              error={errors.constant?.targetRate?.message}
            >
              <Input placeholder="100" {...register('constant.targetRate')} />
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
        ) : (
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Stages</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    stages.append({ target: '100', duration: '30' })
                  }
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Add stage
                </Button>
              </div>
              {errors.ramp?.stages?.message ? (
                <p className="text-xs text-destructive">
                  {errors.ramp.stages.message}
                </p>
              ) : null}

              {stages.fields.map((stage, index) => (
                <div key={stage.id} className="flex items-start gap-2">
                  <FormRow
                    error={errors.ramp?.stages?.[index]?.target?.message}
                    className="flex-1"
                  >
                    <Input
                      placeholder="target rate"
                      {...register(`ramp.stages.${index}.target`)}
                    />
                  </FormRow>
                  <FormRow
                    error={errors.ramp?.stages?.[index]?.duration?.message}
                    className="flex-1"
                  >
                    <Input
                      placeholder="duration"
                      {...register(`ramp.stages.${index}.duration`)}
                    />
                  </FormRow>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={stages.fields.length === 1}
                    onClick={() => stages.remove(index)}
                    aria-label="Remove stage"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </FormSection>

      <FormSection title="Thresholds">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow
            label="Max error rate"
            description="Between 0 and 1"
            error={errors.thresholds?.maxErrorRate?.message}
          >
            <Input
              placeholder="0.05"
              {...register('thresholds.maxErrorRate')}
            />
          </FormRow>
          <FormRow
            label="Min check success rate"
            description="Between 0 and 1"
            error={errors.thresholds?.minCheckSuccessRate?.message}
          >
            <Input
              placeholder="0.95"
              {...register('thresholds.minCheckSuccessRate')}
            />
          </FormRow>
          <FormRow
            label="Max p95 (ms)"
            error={errors.thresholds?.maxP95ResponseTimeMs?.message}
          >
            <Input
              placeholder="400"
              {...register('thresholds.maxP95ResponseTimeMs')}
            />
          </FormRow>
          <FormRow
            label="Max p99 (ms)"
            error={errors.thresholds?.maxP99ResponseTimeMs?.message}
          >
            <Input
              placeholder="800"
              {...register('thresholds.maxP99ResponseTimeMs')}
            />
          </FormRow>
        </div>

        <Controller
          control={control}
          name="thresholds.abortOnFail"
          render={({ field }) => (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Abort on failure</p>
                <p className="text-xs text-muted-foreground">
                  Stop the run as soon as a threshold is breached.
                </p>
              </div>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-label="Abort on failure"
              />
            </div>
          )}
        />
      </FormSection>

      <FormSection title="Execution">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            control={control}
            name="execution.resourceProfile"
            label="Resource profile"
            options={toOptions(RESOURCE_PROFILES)}
          />
          <FormRow
            label="Timeout (seconds)"
            error={errors.execution?.timeoutSeconds?.message}
          >
            <Input
              placeholder="300"
              {...register('execution.timeoutSeconds')}
            />
          </FormRow>
        </div>

        {resourceProfile === 'CUSTOM' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow
              label="CPU (millicores)"
              error={errors.execution?.cpuMillicores?.message}
            >
              <Input
                placeholder="500"
                {...register('execution.cpuMillicores')}
              />
            </FormRow>
            <FormRow
              label="Memory (MB)"
              error={errors.execution?.memoryMb?.message}
            >
              <Input placeholder="512" {...register('execution.memoryMb')} />
            </FormRow>
          </div>
        ) : null}
      </FormSection>

      <FormSection
        title="API contract"
        description="The HTTP steps the runner executes against the target system."
      >
        <StepsEditor
          control={control}
          register={register}
          error={errors.steps?.message}
        />
      </FormSection>

      {submitError ? (
        <p className="text-sm text-destructive">{submitError}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <Link to="/test-cases">Cancel</Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create test case'}
        </Button>
      </div>
    </form>
  );
}
