import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  FormRow,
  FormSection,
  SelectField,
  toOptions,
} from '@/features/test-cases/components/form-controls';
import {
  ExecutionFields,
  LoadProfileFields,
} from '@/features/test-cases/components/run-configuration-fields';
import { StepsEditor } from '@/features/test-cases/components/steps-editor';
import { testTypeShapes } from '@/features/test-cases/lib/status';
import {
  AUTH_KINDS,
  type NewTestCaseFormValues,
  TEST_TYPES,
  defaultNewTestCaseValues,
  newTestCaseFormSchema,
} from '@/features/test-cases/schemas/new-test-case-schema';
import type { TestCaseOwnerType } from '@/features/test-cases/types/test-case';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
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

  const { control, register, handleSubmit, formState } = form;
  const errors = formState.errors;

  const testType = useWatch({ control, name: 'testType' });
  const authKind = useWatch({ control, name: 'auth.kind' });

  return (
    <FormProvider {...form}>
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
          title="Default load"
          description={`${testTypeShapes[testType]} Each run can override it.`}
        >
          <LoadProfileFields testType={testType} />
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

        <FormSection
          title="Default runner"
          description="The container runs execute on. Each run can override it."
        >
          <ExecutionFields />
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
    </FormProvider>
  );
}
