import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { DEVICE_USER_ID, deviceBackend, supabaseBackend } from './data/backend';
import { DataProvider } from './data/store';
import { useDeviceMode } from './lib/mode';
import { supabase } from './lib/supabase';
import { useRoute } from './lib/router';
import { Shell } from './components/Shell';
import { HabitDetail } from './screens/HabitDetail';
import { HabitForm } from './screens/HabitForm';
import { NewHabitChat } from './screens/NewHabitChat';
import { Overview } from './screens/Overview';
import { Login } from './screens/Login';
import { Today } from './screens/Today';

// Built once: the store depends on the backend's identity.
const device = deviceBackend();
const account = supabase ? supabaseBackend(supabase) : null;

export function App() {
  const deviceMode = useDeviceMode();
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Keep the browser from clearing on-device habits when it is short on space.
    if (deviceMode) void navigator.storage?.persist?.().catch(() => undefined);
  }, [deviceMode]);

  if (deviceMode) {
    return (
      <DataProvider key="device" userId={DEVICE_USER_ID} backend={device}>
        <Routes />
      </DataProvider>
    );
  }

  if (session === undefined) return <main className="center-screen" aria-busy="true" />;
  if (!session || !account) return <Login accountsAvailable={!!account} />;

  return (
    <DataProvider key={session.user.id} userId={session.user.id} backend={account}>
      <Routes />
    </DataProvider>
  );
}

function Routes() {
  const { path, query } = useRoute();

  let screen;
  const edit = path.match(/^\/habit\/([^/]+)\/edit$/);
  const detail = path.match(/^\/habit\/([^/]+)$/);
  if (path === '/new' && query.get('form')) screen = <HabitForm suggestion={query.get('s')} />;
  else if (path === '/new') screen = <NewHabitChat key={query.get('s') ?? ''} suggestion={query.get('s')} />;
  else if (edit) screen = <HabitForm habitId={edit[1]} />;
  else if (detail) screen = <HabitDetail key={detail[1]} habitId={detail[1]} />;
  else if (path === '/overview') screen = <Overview />;
  else screen = <Today />;

  return <Shell path={path}>{screen}</Shell>;
}
