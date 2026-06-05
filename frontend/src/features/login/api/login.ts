import type {
  ApiErrorBody,
  LoginRequest,
  LoginResponse,
} from '@/features/login/types/login';
import { publicHttpClient } from '@/lib/httpClient';

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  try {
    const response = await publicHttpClient.post<LoginResponse>(
      '/login',
      payload,
    );
    return response.data;
  } catch (error) {
    let message = 'Login failed. Please try again.';
    try {
      const body = (error as { response?: { data?: ApiErrorBody } }).response
        ?.data;
      message = body?.error?.message ?? message;
    } catch {
      // noop
    }
    throw new Error(message);
  }
}
