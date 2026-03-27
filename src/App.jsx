import { useState } from 'react';
import LoginPage from './components/LoginPage';
import CalendarView from './components/CalendarView';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  return loggedIn ? (
    <CalendarView onLogout={() => setLoggedIn(false)} />
  ) : (
    <LoginPage onLogin={() => setLoggedIn(true)} />
  );
}
