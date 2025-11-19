import React, { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import LoginPage from './components/LoginPage/LoginPage';
import AppLayout from './components/AppLayout/AppLayout';
import { logoutApi } from './api/api';

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

  // 1. Инициализация: Проверяем токены при загрузке
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

  // 2. Обработчик успешного входа
  const handleLoginSuccess = (userData) => {
    // В userData (из loginApi) есть ID, Role и JTI
    setUser(userData);
  };

  // 3. Выход
  const handleLogout = () => {
    logoutApi(user?.jti); // Вызываем API
    setUser(null); // Обновляем состояние
  };

  if (loading) {
    return <div>Загрузка...</div>; // TODO: Стилизовать
  }

  // Если пользователь не авторизован, показываем страницу входа
  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Если авторизован, показываем основное приложение
  return <AppLayout user={user} onLogout={handleLogout} />;
};

export default App;