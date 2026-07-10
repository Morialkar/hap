import { createFileRoute, useNavigate, useLocation } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const Route = createFileRoute('/login')({
  component: Login,
});

function getReturnTo(searchStr: string): string {
  const returnTo = searchStr ? new URLSearchParams(searchStr).get('returnTo') : null;
  return returnTo?.startsWith('/') ? returnTo : '/';
}

function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && location.pathname === '/login') {
      navigate({ to: getReturnTo(location.searchStr) as never });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate({ to: getReturnTo(location.searchStr) as never });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container-xl d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="card-body p-4">
          <h2 className="card-title text-center mb-4">Heritage Archives Patrimoine</h2>
          <h3 className="h5 text-center mb-4">Connexion</h3>
          
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                Courriel
              </label>
              <input
                type="email"
                className="form-control"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label">
                Mot de passe
              </label>
              <input
                type="password"
                className="form-control"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={isLoading}
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
