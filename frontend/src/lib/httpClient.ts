import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';
const API_SERVER_BASE_URL = import.meta.env.VITE_API_SERVER_URL ?? API_BASE_URL;

type RetriableRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
};

function attachRefreshInterceptor(
  httpClient: AxiosInstance,
  refreshClient: AxiosInstance,
) {
  let inFlightRefresh: Promise<void> | null = null;

  httpClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const status = error.response?.status;
      const originalConfig = error.config as RetriableRequestConfig | undefined;

      if (status !== 401 || !originalConfig || originalConfig._retry) {
        throw error;
      }

      originalConfig._retry = true;

      if (!inFlightRefresh) {
        inFlightRefresh = refreshClient
          .post('/auth/refresh')
          .then(() => undefined)
          .finally(() => {
            inFlightRefresh = null;
          });
      }

      try {
        await inFlightRefresh;
      } catch {
        throw error;
      }

      return httpClient.request(originalConfig);
    },
  );
}

export const publicHttpClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshHttpClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const privateHttpClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

attachRefreshInterceptor(privateHttpClient, refreshHttpClient);

function resolveServerBaseUrl(request: Request) {
  const requestUrl = new URL(request.url);

  return API_SERVER_BASE_URL.startsWith('http')
    ? API_SERVER_BASE_URL
    : `${requestUrl.origin}${API_SERVER_BASE_URL}`;
}

export function createServerPublicHttpClient(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';

  return axios.create({
    baseURL: resolveServerBaseUrl(request),
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
  });
}

export function createServerPrivateHttpClient(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const resolvedBaseUrl = resolveServerBaseUrl(request);

  const serverRefreshClient = axios.create({
    baseURL: resolvedBaseUrl,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
  });

  const serverPrivateClient = axios.create({
    baseURL: resolvedBaseUrl,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
  });

  attachRefreshInterceptor(serverPrivateClient, serverRefreshClient);
  return serverPrivateClient;
}

export function createServerCheckHttpClient(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';

  return axios.create({
    baseURL: resolveServerBaseUrl(request),
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
  });
}
