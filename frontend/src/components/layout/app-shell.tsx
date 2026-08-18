import { BrandLogo } from '@/components/layout/brand-logo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { publicHttpClient } from '@/lib/httpClient';
import type { AuthenticatedUser } from '@/lib/server-auth';
import { cn } from '@/lib/utils';
import { currentUserAtom } from '@/state/current-user-atom';
import { LayoutList, LogOut, User } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useSetRecoilState } from 'recoil';

const nav = [{ label: 'Test Cases', href: '/test-cases', icon: LayoutList }];

export function AppShell({
  user,
  children,
}: {
  user: AuthenticatedUser;
  children: ReactNode;
}) {
  const setCurrentUser = useSetRecoilState(currentUserAtom);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setCurrentUser(user);
  }, [user, setCurrentUser]);

  async function handleSignOut() {
    try {
      await publicHttpClient.post('/auth/logout');
    } finally {
      navigate('/login');
    }
  }

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link to="/test-cases" aria-label="Break-It home">
            <BrandLogo />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary">
          <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Platform
          </p>
          {nav.map((item) => {
            const active = location.pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          <p className="font-mono">break-it-taas</p>
          <p>Performance testing workspace</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <Link
            to="/test-cases"
            className="md:hidden"
            aria-label="Break-It home"
          >
            <BrandLogo showWordmark={false} />
          </Link>
          <div className="flex flex-1 items-center">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Performance testing workspace
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback>
                    <User className="h-3.5 w-3.5" aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">
                  Account
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Signed in</span>
                  <span className="truncate font-mono text-xs font-normal text-muted-foreground">
                    {user.id}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
