export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    name: string;
    email: string;
    orgId: string | null;
  };
}

export interface ApiErrorBody {
  error?: {
    message?: string;
  };
}
