/**
 * Hash router (works on GitHub Pages without server rewrites).
 *   #/                 home
 *   #/sim/<id>?k=v     simulation with parameters
 *   #/lab              mobile sensor lab (list of experiments)
 *   #/lab/<tool>       one lab experiment
 */
export type Route =
  | { name: 'home' }
  | { name: 'sim'; id: string; query: URLSearchParams }
  | { name: 'lab'; tool: string | null; query: URLSearchParams }
  | { name: 'notfound'; path: string };

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const query = new URLSearchParams(qs);
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'sim' && parts[1]) return { name: 'sim', id: decodeURIComponent(parts[1]), query };
  if (parts[0] === 'lab') return { name: 'lab', tool: parts[1] ? decodeURIComponent(parts[1]) : null, query };
  return { name: 'notfound', path };
}

class Router {
  route = $state<Route>(parse(typeof location !== 'undefined' ? location.hash : ''));

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => {
        this.route = parse(location.hash);
      });
    }
  }

  go(path: string) {
    location.hash = path;
  }

  /** Update the query of the current route without adding history entries or reloading. */
  replaceQuery(query: URLSearchParams) {
    const [path] = (location.hash.replace(/^#/, '') || '/').split('?');
    const qs = query.toString();
    history.replaceState(history.state, '', `#${path}${qs ? `?${qs}` : ''}`);
  }
}

export const router = new Router();
