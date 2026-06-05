import { isAxiosError } from 'axios';
import { redirect } from 'react-router';
import {
  createServerCheckHttpClient,
  createServerPrivateHttpClient,
  publicHttpClient,
} from '@/lib/httpClient';

function isUnauthorized(error: unknown) {
  return isAxiosError(error) && error.response?.status === 401;
}

export async function requireServerAuth(request: Request) {
  const privateClient = createServerPrivateHttpClient(request);

  try {
    await privateClient.get('/auth/check');
    return;
  } catch (error) {
    if (!isUnauthorized(error)) {
      throw error;
    }
  }

  try {
    await publicHttpClient.post('/auth/refresh', undefined, {
      headers: {
        Cookie: request.headers.get('cookie') ?? '',
      },
    });

    await privateClient.get('/auth/check');
  } catch {
    throw redirect('/login');
  }
}

export async function redirectIfAuthenticated(request: Request) {
  const checkClient = createServerCheckHttpClient(request);
  console.log('checkClient', checkClient);
  try {
    const response = await checkClient.get('/auth/check');
    console.log('RESPONSE', response);
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
