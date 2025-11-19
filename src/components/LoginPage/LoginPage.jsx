import React, { useState } from 'react';
import { loginApi } from '../../api/api';

const LoginPage = ({ onLoginSuccess }) => {
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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
      // Если успешно, передаем данные пользователя в App.jsx
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
        <button className="login-btn" type="submit" disabled={loading}>
          {loading ? 'Вход...' : 'Войти'}
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