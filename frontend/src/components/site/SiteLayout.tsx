import React, { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useRouter, usePathname } from '../../lib/router';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../common/ThemeToggle';
import { CONTACT_EMAIL } from './siteConfig';

const NAV = [
  { href: '/features', label: 'Features' },
  { href: '/download', label: 'Download' },
  ...(CONTACT_EMAIL ? [{ href: '/contact', label: 'Contact' }] : []),
];

const initialsOf = (name?: string) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

// The signed-in user reaches the app from here; the website itself never redirects them away.
const ProfileMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (!user) return null;
  const dashboardHref = user.role === 'ADMIN' ? '/admin' : '/dashboard';
  const itemClass = 'block w-full text-left px-3 py-2 text-sm text-ink-2 hover:bg-site-hover';

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="w-9 h-9 rounded-full bg-accent-solid text-white text-xs font-semibold flex items-center justify-center"
      >
        {initialsOf(user.fullName || user.username)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 bg-site-card border border-site-line rounded-md shadow-md py-1 z-30">
          <div className="px-3 py-2 border-b border-site-line">
            <p className="text-sm font-medium text-ink truncate">{user.fullName || user.username}</p>
            <p className="text-xs text-ink-3 truncate">{user.email}</p>
          </div>
          <button role="menuitem" type="button" className={itemClass} onClick={() => router.push(dashboardHref)}>
            Dashboard
          </button>
          <button role="menuitem" type="button" className={itemClass} onClick={() => router.push('/profile')}>
            Profile
          </button>
          <button
            role="menuitem"
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export const SiteLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  const navClass = (href: string) =>
    `text-sm ${pathname === href ? 'text-ink font-medium' : 'text-ink-2 hover:text-ink'}`;

  return (
    <div className="min-h-screen bg-site-card text-ink flex flex-col">
      <header className="sticky top-0 z-20 border-b border-site-line bg-site-card/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-semibold text-ink whitespace-nowrap">
              <img src="/logo-small.png" width={96} height={96} alt="" className="w-7 h-7 object-contain" />
              Account Ledger
            </Link>
            <nav aria-label="Main" className="hidden md:flex items-center gap-6">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className={navClass(item.href)}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <ProfileMenu />
            ) : (
              <>
                <Link href="/login" className="hidden sm:block text-sm text-ink-2 hover:text-ink">
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="btn-gradient hidden sm:block whitespace-nowrap px-3.5 py-2 text-sm font-medium rounded-md bg-accent-solid text-white"
                >
                  Create account
                </Link>
              </>
            )}
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
              className="md:hidden p-1.5 text-ink-2"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav aria-label="Mobile" className="md:hidden border-t border-site-line px-4 py-2">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="block py-2 text-sm text-ink-2">
                {item.label}
              </Link>
            ))}
            {!user && (
              <>
                <Link href="/login" className="block py-2 text-sm text-ink-2">
                  Sign in
                </Link>
                <Link href="/register" className="block py-2 text-sm font-medium text-accent">
                  Create account
                </Link>
              </>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-site-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-ink-3">
          <p>© {new Date().getFullYear()} Account Ledger</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-ink">
                {item.label}
              </Link>
            ))}
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
