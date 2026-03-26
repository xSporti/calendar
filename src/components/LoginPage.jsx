import { useState } from 'react';
import { login } from '../lib/etebase';

export default function LoginPage({ onLogin }) {
  const [serverUrl, setServerUrl] = useState('https://calendar.sporti.cloud');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(serverUrl.trim(), username.trim(), password);
      onLogin();
    } catch (err) {
      setError('Anmeldung fehlgeschlagen: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 px-4">
      <div className="card bg-base-200 shadow-xl w-full max-w-md">
        <div className="card-body gap-4">
          <div>
            <p className="text-lg font-semibold tracking-widest text-primary uppercase mb-8">
              EteSync
            </p>
            <h1 className="text-4xl font-semibold">Anmelden</h1>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <fieldset className="fieldset">
              <legend className="text-lg fieldset-legend">Server URL</legend>
              <input
                type="url"
                className="text-lg input input-bordered w-full py-6"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                required
              />
            </fieldset>

            <fieldset className="fieldset">
              <legend className="text-lg fieldset-legend">Benutzername</legend>
              <input
                type="text"
                className="text-lg input input-bordered w-full py-6"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </fieldset>

            <fieldset className="fieldset">
              <legend className="text-lg fieldset-legend">Passwort</legend>
              <input
                type="password"
                className="text-lg input input-bordered w-full py-6"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </fieldset>

            {error && (
              <div role="alert" className="alert alert-error text-sm py-2">
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="text-lg btn btn-primary w-full mt-1"
              disabled={loading}
            >
              {loading && (
                <span className="loading loading-spinner loading-sm" />
              )}
              {loading ? 'Verbinde…' : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
