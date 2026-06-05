import { zodResolver } from '@hookform/resolvers/zod';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { login } from '@/features/login/api/login';
import {
  type LoginFormValues,
  loginSchema,
} from '@/features/login/schemas/login-schema';
import { cn } from '@/lib/utils';

export function LoginForm({ className, ...props }: ComponentProps<'form'>) {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values);
      navigate('/');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Login failed.');
    }
  });

  return (
    <Card className="w-full p-6">
      <form
        className={cn('flex flex-col gap-6', className)}
        onSubmit={onSubmit}
        {...props}
      >
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">Login to your account</h1>
            <p className="text-balance text-sm text-muted-foreground">
              Enter your email and password below.
            </p>
          </div>

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              {...form.register('email')}
            />
            {form.formState.errors.email ? (
              <FieldDescription className="text-destructive">
                {form.formState.errors.email.message}
              </FieldDescription>
            ) : null}
          </Field>

          <Field>
            <div className="flex items-center">
              <FieldLabel htmlFor="password">Password</FieldLabel>
            </div>
            <Input
              id="password"
              type="password"
              {...form.register('password')}
            />
            {form.formState.errors.password ? (
              <FieldDescription className="text-destructive">
                {form.formState.errors.password.message}
              </FieldDescription>
            ) : null}
          </Field>

          {submitError ? (
            <FieldDescription className="text-center text-destructive">
              {submitError}
            </FieldDescription>
          ) : null}

          <Field>
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Signing in...' : 'Login'}
            </Button>
          </Field>

          <Field>
            <FieldDescription className="text-center">
              Don&apos;t have an account?{' '}
              <Link
                viewTransition
                to="/signup"
                className="underline underline-offset-4"
              >
                Sign up
              </Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </Card>
  );
}
