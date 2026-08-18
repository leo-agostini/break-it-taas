import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { type ReactNode, useId } from 'react';
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export interface FormRowRenderProps {
  /** Put this on the focusable control so the label points at it. */
  id: string;
  /** For controls that are not labelable elements (e.g. a radiogroup). */
  labelId: string;
  describedBy?: string;
  invalid: boolean;
}

/**
 * Renders a label, a control, and its description/error, wiring the ids
 * between them so the control is always named and its help text announced.
 *
 * Pass a single element as `children` and the wiring is injected automatically.
 * Pass a function when the control is not a plain DOM element (a Radix `Select`
 * root renders nothing, so the id has to land on its trigger instead).
 */
export function FormRow({
  label,
  htmlFor,
  error,
  description,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  description?: string;
  className?: string;
  children: ReactNode | ((field: FormRowRenderProps) => ReactNode);
}) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const labelId = `${controlId}-label`;
  const descriptionId = `${controlId}-description`;
  const errorId = `${controlId}-error`;

  const describedBy =
    [description ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const field: FormRowRenderProps = {
    id: controlId,
    labelId,
    describedBy,
    invalid: !!error,
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <Label id={labelId} htmlFor={controlId}>
          {label}
        </Label>
      ) : null}

      {typeof children === 'function' ? (
        children(field)
      ) : (
        <Slot
          id={controlId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        >
          {children}
        </Slot>
      )}

      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField<TValues extends FieldValues>({
  control,
  name,
  label,
  ariaLabel,
  options,
  description,
  className,
}: {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label?: string;
  /** Required when there is no visible `label`, so the trigger still has a name. */
  ariaLabel?: string;
  options: SelectOption[];
  description?: string;
  className?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormRow
          label={label}
          description={description}
          error={fieldState.error?.message}
          className={className}
        >
          {({ id, describedBy, invalid }) => (
            <Select
              value={String(field.value ?? '')}
              onValueChange={field.onChange}
            >
              <SelectTrigger
                id={id}
                aria-label={label ? undefined : ariaLabel}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormRow>
      )}
    />
  );
}

export function toOptions(values: readonly string[]): SelectOption[] {
  return values.map((value) => ({
    value,
    label: value.replace(/_/g, ' '),
  }));
}
