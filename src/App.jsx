import React, { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import LoginPage from './components/LoginPage/LoginPage';
import AppLayout from './components/AppLayout/AppLayout';
import { logoutApi, getKeycloakConfigApi } from './api/api';

// Функция для декодирования JWT (из api.js)
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Инициализация: Проверяем токены при загрузке
  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (token) {
      const decoded = parseJwt(token);
      const refreshJti = parseJwt(Cookies.get('refreshToken'))?.jti;

      if (decoded && decoded.exp * 1000 > Date.now()) {
        // Токен валиден, восстанавливаем базовый профиль
        setUser({ 
            id: decoded.sub, 
            role: decoded.role, 
            jti: refreshJti // JTI из refresh токена
        });
      } else {
        // Токен истек
        Cookies.remove('accessToken');
        Cookies.remove('refreshToken');
      }
    }
    setLoading(false);
  }, []);

  // Обработчик успешного входа
  const handleLoginSuccess = (userData) => {
    // В userData (из loginApi) есть ID, Role и JTI
    setUser(userData);
  };

  // Выход
  const handleLogout = async () => {
    // Проверить, был ли вход через Keycloak
    const wasKeycloak = localStorage.getItem('keycloak_login') === '1';

    try {
      if (wasKeycloak) {
        const config = await getKeycloakConfigApi();
        if (config?.url && config?.realm) {
          Cookies.remove('accessToken');
          Cookies.remove('refreshToken');
          localStorage.removeItem('keycloak_login');
          setUser(null);

          const logoutUrl = `${config.url}/realms/${config.realm}/protocol/openid-connect/logout?` +
            `post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}&` +
            `client_id=${encodeURIComponent(config.clientId)}`;

          window.location.href = logoutUrl;
          return;
        }
      }
    } catch (err) {
      console.error('Keycloak logout error:', err);
    }

    // Обычный logout (БД)
    try {
      await logoutApi(user?.jti);
    } catch (err) {
      console.error('Logout error:', err);
    }
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    localStorage.removeItem('keycloak_login');
    setUser(null);
  };

  if (loading) {
    return <div>Загрузка...</div>;
  }

  // Если пользователь не авторизован, показываем страницу входа
  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Если авторизован, показываем основное приложение
  return <AppLayout user={user} onLogout={handleLogout} />;
};

export default App;
