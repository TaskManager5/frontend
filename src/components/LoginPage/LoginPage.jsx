import React, { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { loginApi, getKeycloakConfigApi, keycloakCallbackApi } from '../../api/api';

const LoginPage = ({ onLoginSuccess }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [keycloakLoading, setKeycloakLoading] = useState(false);

  // Обработка callback от Keycloak (если в URL есть ?code=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      // Защита от повторного обмена (React StrictMode, retry)
      const exchangeKey = `kc_exchanged_${code}`;
      if (sessionStorage.getItem(exchangeKey)) {
        console.log('Code already exchanged, skipping');
        return;
      }
      sessionStorage.setItem(exchangeKey, '1');

      setKeycloakLoading(true);
      const redirectUri = window.location.origin + window.location.pathname;
      keycloakCallbackApi(code, redirectUri)
        .then(tokens => {
          Cookies.set('accessToken', tokens.access, { expires: 1/24 });
          Cookies.set('refreshToken', tokens.refresh, { expires: 14 });
          localStorage.setItem('keycloak_login', '1');
          // Перезагружаем страницу — App увидит токен
          window.location.href = window.location.pathname;
        })
        .catch(err => {
          console.error('Keycloak error:', err);
          setError('Ошибка входа через Keycloak. Попробуйте снова.');
          setKeycloakLoading(false);
          // Убираем ?code= из URL
          window.history.replaceState({}, '', window.location.pathname);
        });
    }
  }, []);

  const handleKeycloakLogin = async () => {
    try {
      setError(null);
      setKeycloakLoading(true);
      const config = await getKeycloakConfigApi();
      const redirectUri = window.location.origin + window.location.pathname;
      const authUrl = `${config.url}/realms/${config.realm}/protocol/openid-connect/auth?` +
        `client_id=${encodeURIComponent(config.clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=openid profile email`;
      window.location.href = authUrl;
    } catch (err) {
      console.error('Keycloak config error:', err);
      setError('Keycloak не настроен. Обратитесь к администратору.');
      setKeycloakLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!login.trim() || !password.trim()) {
      setError('Введите логин и пароль.');
      setLoading(false);
      return;
    }

    try {
      // Вызываем API, которое мы создали
      const userData = await loginApi(login, password);
      localStorage.removeItem('keycloak_login');
      onLoginSuccess(userData);
    } catch (err) {
      if (err.error === 'invalid_credentials') {
        setError('Неверный логин или пароль.');
      } else {
        setError('Ошибка подключения к серверу. Попробуйте позже.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" id="loginPage">
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="login-logo">
          <i className="fas fa-tasks"></i> TaskManager
        </div>
        <div className="form-group">
          <label htmlFor="username">Логин</label>
          <input
            type="text"
            id="username"
            placeholder="Введите ваш логин"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Пароль</label>
          <input
            type="password"
            id="password"
            placeholder="Введите ваш пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="login-btn" type="submit" disabled={loading || keycloakLoading}>
          {loading ? 'Вход...' : 'Войти'}
        </button>

        <div style={{ 
          textAlign: 'center', 
          margin: '12px 0', 
          color: '#999', 
          fontSize: 13,
          position: 'relative'
        }}>
          <span style={{ background: 'white', padding: '0 8px', position: 'relative', zIndex: 1 }}>
            или
          </span>
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            left: 0, 
            right: 0, 
            borderTop: '1px solid #eee',
            zIndex: 0
          }}></div>
        </div>

        <button 
          type="button"
          onClick={handleKeycloakLogin}
          disabled={loading || keycloakLoading}
          className="login-btn"
          style={{ 
            background: '#0088cc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <i className="fas fa-key"></i>
          {keycloakLoading ? 'Вход через Keycloak...' : 'Войти через Keycloak'}
        </button>

        {error && (
          <div className="login-error" style={{ display: 'block' }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default LoginPage;
