import { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import CalendarView from './components/CalendarView';
import * as EteService from './lib/etebase';

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    EteService.restoreSession().then((ok: boolean) => setLoggedIn(ok));
  }, []);

  if (loggedIn === null)
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="loading loading-spinner" />
      </div>
    );

  return loggedIn ? (
    <CalendarView onLogout={() => setLoggedIn(false)} />
  ) : (
    <LoginPage onLogin={() => setLoggedIn(true)} />
  );
}
