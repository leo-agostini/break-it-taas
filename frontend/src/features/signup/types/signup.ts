export interface SignupRequest {
  name: string;
  nickname: string;
  photoUrl?: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  id: string;
  name: string;
  nickname: string;
  photoUrl: string | null;
  email: string;
  orgId: string | null;
  role: string | null;
}

export interface ApiErrorBody {
  error?: {
    message?: string;
  };
}
