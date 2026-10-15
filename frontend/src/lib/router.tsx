import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export interface RouterContextType {
  pathname: string;
  searchParams: URLSearchParams;
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
  forward: () => void;
}

const RouterContext = createContext<RouterContextType | null>(null);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });

  const updateLocation = useCallback(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname || '/');
      setSearchParams(new URLSearchParams(window.location.search));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', updateLocation);
    return () => window.removeEventListener('popstate', updateLocation);
  }, [updateLocation]);

  const push = useCallback(
    (href: string) => {
      if (typeof window === 'undefined') return;
      if (href === currentPath + window.location.search) return;
      window.history.pushState({}, '', href);
      updateLocation();
    },
    [currentPath, updateLocation]
  );

  const replace = useCallback(
    (href: string) => {
      if (typeof window === 'undefined') return;
      window.history.replaceState({}, '', href);
      updateLocation();
    },
    [updateLocation]
  );

  const back = useCallback(() => {
    if (typeof window !== 'undefined') window.history.back();
  }, []);

  const forward = useCallback(() => {
    if (typeof window !== 'undefined') window.history.forward();
  }, []);

  const value = useMemo(
    () => ({
      pathname: currentPath,
      searchParams,
      push,
      replace,
      back,
      forward,
    }),
    [currentPath, searchParams, push, replace, back, forward]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    return {
      push: (href: string) => {
        if (typeof window !== 'undefined') {
          window.history.pushState({}, '', href);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      },
      replace: (href: string) => {
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', href);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      },
      back: () => {
        if (typeof window !== 'undefined') window.history.back();
      },
      forward: () => {
        if (typeof window !== 'undefined') window.history.forward();
      },
    };
  }
  return ctx;
}

export function usePathname(): string {
  const ctx = useContext(RouterContext);
  if (ctx) return ctx.pathname;
  return typeof window !== 'undefined' ? window.location.pathname : '/';
}

export function useSearchParams(): URLSearchParams {
  const ctx = useContext(RouterContext);
  if (ctx) return ctx.searchParams;
  return typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
}

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  replace?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, replace = false, onClick, className, children, ...rest }, ref) => {
    const router = useRouter();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (onClick) onClick(e);
      if (
        !e.defaultPrevented &&
        e.button === 0 &&
        !e.metaKey &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !rest.target
      ) {
        e.preventDefault();
        if (replace) {
          router.replace(href);
        } else {
          router.push(href);
        }
      }
    };

    return (
      <a ref={ref} href={href} onClick={handleClick} className={className} {...rest}>
        {children}
      </a>
    );
  }
);

Link.displayName = 'Link';

export default Link;
