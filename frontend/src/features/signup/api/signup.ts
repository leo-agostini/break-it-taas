import type {
  ApiErrorBody,
  SignupRequest,
  SignupResponse,
} from '@/features/signup/types/signup';
import { publicHttpClient } from '@/lib/httpClient';

export async function signup(payload: SignupRequest): Promise<SignupResponse> {
  try {
    const response = await publicHttpClient.post<SignupResponse>('/users', payload);
    return response.data;
  } catch (error) {
    let message = 'Signup failed. Please try again.';
    try {
      const body = (error as { response?: { data?: ApiErrorBody } }).response?.data;
      message = body?.error?.message ?? message;
    } catch {
      // noop
    }
    throw new Error(message);
  }
}
