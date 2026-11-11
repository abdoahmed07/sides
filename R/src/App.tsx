import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { APP_NAME } from './config';
import { DataProvider } from './data/store';
import { supabase } from './lib/supabase';
import { useRoute } from './lib/router';
import { Shell } from './components/Shell';
import { HabitDetail } from './screens/HabitDetail';
import { HabitForm } from './screens/HabitForm';
import { NewHabitChat } from './screens/NewHabitChat';
import { Overview } from './screens/Overview';
import { Login } from './screens/Login';
import { Today } from './screens/Today';

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) {
    return (
      <main className="center-screen">
        <h1 className="app-name">{APP_NAME}</h1>
        <p className="muted">
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add your project URL
          and anon key.
        </p>
      </main>
    );
  }

  if (session === undefined) return <main className="center-screen" aria-busy="true" />;
  if (!session) return <Login />;

  return (
    <DataProvider key={session.user.id} userId={session.user.id}>
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
