export function makeValidNewUserInput(overrides?: Partial<Record<string, unknown>>) {
  return {
    name: 'Alice Example',
    nickname: 'alice',
    photoUrl: 'https://example.com/alice.png',
    email: 'alice@example.com',
    password: 'StrongPass123!',
    ...overrides,
  };
}
