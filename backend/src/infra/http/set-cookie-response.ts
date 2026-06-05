export function jsonWithSetCookies(body: unknown, setCookieHeaders: string[]) {
  const headers = new Headers({
    'Content-Type': 'application/json;charset=utf-8',
  });

  for (const cookie of setCookieHeaders) {
    headers.append('Set-Cookie', cookie);
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers,
  });
}

export function noContentWithSetCookies(setCookieHeaders: string[]) {
  const headers = new Headers();

  for (const cookie of setCookieHeaders) {
    headers.append('Set-Cookie', cookie);
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}
