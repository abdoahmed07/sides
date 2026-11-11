import type { ReactNode } from 'react';
import { useData } from '../data/store';
import { href } from '../lib/router';

/** Centered column with the bottom tab bar (Today, add habit). */
export function Shell({ path, children }: { path: string; children: ReactNode }) {
  const { failedCount, retryFailed } = useData();
  const onToday = path === '/' || path === '';

  return (
    <div className="shell">
      <div className="content">{children}</div>

      {failedCount > 0 && (
        <div className="sync-notice" role="status">
          <span>
            {failedCount === 1 ? '1 check-in' : `${failedCount} check-ins`} not synced yet. Saved on this device.
          </span>
          <button className="btn btn-small" onClick={retryFailed}>
            Retry
          </button>
        </div>
      )}

      <nav className="tabbar" aria-label="Main">
        <a href={href('/')} className="tab" aria-current={onToday ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M8.5 12.2l2.4 2.4 4.6-5" />
          </svg>
          <span>Today</span>
        </a>
        <a href={href('/new')} className="tab tab-add" aria-label="Add a habit" aria-current={path === '/new' ? 'page' : undefined}>
          <span className="tab-add-circle">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 6v12M6 12h12" />
            </svg>
          </span>
        </a>
        <a href={href('/overview')} className="tab" aria-current={path === '/overview' ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
            <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
            <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
            <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
          </svg>
          <span>Overview</span>
        </a>
      </nav>
    </div>
  );
}
