import { useEffect, useState } from 'react';

/** Hash routing (`#/path?query`) so GitHub Pages never 404s on refresh. */
export interface Route {
  path: string;
  query: URLSearchParams;
}

function read(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(qs) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: string) {
  window.location.hash = to;
}

export const href = (to: string) => `#${to}`;
