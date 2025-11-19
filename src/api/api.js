import Cookies from 'js-cookie';

const API_URL = 'http://localhost:3000';

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
        console.error('Ошибка декодирования JWT:', e);
        return null;
    }
}

export async function apiFetch(endpoint, options = {}) {
    const accessToken = Cookies.get('accessToken');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (response.status === 401) {
            Cookies.remove('accessToken');
            Cookies.remove('refreshToken');
            window.location.reload();
            return Promise.reject(new Error('unauthorized'));
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'unknown_error' }));
            console.error('Ошибка API:', response.status, errorData);
            return Promise.reject(errorData);
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();

    } catch (err) {
        console.error('Сетевая ошибка или ошибка fetch:', err);
        return Promise.reject(err);
    }
}

// Функции API

export async function loginApi(login, password) {
    const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
    });
    
    Cookies.set('accessToken', data.access, { expires: 1/24 });
    Cookies.set('refreshToken', data.refresh, { expires: 14 });

    const decoded = parseJwt(data.access);
    
    return {
        id: decoded.sub,
        role: decoded.role,
        jti: data.jti,
    };
}

export async function logoutApi(jti) {
    try {
        await apiFetch('/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ jti }),
        });
    } catch (error) {
        console.error('Ошибка при выходе:', error);
    }
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
}

// API Задач 
export const getTasksApi = () => apiFetch('/tasks');
export const createTaskApi = (taskData) => apiFetch('/tasks', { method: 'POST', body: JSON.stringify(taskData) });
export const updateTaskApi = (id, taskData) => apiFetch(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(taskData) });
export const deleteTaskApi = (id) => apiFetch(`/tasks/${id}`, { method: 'DELETE' });

// API Сотрудников
export const getEmployeesApi = () => apiFetch('/users');
export const createEmployeeApi = (employeeData) => apiFetch('/users', { method: 'POST', body: JSON.stringify(employeeData) });
export const deleteEmployeeApi = (id) => apiFetch(`/users/${id}`, { method: 'DELETE' });


// API Навыков
export const getSkillsApi = () => apiFetch('/skills');
// *** НОВЫЕ API ДЛЯ УПРАВЛЕНИЯ НАВЫКАМИ ***
export const createSkillCategoryApi = (name) => apiFetch('/skills/categories', {
  method: 'POST',
  body: JSON.stringify({ name })
});
export const createSkillApi = (name, category_id) => apiFetch('/skills', {
  method: 'POST',
  body: JSON.stringify({ name, category_id })
});
export const deleteSkillApi = (id) => apiFetch(`/skills/${id}`, { method: 'DELETE' });
export const deleteSkillCategoryApi = (id) => apiFetch(`/skills/categories/${id}`, { method: 'DELETE' });


// Teams API 
export const getTeamsApi = () => apiFetch('/teams');
export const createTeamApi = (teamData) => apiFetch('/teams', { 
  method: 'POST', 
  body: JSON.stringify(teamData) 
});
export const getTeamMembersApi = (teamId) => apiFetch(`/teams/${teamId}/members`);

// Основная функция добавления участника 
export const addTeamMemberApi = (teamId, userId, roleInTeam) => {
  console.log('API: Добавление участника', { teamId, userId, roleInTeam });
  
  const payload = {
    userId: userId.toString(),
    roleInTeam: roleInTeam
  };
  
  return apiFetch(`/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

export const removeTeamMemberApi = (teamId, userId) => {
  console.log('API: Удаление участника', { teamId, userId });
  return apiFetch(`/teams/${teamId}/members/${userId}`, {
    method: 'DELETE'
  });
};

// Удаление команды
export const deleteTeamApi = (teamId) => {
  console.log('API: Удаление команды', { teamId });
  return apiFetch(`/teams/${teamId}`, {
    method: 'DELETE'
  });
};

// Экспериментальная функция для удаления команды (если основная не работает)
export const deleteTeamExperimental = async (teamId) => {
  console.log('Экспериментальное удаление команды:', { teamId });
  
  const endpoints = [
    `/teams/${teamId}`,
    `/teams/${teamId}/delete`,
    `/teams?id=${teamId}`,
    `/teams/${teamId}/remove`
  ];
  
  for (let i = 0; i < endpoints.length; i++) {
    try {
      console.log(`Попытка ${i + 1} с endpoint: ${endpoints[i]}`);
      const result = await apiFetch(endpoints[i], {
        method: 'DELETE'
      });
      console.log(`Успех с endpoint ${i + 1}`);
      return result;
    } catch (error) {
      console.log(`Endpoint ${i + 1} не сработал:`, error);
      if (i === endpoints.length - 1) throw error;
    }
  }
};

// Функция обновления участника команды
export const updateTeamMemberApi = (teamId, userId, roleInTeam) => {
  console.log('API: Обновление участника', { teamId, userId, roleInTeam });
  return apiFetch(`/teams/${teamId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ roleinteam: roleInTeam })
  });
};

// Получение информации о конкретной команде
export const getTeamApi = (teamId) => {
  return apiFetch(`/teams/${teamId}`);
};

// Обновление информации о команде
export const updateTeamApi = (teamId, teamData) => {
  console.log('API: Обновление команды', { teamId, teamData });
  return apiFetch(`/teams/${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify(teamData)
  });
};