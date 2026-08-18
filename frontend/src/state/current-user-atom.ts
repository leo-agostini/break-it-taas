import type { AuthenticatedUser } from '@/lib/server-auth';
import { atom } from 'recoil';

export const currentUserAtom = atom<AuthenticatedUser | null>({
  key: 'currentUser',
  default: null,
});
