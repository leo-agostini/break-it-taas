enum CheckKind {
  STATUS_CODE = 'STATUS_CODE',
  RESPONSE_TIME_LT = 'RESPONSE_TIME_LT',
  BODY_CONTAINS = 'BODY_CONTAINS',
  JSON_PATH_EQUALS = 'JSON_PATH_EQUALS',
}

enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export type StepCheck =
  | { kind: CheckKind.STATUS_CODE; expected: number }
  | { kind: CheckKind.RESPONSE_TIME_LT; maxMs: number }
  | { kind: CheckKind.BODY_CONTAINS; value: string }
  | {
      kind: CheckKind.JSON_PATH_EQUALS;
      path: string;
      expected: string | number | boolean;
    };

export type RequestBody = { [K: string]: unknown };

export class Step {
  path: string;
  method: HttpMethod;
  checks: StepCheck[];
  body?: RequestBody;
  headers?: { [K: string]: string };

  constructor(
    path: string,
    method: HttpMethod,
    checks: StepCheck[],
    body?: RequestBody,
    headers?: { [K: string]: string },
  ) {
    this.path = path;
    this.method = method;
    this.checks = checks;
    this.body = body;
    this.headers = headers;
  }
}
