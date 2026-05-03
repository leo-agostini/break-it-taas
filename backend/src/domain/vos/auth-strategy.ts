export type SecretRef = {
  provider: string;
  key: string;
};

export enum AuthStrategyKind {
  NONE = 'NONE',
  BEARER_TOKEN = 'BEARER_TOKEN',
  BASIC_AUTH = 'BASIC_AUTH',
  API_KEY_HEADER = 'API_KEY_HEADER',
  LOGIN_FLOW = 'LOGIN_FLOW',
}

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export type HttpRequestDefinition = {
  method: HttpMethod;
  path: string;
  headers?: { name: string; value: string }[];
  queryParams?: { name: string; value: string }[];
  body?: Record<string, unknown>;
  timeoutMs?: number;
};

export type TokenExtractionRule = {
  kind: 'JSON_PATH';
  path: string;
};

export type AuthStrategy =
  | { kind: AuthStrategyKind.NONE }
  | { kind: AuthStrategyKind.BEARER_TOKEN; tokenRef: SecretRef }
  | {
      kind: AuthStrategyKind.BASIC_AUTH;
      username: string;
      passwordRef: SecretRef;
    }
  | {
      kind: AuthStrategyKind.API_KEY_HEADER;
      headerName: string;
      valueRef: SecretRef;
    }
  | {
      kind: AuthStrategyKind.LOGIN_FLOW;
      loginRequest: HttpRequestDefinition;
      tokenExtraction: TokenExtractionRule;
      applyAs: 'BEARER_TOKEN' | 'HEADER';
    };
