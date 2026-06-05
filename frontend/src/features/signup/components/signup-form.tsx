import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { signup } from '@/features/signup/api/signup';
import {
  type SignupFormValues,
  signupSchema,
} from '@/features/signup/schemas/signup-schema';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

export function SignupForm({ className, ...props }: ComponentProps<'form'>) {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      nickname: '',
      photoUrl: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signup({
        ...values,
        photoUrl: values.photoUrl || undefined,
      });
      navigate('/login');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Signup failed.');
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
            <h1 className="text-2xl font-bold">Create your account</h1>
            <p className="text-balance text-sm text-muted-foreground">
              Enter your details to sign up.
            </p>
          </div>

          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" placeholder="Alice" {...form.register('name')} />
            {form.formState.errors.name ? (
              <FieldDescription className="text-destructive">
                {form.formState.errors.name.message}
              </FieldDescription>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="nickname">Nickname</FieldLabel>
            <Input
              id="nickname"
              placeholder="alice"
              {...form.register('nickname')}
            />
            {form.formState.errors.nickname ? (
              <FieldDescription className="text-destructive">
                {form.formState.errors.nickname.message}
              </FieldDescription>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="photoUrl">Photo URL (optional)</FieldLabel>
            <Input
              id="photoUrl"
              placeholder="https://example.com/photo.png"
              {...form.register('photoUrl')}
            />
            {form.formState.errors.photoUrl ? (
              <FieldDescription className="text-destructive">
                {form.formState.errors.photoUrl.message}
              </FieldDescription>
            ) : null}
          </Field>

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
            <FieldLabel htmlFor="password">Password</FieldLabel>
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
              {form.formState.isSubmitting ? 'Creating account...' : 'Sign up'}
            </Button>
          </Field>

          <FieldDescription className="text-center">
            Already have an account?{' '}
            <Link to="/login" className="underline underline-offset-4">
              Login
            </Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </Card>
  );
}
