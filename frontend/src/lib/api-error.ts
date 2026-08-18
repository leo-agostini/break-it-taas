import { isAxiosError } from 'axios';

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    return body?.error?.message ?? error.message ?? fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export function isNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}
