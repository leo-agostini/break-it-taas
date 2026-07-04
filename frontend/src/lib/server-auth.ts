import {
  createServerCheckHttpClient,
  createServerPrivateHttpClient,
  createServerPublicHttpClient,
} from '@/lib/httpClient';
import { isAxiosError } from 'axios';
import { redirect } from 'react-router';

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
    const publicClient = createServerPublicHttpClient(request);
    await publicClient.post('/auth/refresh');

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
