import {
  createServerCheckHttpClient,
  createServerPrivateHttpClient,
} from '@/lib/httpClient';
import { isAxiosError } from 'axios';
import { redirect } from 'react-router';

function isUnauthorized(error: unknown) {
  return isAxiosError(error) && error.response?.status === 401;
}

export interface AuthenticatedUser {
  id: string;
  orgId: string | null;
}

interface AuthCheckResponse {
  authenticated: boolean;
  user: AuthenticatedUser;
}

/**
 * Guards a protected route's loader and returns the authenticated actor, so a
 * caller that needs the user does not have to hit `/auth/check` a second time.
 */
export async function requireServerAuth(
  request: Request,
): Promise<AuthenticatedUser> {
  const privateClient = createServerPrivateHttpClient(request);

  try {
    const response = await privateClient.get<AuthCheckResponse>('/auth/check');
    return response.data.user;
  } catch (error) {
    // No session (or it expired): there is nothing to refresh, log in again.
    if (isUnauthorized(error)) {
      throw redirect('/login');
    }
    throw error;
  }
}

export async function redirectIfAuthenticated(request: Request) {
  const checkClient = createServerCheckHttpClient(request);
  try {
    await checkClient.get('/auth/check');
  } catch (error) {
    if (isUnauthorized(error)) {
      return;
    }

    if (error instanceof Response) {
      throw error;
    }

    throw error;
  }
  throw redirect('/');
}
