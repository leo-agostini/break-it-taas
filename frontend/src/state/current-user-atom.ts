import type { AuthenticatedUser } from '@/lib/server-auth';
import { atom } from 'jotai';

export const currentUserAtom = atom<AuthenticatedUser | null>(null);
