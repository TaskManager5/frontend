import React, { useState, useEffect, useMemo } from 'react';
import { 
    apiFetch,
    getTasksApi, 
    createTaskApi, 
    updateTaskApi, 
    deleteTaskApi, 
    getEmployeesApi, 
    createEmployeeApi,
    getTeamsApi,
    getTeamMembersApi,
    getSkillsApi,
    deleteEmployeeApi 
} from '../../api/api';
import TeamsManagement from '../TeamsManagement/TeamsManagement';
import SkillsManagement from '../SkillsManagement/SkillsManagement'; 
import TeamGraph from '../TeamGraph/TeamGraph'; 

// Импорты для графиков
import { Doughnut, Pie, Bar } from 'react-chartjs-2';
import { 
    Chart as ChartJS, 
    ArcElement, 
    Tooltip, 
    Legend, 
    CategoryScale, 
    LinearScale, 
    BarElement, 
    Title 
} from 'chart.js';

// Регистрируем компоненты, необходимые для Chart.js
ChartJS.register(
    ArcElement, Tooltip, Legend, Title,
    CategoryScale, LinearScale, BarElement
);

// вспомогательные функции

function calculateQuadrant(importance, deadline) {
    const today = new Date();
    const taskDate = new Date(deadline);
    const timeDiff = taskDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    

    const isUrgent = daysDiff <= 2;
    const isImportant = importance >= 7;
    
    if (isUrgent && isImportant) return 1;
    if (!isUrgent && isImportant) return 2;
    if (isUrgent && !isImportant) return 3;
    return 4;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

// Проверка, срочная ли задача
const isTaskUrgent = (task) => {
    const today = new Date();
    const taskDate = new Date(task.deadline);
    const timeDiff = taskDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff <= 7;
};

// Главный компонент приложения 

const AppLayout = ({ user, onLogout }) => {
    // Глобальное состояние (замена globalState)
    const [userInfo, setUserInfo] = useState(user); // user (id, role, jti)
    const [employees, setEmployees] = useState([]); // globalState.employees
    const [tasks, setTasks] = useState([]);         // globalState.tasks
    const [teams, setTeams] = useState([]); 
    const [allSkills, setAllSkills] = useState([]);
    const [currentFilter, setCurrentFilter] = useState('all');
    const [currentView, setCurrentView] = useState('tasks');
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingContent, setLoadingContent] = useState(true);

    // Состояние модальных окон 
    const [isTaskModalOpen, setTaskModalOpen] = useState(false);
    const [isEmployeesModalOpen, setEmployeesModalOpen] = useState(false);
    const [isAddEmployeeModalOpen, setAddEmployeeModalOpen] = useState(false);
    
    // Состояние для модального окна профиля
    const [isProfileModalOpen, setProfileModalOpen] = useState(false);
    
    // Состояние для фильтра матрицы
    const [matrixView, setMatrixView] = useState('all'); // 'all', 1, 2, 3, 4

    // Загрузка данных 
    
    // (не используется в useEffect, но нужна для handleSaveEmployee)
    const loadEmployees = async () => {
        try {
            const data = await getEmployeesApi();
            setEmployees(data);
            return data; 
        } catch (err) {
            console.error('Ошибка загрузки сотрудников:', err);
            return []; 
        }
    };

    // Функция загрузки
    const loadData = async () => {
        try {
            // Загружаем всё параллельно
            const [taskData, employeeData, teamData, skillsData] = await Promise.all([
                getTasksApi(),
                getEmployeesApi(),
                getTeamsApi(),
                getSkillsApi() 
            ]);

            setEmployees(employeeData);
            setTeams(teamData); 
            setAllSkills(skillsData); 

            // Сопоставляем имя сотрудника с задачей
            const tasksWithNames = taskData.map(task => {
                const assignee = employeeData.find(emp => emp.id === task.assignee_id);
                // Ищем ИМЯ КОМАНДЫ
                const team = teamData.find(t => t.id === task.team_id);
                
                return {
                    ...task,
                    deadline: task.deadline.split('T')[0],
                    completed: task.status === 'done' || task.status === 'canceled',
                    assignee_name: assignee ? assignee.name : (task.assignee_id ? 'Неизвестный' : null),
                    team_name: team ? team.name : null
                };
            });
            setTasks(tasksWithNames);
            
            // Находим данные текущего пользователя
            const currentUserData = employeeData.find(emp => emp.id.toString() === user.id.toString());
            if (currentUserData) {
                setUserInfo(prev => ({
                    ...prev,
                    name: currentUserData.name,
                    avatar: currentUserData.name.split(' ').map(n => n[0]).join('')
                }));
            } else {
                setUserInfo(prev => ({ ...prev, name: prev.role, avatar: prev.role[0] }));
            }
            
            return { tasks: tasksWithNames, employees: employeeData };

        } catch (err) {
            console.error('Ошибка загрузки данных:', err);
        }
    };

    // Загрузка всех данных при старте
    useEffect(() => {
        const loadAllData = async () => {
            setLoadingContent(true);
            await loadData(); // Вызываем новую функцию
            setLoadingContent(false);
        };
        loadAllData();
    }, []); // Запускается один раз при входе
    
    // Логика задач (Фильтрация)
    const filteredTasks = useMemo(() => {
        let filtered = tasks;
        const today = new Date();
        today.setHours(0, 0, 0, 0); 

        switch (currentFilter) {
            case 'urgent':
                filtered = filtered.filter(task => isTaskUrgent(task) && !task.completed);
                break;
            case 'important':
                filtered = filtered.filter(task => task.importance >= 7 && !task.completed);
                break;
            case 'completed':
                filtered = filtered.filter(task => task.completed);
                break;
            case 'overdue':
                filtered = filtered.filter(task => {
                    const taskDate = new Date(task.deadline);
                    taskDate.setHours(0, 0, 0, 0); // Также убираем время
                    return taskDate < today && !task.completed;
                });
                break;
            case 'all':
            default:
                filtered = filtered.filter(task => !task.completed);
                break;
        }

        if (searchTerm) {
            filtered = filtered.filter(task => 
                task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        
        return filtered;
    }, [tasks, currentFilter, searchTerm]);

    // Группировка по квадрантам
    const quadrants = useMemo(() => {
        const q = { 1: [], 2: [], 3: [], 4: [] };
        
        filteredTasks.forEach(task => {
            const quad = calculateQuadrant(task.importance, task.deadline);
            if (q[quad]) q[quad].push(task);
        });
        return q;
    }, [filteredTasks]);
    
    // Обработчики Задач 
    
    const handleSaveTask = async (taskData) => {
        try {
            await createTaskApi(taskData);
            setTaskModalOpen(false);
            await loadData(); // Перезагружаем все данные
        } catch (error) {
            console.error("Ошибка сохранения задачи:", error);
            alert("Не удалось сохранить задачу.");
        }
    };

    const handleToggleTask = async (task) => {
        const newStatus = task.completed ? 'in_progress' : 'done';
        try {
            await updateTaskApi(task.id, { status: newStatus });
            await loadData(); // Перезагружаем все данные
        } catch (error) {
            console.error("Ошибка обновления задачи:", error);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (window.confirm('Вы уверены, что хотите удалить эту задачу?')) {
            try {
                await deleteTaskApi(taskId);
                await loadData(); // Перезагружаем все данные
            } catch (error) {
                console.error("Ошибка удаления задачи:", error);
                // Дополнительная обратная связь, если бэк вернул ошибку
                if (error.error) {
                    alert(`Не удалось удалить задачу: ${error.error}`);
                }
            }
        }
    };

    // Обработчики Сотрудников
    const handleSaveEmployee = async (employeeData) => {
        try {
            await createEmployeeApi(employeeData);
            setAddEmployeeModalOpen(false);
            await loadData(); // Перезагружаем ВСЕ, чтобы сотрудники обновились
        } catch (error) {
            console.error("Ошибка добавления сотрудника:", error);
            alert("Не удалось добавить сотрудника. " + (error.error || ''));
        }
    };
    
    // Удаление сотрудника
    const handleDeleteEmployee = async (employeeId, employeeName) => {
        if (employeeId === userInfo.id) {
            alert("Вы не можете удалить сами себя.");
            return;
        }
        
        const message = `Вы уверены, что хотите удалить сотрудника "${employeeName}"?\n\nВНИМАНИЕ: Все задачи, созданные этим сотрудником или назначенные на него, будут ПОЛНОСТЬЮ УДАЛЕНЫ. Он также будет удален из всех команд.\n\nЭто действие нельзя отменить.`;
        
        if (window.confirm(message)) {
            try {
                await deleteEmployeeApi(employeeId);
                await loadData(); // Перезагружаем все данные
                alert("Сотрудник успешно удален.");
            } catch (error) {
                console.error("Ошибка удаления сотрудника:", error);
                alert(`Не удалось удалить сотрудника: ${error.error || 'Ошибка сервера'}`);
            }
        }
    };
    
    // Права доступа (RBAC)
    const canAddTask = userInfo.role === 'admin' || userInfo.role === 'manager';
    const canSeeAnalytics = userInfo.role === 'admin' || userInfo.role === 'manager';
    // Права на администрирование
    const canAdmin = userInfo.role === 'admin';

    // Получаем полные данные пользователя для модального окна
    const fullUserDetails = useMemo(() => {
        return employees.find(emp => emp.id.toString() === userInfo.id.toString()) || {};
    }, [employees, userInfo]);


    if (loadingContent) {
        return <div className="app-container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>Загрузка...</div>;
    }

    return (
        <div className="app-container" style={{ display: 'flex' }}>
            {/* 1. Сайдбар */}
            <aside className="sidebar">
                <div className="logo"><i className="fas fa-tasks"></i><span>TaskManager</span></div>
                
                {/*Добавлен onClick для открытия профиля */}
                <div className="user-info" onClick={() => setProfileModalOpen(true)} title="Посмотреть профиль">
                    <div className="user-avatar" id="userAvatar">{userInfo.avatar || '..'}</div>
                    <div className="user-details">
                        <div className="user-name" id="userName">{userInfo.name || '...'}</div>
                        <div className="user-role" id="userRole">{userInfo.role}</div>
                    </div>
                </div>

                <ul className="menu">
                    <li className={`menu-item ${currentView === 'tasks' ? 'active' : ''}`} onClick={() => setCurrentView('tasks')}>
                        <i className="fas fa-home"></i><span>Главная</span>
                    </li>
                    {canAddTask && (
                        <li className="menu-item" onClick={() => setTaskModalOpen(true)}>
                            <i className="fas fa-plus-circle"></i><span>Добавить задачу</span>
                        </li>
                    )}
                    {canSeeAnalytics && (
                        <li className={`menu-item ${currentView === 'analytics' ? 'active' : ''}`} onClick={() => setCurrentView('analytics')}>
                            <i className="fas fa-chart-pie"></i><span>Аналитика</span>
                        </li>
                    )}
                    <li className={`menu-item ${currentView === 'teams' ? 'active' : ''}`} onClick={() => setCurrentView('teams')}>
                        <i className="fas fa-users"></i><span>Команды</span>
                    </li>
                    {/*Ссылка на Граф */}
                    <li className={`menu-item ${currentView === 'graph' ? 'active' : ''}`} onClick={() => setCurrentView('graph')}>
                        <i className="fas fa-project-diagram"></i><span>Схема проекта</span>
                    </li>
                    <li className="menu-item" onClick={() => setEmployeesModalOpen(true)}>
                        <i className="fas fa-users"></i><span>Сотрудники</span>
                    </li>
                    {/*Ссылка на Управление навыками */}
                    {canAdmin && (
                        <li className={`menu-item ${currentView === 'skills' ? 'active' : ''}`} onClick={() => setCurrentView('skills')}>
                            <i className="fas fa-book"></i><span>Словарь навыков</span>
                        </li>
                    )}
                    <li className="menu-item" onClick={onLogout}>
                        <i className="fas fa-sign-out-alt"></i><span>Выход</span>
                    </li>
                </ul>
            </aside>

            {/* 2. Основной контент */}
            <main className="main-content">
                <div className="content-wrapper">
                    <div className="top-bar">
                        <div className="page-title" id="pageTitle">
                            {currentView === 'tasks' ? 'Матрица Эйзенхауэра' : 
                             currentView === 'analytics' ? 'Аналитика' : 
                             currentView === 'teams' ? 'Управление командами' : 
                             currentView === 'skills' ? 'Управление навыками' :
                             currentView === 'graph' ? 'Схема проекта' : ''}
                        </div>
                        <div className="search-box">
                            <i className="fas fa-search"></i>
                            <input 
                                type="text" 
                                placeholder="Поиск задач..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    {/*Фильтры для квадрантов (появляются только на 'tasks') */}
                    {currentView === 'tasks' && (
                        <div className="matrix-filter-bar">
                            <button 
                                className={`btn ${matrixView === 'all' ? 'btn-primary' : 'btn-secondary'}`} 
                                onClick={() => setMatrixView('all')}>
                                <i className="fas fa-th-large"></i> Все
                            </button>
                            <button 
                                className={`btn ${matrixView === 1 ? 'btn-danger' : 'btn-secondary'}`}
                                onClick={() => setMatrixView(1)}>
                                1. Срочно/Важно
                            </button>
                            <button 
                                className={`btn ${matrixView === 2 ? 'btn-success' : 'btn-secondary'}`}
                                onClick={() => setMatrixView(2)}>
                                2. Не срочно/Важно
                            </button>
                            <button 
                                className={`btn ${matrixView === 3 ? 'btn-warning' : 'btn-secondary'}`}
                                onClick={() => setMatrixView(3)}>
                                3. Срочно/Не важно
                            </button>
                            <button 
                                className={`btn ${matrixView === 4 ? 'btn-gray' : 'btn-secondary'}`}
                                onClick={() => setMatrixView(4)}>
                                4. Не срочно/Не важно
                            </button>
                        </div>
                    )}


                    {/* Область контента (меняется) */}
                    <div className="content-area" id="contentArea">
                        {currentView === 'tasks' && (
                            <TaskMatrix 
                                quadrants={quadrants}
                                onToggleTask={handleToggleTask}
                                onDeleteTask={handleDeleteTask}
                                currentUser={userInfo}
                                matrixView={matrixView} // Передаем режим просмотра
                            />
                        )}
                        {currentView === 'analytics' && (
                            <AnalyticsDashboard 
                                tasks={tasks} 
                                employees={employees} 
                            />
                        )}
                        {currentView === 'teams' && (
                            // Передаем задачи и сотрудников
                            <TeamsManagement 
                                currentUser={userInfo} 
                                tasks={tasks}
                                employees={employees}
                            />
                        )}
                        {/*Рендер Управления Навыками */}
                        {currentView === 'skills' && (
                            <SkillsManagement 
                                allSkills={allSkills}
                                onUpdate={loadData} // Передаем loadData для обновления
                            />
                        )}
                        {/* Рендер Графа */}
                        {currentView === 'graph' && (
                            <TeamGraph 
                                currentUser={userInfo}
                            />
                        )}
                    </div>

                    {/* Кнопки действий */}
                    {currentView === 'tasks' && (
                        <div className="action-buttons" id="actionButtons">
                            {canAddTask && (
                                <button className="action-button btn-primary" onClick={() => setTaskModalOpen(true)}>
                                    <i className="fas fa-plus"></i> Добавить задачу
                                </button>
                            )}
                            <button className={`action-button btn-secondary ${currentFilter === 'urgent' ? 'filter-active' : ''}`} onClick={() => setCurrentFilter('urgent')}>
                                <i className="fas fa-fire"></i> Срочные задачи
                            </button>
                            <button className={`action-button btn-secondary ${currentFilter === 'overdue' ? 'filter-active' : ''}`} onClick={() => setCurrentFilter('overdue')}>
                                <i className="fas fa-calendar-times"></i> Просроченные
                            </button>
                            <button className={`action-button btn-secondary ${currentFilter === 'important' ? 'filter-active' : ''}`} onClick={() => setCurrentFilter('important')}>
                                <i className="fas fa-star"></i> Важные задачи
                            </button>
                            <button className={`action-button btn-secondary ${currentFilter === 'completed' ? 'filter-active' : ''}`} onClick={() => setCurrentFilter('completed')}>
                                <i className="fas fa-check-circle"></i> Выполненные
                            </button>
                             <button className={`action-button btn-secondary ${currentFilter === 'all' ? 'filter-active' : ''}`} onClick={() => setCurrentFilter('all')}>
                                <i className="fas fa-list"></i> Все активные
                            </button>
                        </div>
                    )}
                </div>
            </main>
            
            {/* 3. Модальные окна */}
            {isTaskModalOpen && (
                <AddTaskModal 
                    onClose={() => setTaskModalOpen(false)}
                    onSave={handleSaveTask}
                    employees={employees}
                    currentUser={userInfo}
                    teams={teams}
                    allSkills={allSkills} 
                />
            )}
            {isEmployeesModalOpen && (
                <EmployeesModal 
                    onClose={() => setEmployeesModalOpen(false)}
                    onShowAdd={() => {
                        setEmployeesModalOpen(false);
                        setAddEmployeeModalOpen(true);
                    }}
                    employees={employees}
                    canAdd={canAddTask}
                    currentUser={userInfo} // <-- Передаем currentUser
                    onDelete={handleDeleteEmployee} // <-- Передаем обработчик
                    canDelete={canAdmin} // <-- Передаем права
                />
            )}
            {isAddEmployeeModalOpen && (
                <AddEmployeeModal 
                    onClose={() => setAddEmployeeModalOpen(false)}
                    onSave={handleSaveEmployee}
                    allSkills={allSkills} 
                />
            )}
            
            {/*Модальное окно профиля */}
            {isProfileModalOpen && (
                <UserProfileModal
                    onClose={() => setProfileModalOpen(false)}
                    user={userInfo}
                    details={fullUserDetails}
                />
            )}
        </div>
    );
};

// Компоненты-помощники 

// TaskMatrix теперь принимает matrixView
const TaskMatrix = ({ quadrants, onToggleTask, onDeleteTask, currentUser, matrixView }) => {
    
    // Упрощаем canDeleteTask (проверяем, что created_by существует)
    const canDeleteTask = (task) => {
        if (!currentUser || !task) return false;
        const userId = currentUser.id.toString();
        const createdBy = task.created_by ? task.created_by.toString() : null; 
        const assignedTo = task.assignee_id ? task.assignee_id.toString() : null;

        if (currentUser.role === 'admin') return true;
        if (currentUser.role === 'manager' && createdBy === userId) return true;
        if (currentUser.role === 'user' && (assignedTo === userId || createdBy === userId)) {
            return true;
        }
        return false;
    };

    const quadrantTitles = {
        1: "Срочно и Важно",
        2: "Не срочно, но важно",
        3: "Срочно, но не важно",
        4: "Не срочно и не важно"
    };
    
    // Функция для рендера одного квадранта
    const renderQuadrant = (qId) => (
        <div className={`quadrant quadrant-${qId} ${matrixView !== 'all' ? 'single-view' : ''}`} key={qId}>
            <div className="quadrant-header">
                <div className="quadrant-title">{quadrantTitles[qId]}</div>
                <div className="quadrant-count">{quadrants[qId].length}</div>
            </div>
            <div className="quadrant-tasks">
                {quadrants[qId].length > 0 ? (
                    quadrants[qId].map(task => (
                        <div className={`task-item ${task.completed ? 'task-completed' : ''}`} data-task-id={task.id} key={task.id}>
                            <div className="task-header">
                                <div className="task-title">
                                    {task.title}
                                    {task.completed && <span className="completed-badge">Выполнено</span>}
                                </div>
                                <span className={`complexity-badge complexity-${task.complexity >= 7 ? 'high' : task.complexity >= 4 ? 'medium' : 'low'}`}>
                                    Сложность: {task.complexity}/10
                                </span>
                            </div>
                            <div className="task-description">{task.description}</div>
                            <div className="task-meta">
                                <span><i className="far fa-calendar"></i> {formatDate(task.deadline)}</span>
                                <span><i className="fas fa-bolt"></i> Важность: {task.importance}/10</span>
                                {/* Показываем сотрудника */}
                                {task.assignee_name && (
                                    <span><i className="fas fa-user"></i> {task.assignee_name}</span>
                                )}
                                {/* Показываем команду */}
                                {task.team_name && (
                                    <span><i className="fas fa-users"></i> {task.team_name}</span>
                                )}
                            </div>
                            <div className="task-actions">
                                <button className="task-action-btn complete-btn" onClick={() => onToggleTask(task)}>
                                    <i className={`fas fa-${task.completed ? 'undo' : 'check'}`}></i> 
                                    {task.completed ? 'Выполнено' : 'Выполнить'}
                                </button>
                                <button 
                                    className="task-action-btn delete-btn" 
                                    onClick={() => onDeleteTask(task.id)}
                                    disabled={!canDeleteTask(task)}
                                    title={!canDeleteTask(task) ? 'Вы не можете удалить эту задачу' : 'Удалить задачу'}
                                    style={!canDeleteTask(task) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                    <i className="fas fa-trash"></i> Удалить
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="quadrant-empty">Нет задач в этом квадранте</div>
                )}
            </div>
        </div>
    );

    // Логика рендеринга на основе matrixView
    if (matrixView !== 'all') {
        // Показываем только один выбранный квадрант
        return (
            <div className="eisenhower-grid single-view">
                {renderQuadrant(matrixView)}
            </div>
        );
    }

    // Показываем все 4 квадранта
    return (
        <div className="eisenhower-grid">
            {[1, 2, 3, 4].map(qId => renderQuadrant(qId))}
        </div>
    );
};

// AddTaskModal
const AddTaskModal = ({ onClose, onSave, employees, currentUser, teams, allSkills }) => {
    
    // Логика связанных списков (Команда) 
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [teamSpecificMembers, setTeamSpecificMembers] = useState(null); // null = не выбрано, [] = выбрано, но пусто, [...] = участники
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Логика фильтра навыков (Категория/Навык)
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedSkillId, setSelectedSkillId] = useState('');


    const handleTeamChange = async (e) => {
      const teamId = e.target.value;
      setSelectedTeamId(teamId);
      // Сбрасываем фильтр навыков и участников при смене команды
      setTeamSpecificMembers(null); 
      setSelectedCategoryId('');
      setSelectedSkillId('');
      
      if (teamId) {
        setLoadingMembers(true);
        try {
          // Вызываем API, импортированное в AppLayout
          const members = await getTeamMembersApi(teamId); 
          setTeamSpecificMembers(members);
        } catch (err) {
          console.error("Failed to load team members", err);
          setTeamSpecificMembers([]); // Ошибка = пустой список
        } finally {
          setLoadingMembers(false);
        }
      }
    };

    // Обработчик смены Категории навыка
    const handleSkillCategoryChange = (e) => {
        setSelectedCategoryId(e.target.value);
        setSelectedSkillId(''); // Сбрасываем выбор навыка
    };
    
    // Навыки, доступные во второй dropdown, на основе выбранной категории
    const availableSkills = useMemo(() => {
        if (!selectedCategoryId) return [];
        return allSkills.find(c => c.category_id === parseInt(selectedCategoryId, 10))?.skills || [];
    }, [allSkills, selectedCategoryId]);


    // `filteredEmployees` теперь зависит от M2M и ДВУХ фильтров
    const filteredEmployees = useMemo(() => {
        let availableEmployees = employees; // Начинаем со всех

        // 1. Фильтруем по ВЫБРАННОЙ КОМАНДЕ (если она выбрана)
        if (teamSpecificMembers) {
            availableEmployees = employees.filter(emp => 
                teamSpecificMembers.some(member => member.id === emp.id)
            );
        }
        
        // 2. Фильтруем по ВЫБРАННОМУ НАВЫКУ
        if (!selectedSkillId) return availableEmployees; // Если фильтра навыков нет, возвращаем результат
        
        const skillIdInt = parseInt(selectedSkillId, 10);
        return availableEmployees.filter(employee => {
            if (!employee.skills || employee.skills.length === 0) return false;
            // Ищем совпадения в skill_id
            return employee.skills.some(empSkill => empSkill.skill_id === skillIdInt);
        });
    }, [employees, teamSpecificMembers, selectedSkillId]); // Зависим от команды и навыка
    
    // Команды, доступные этому пользователю
    const availableTeams = useMemo(() => {
        if (!teams) return [];
        if (currentUser.role === 'admin') return teams;
        return teams;
    }, [teams, currentUser]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const taskData = {
            title: formData.get('taskTitle'),
            description: formData.get('taskDescription'),
            deadline: formData.get('taskDeadline'),
            importance: parseInt(formData.get('taskImportance'), 10),
            complexity: parseInt(formData.get('taskComplexity'), 10),
            assigneeId: formData.get('taskAssignee') ? parseInt(formData.get('taskAssignee'), 10) : null, 
            teamId: formData.get('taskTeam') ? parseInt(formData.get('taskTeam'), 10) : null, 
            priority: 'medium'
        };
        
        if (!taskData.title || !taskData.description || !taskData.deadline) {
            alert("Пожалуйста, заполните все обязательные поля.");
            return;
        }

        await onSave(taskData);
    };

    return (
        // Меняем onClick на onMouseDown
        <div className="modal" style={{ display: 'flex' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-content">
                <div className="modal-header">
                    <div className="modal-title">Добавить новую задачу</div>
                    <div className="close-modal" onClick={onClose}>&times;</div>
                </div>
                
                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="taskTitle">Название задачи</label>
                            <input type="text" id="taskTitle" name="taskTitle" placeholder="Введите название задачи" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="taskDescription">Описание задачи</label>
                            <textarea id="taskDescription" name="taskDescription" placeholder="Введите описание задачи" rows="3" required></textarea>
                        </div>
                        
                        {/* Поле "Команда" (только для админов и менеджеров) */}
                        {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
                            <div className="form-group">
                                <label htmlFor="taskTeam">Команда</label>
                                <select 
                                    id="taskTeam" 
                                    name="taskTeam"
                                    // Добавляем value и onChange
                                    value={selectedTeamId}
                                    onChange={handleTeamChange}
                                    // Менеджер ОБЯЗАН выбрать команду
                                    required={currentUser.role === 'manager'} 
                                >
                                    <option value="">{currentUser.role === 'admin' ? 'Без команды' : 'Выберите команду'}</option>
                                    {availableTeams.map(team => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="taskDeadline">Срок выполнения</label>
                            <input type="date" id="taskDeadline" name="taskDeadline" defaultValue={new Date().toISOString().split('T')[0]} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="taskImportance">Важность (1-10)</label>
                            <input type="number" id="taskImportance" name="taskImportance" min="1" max="10" defaultValue="5" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="taskComplexity">Сложность (1-10)</label>
                            <input type="number" id="taskComplexity" name="taskComplexity" min="1" max="10" defaultValue="5" />
                        </div>
                        
                        {/* Новый M2M Фильтр по навыкам (Категория + Навык) */}
                        <label>Фильтр по навыкам (для Исполнителя)</label>
                        <div className="form-row" style={{marginBottom: '20px'}}>
                            <div className="form-group">
                                <select id="taskSkillCategory" value={selectedCategoryId} onChange={handleSkillCategoryChange}>
                                    <option value="">Выберите категорию</option>
                                    {allSkills.map(cat => (
                                        <option key={cat.category_id} value={cat.category_id}>
                                            {cat.category_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <select 
                                    id="taskSkill" 
                                    value={selectedSkillId} 
                                    onChange={(e) => setSelectedSkillId(e.target.value)}
                                    disabled={!selectedCategoryId}
                                >
                                    <option value="">Выберите навык</option>
                                    {availableSkills.map(skill => (
                                        <option key={skill.skill_id} value={skill.skill_id}>
                                            {skill.skill_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="form-group" id="assigneeGroup">
                            <label htmlFor="taskAssignee">Назначить сотруднику</label>
                            <select 
                                id="taskAssignee" 
                                name="taskAssignee" 
                                defaultValue=""
                                disabled={loadingMembers} // Блокируем во время загрузки
                            >
                                <option value="">{loadingMembers ? "Загрузка..." : "Не назначен"}</option>
                                
                                {/* Показываем "Себе" только если команда не выбрана ИЛИ (пользователь есть в этой команде) */}
                                {(!teamSpecificMembers || teamSpecificMembers.some(m => m.id.toString() === currentUser.id.toString())) && (
                                   <option value={currentUser.id}>{currentUser.name || '...'} (себе)</option> 
                                )}
                                
                                {filteredEmployees
                                    .filter(emp => emp.id.toString() !== currentUser.id.toString()) // Убираем "себя" из этого списка
                                    .map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {/* Отображаем skill_name */}
                                            {emp.name} - ({(emp.skills || []).map(s => s.skill_name).join(', ')})
                                        </option>
                                ))}
                                
                                {/* Если выбрана команда и в ней нет сотрудников */}
                                {teamSpecificMembers && filteredEmployees.length === 0 && (
                                    <option value="" disabled>В этой команде нет сотрудников</option>
                                )}

                            </select>
                        </div>
                        <button type="submit" className="login-btn" id="saveTaskBtn">Сохранить задачу</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// EmployeesModal
const EmployeesModal = ({ onClose, onShowAdd, employees, canAdd, currentUser, onDelete, canDelete }) => {
    return (
        // Меняем onClick на onMouseDown
        <div className="modal" style={{ display: 'flex' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-content" style={{ maxWidth: '800px' }}>
                <div className="modal-header">
                    <div className="modal-title">Сотрудники</div>
                    {canAdd && (
                        <button className="action-button btn-primary" style={{ marginLeft: 'auto', marginRight: '20px' }} onClick={onShowAdd}>
                            <i className="fas fa-plus"></i> Добавить
                        </button>
                    )}
                    <div className="close-modal" onClick={onClose}>&times;</div>
                </div>
                
                <div className="modal-body">
                    <div className="employees-content">
                        <div className="employees-grid">
                            {employees.map(employee => (
                                <div className="employee-card" key={employee.id}>
                                    <div className="employee-avatar">{employee.name.split(' ').map(n => n[0]).join('')}</div>
                                    <div className="employee-info">
                                        <div className="employee-name">{employee.name}</div>
                                        <div className="employee-position">{employee.position}</div>
                                        <div className="employee-skills">
                                            {/* Отображаем M2M навыки */}
                                            {(employee.skills || []).map(skill => (
                                                <span key={skill.skill_id} className="skill-tag" title={skill.category_name}>
                                                    {skill.skill_name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Кнопка удаления */}
                                    {canDelete && employee.id !== currentUser.id && employee.login !== 'admin' && (
                                        <button 
                                            className="btn btn-danger btn-sm"
                                            onClick={() => onDelete(employee.id, employee.name)}
                                            title="Удалить сотрудника"
                                            style={{alignSelf: 'flex-start', padding: '5px 8px'}}
                                        >
                                            <i className="fas fa-trash" style={{margin: 0, gap: 0}}></i>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// AddEmployeeModal
const AddEmployeeModal = ({ onClose, onSave, allSkills }) => {
    const [error, setError] = useState(null);
    // Состояние для хранения ВЫБРАННЫХ ID навыков
    const [selectedSkills, setSelectedSkills] = useState(new Set());

    // UI для выбора навыков
    const [currentCategoryId, setCurrentCategoryId] = useState('');
    const [currentSkillId, setCurrentSkillId] = useState('');

    // Навыки, доступные во второй dropdown, на основе выбранной категории
    const availableSkills = useMemo(() => {
        if (!currentCategoryId) return [];
        return allSkills.find(c => c.category_id === parseInt(currentCategoryId, 10))?.skills || [];
    }, [allSkills, currentCategoryId]);
    
    // Навыки, которые уже выбраны (для отображения в списке)
    const selectedSkillsDetails = useMemo(() => {
        const details = [];
        const allSkillsFlat = allSkills.flatMap(c => 
            c.skills.map(s => ({...s, category_name: c.category_name}))
        );
        selectedSkills.forEach(id => {
            const skill = allSkillsFlat.find(s => s.skill_id === id);
            if (skill) details.push(skill);
        });
        return details;
    }, [selectedSkills, allSkills]);
    
    // Добавляем навык в Set
    const handleAddSkill = () => {
        if (currentSkillId) {
            setSelectedSkills(prev => new Set(prev).add(parseInt(currentSkillId, 10)));
            // Сбрасываем выбор
            setCurrentCategoryId('');
            setCurrentSkillId('');
        }
    };
    
    // Удаляем навык из Set
    const handleRemoveSkill = (skillId) => {
        setSelectedSkills(prevSelected => {
            const newSelected = new Set(prevSelected);
            newSelected.delete(skillId);
            return newSelected;
        });
    };
    // Конец UI


    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        const formData = new FormData(e.target);
        
        const password = formData.get('employeePassword');
        if (password.length < 8) {
            setError('Пароль должен быть не менее 8 символов.');
            return;
        }

        const employeeData = {
            name: formData.get('employeeName'),
            login: formData.get('employeeLogin'),
            password: password,
            position: formData.get('employeePosition'),
            role: formData.get('employeeRole'),
            //Отправляем массив ID
            skill_ids: Array.from(selectedSkills) 
        };

        if (!employeeData.name || !employeeData.login || !employeeData.position) {
            setError('Пожалуйста, заполните все поля со звездочкой.');
            return;
        }

        try {
            await onSave(employeeData);
        } catch (err) {
            setError(err.error === 'Пользователь с таким логином уже существует' ? 'Логин уже занят.' : 'Ошибка сервера.');
        }
    };

    return (
        // Меняем onClick на onMouseDown
        <div className="modal" style={{ display: 'flex' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-content">
                <div className="modal-header">
                    <div className="modal-title">Добавить нового сотрудника</div>
                    <div className="close-modal" onClick={onClose}>&times;</div>
                </div>
                
                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="employeeName">Полное имя</label>
                            <input type="text" id="employeeName" name="employeeName" placeholder="Например, Алексей П." required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="employeeLogin">Логин</label>
                            <input type="text" id="employeeLogin" name="employeeLogin" placeholder="Например, alex" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="employeePassword">Пароль</label>
                            {/* Добавлен autoComplete */}
                            <input 
                                type="password" 
                                id="employeePassword" 
                                name="employeePassword" 
                                placeholder="Минимум 8 символов" 
                                required 
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="employeePosition">Должность</label>
                            <input type="text" id="employeePosition" name="employeePosition" placeholder="Например, Senior разработчик" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="employeeRole">Роль в системе</label>
                            <select id="employeeRole" name="employeeRole" defaultValue="user">
                                <option value="user">User (Сотрудник)</option>
                                <option value="manager">Manager (Менеджер)</option>
                                <option value="admin">Admin (Администратор)</option>
                            </select>
                        </div>
                        
                        {/* UI выбора навыков */}
                        <div className="form-group">
                            <label>Навыки</label>
                            <div className="form-row">
                                <div className="form-group">
                                    <select value={currentCategoryId} onChange={(e) => { setCurrentCategoryId(e.target.value); setCurrentSkillId(''); }}>
                                        <option value="">1. Выберите категорию</option>
                                        {allSkills.map(cat => (
                                            <option key={cat.category_id} value={cat.category_id}>
                                                {cat.category_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <select 
                                        value={currentSkillId} 
                                        onChange={(e) => setCurrentSkillId(e.target.value)}
                                        disabled={!currentCategoryId}
                                    >
                                        <option value="">2. Выберите навык</option>
                                        {availableSkills.map(skill => (
                                            <option key={skill.skill_id} value={skill.skill_id}>
                                                {skill.skill_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                disabled={!currentSkillId}
                                onClick={handleAddSkill}
                                style={{width: '100%', marginTop: '10px'}}
                            >
                                <i className="fas fa-plus"></i> Добавить навык
                            </button>
                        </div>

                        {/* Список выбранных навыков */}
                        {selectedSkillsDetails.length > 0 && (
                            <div className="form-group">
                                <label>Выбранные навыки:</label>
                                <div className="selected-skills-list">
                                    {selectedSkillsDetails.map(skill => (
                                        <div key={skill.skill_id} className="selected-skill-item">
                                            {/* Отображаем category_name из объекта */}
                                            <span>{skill.skill_name} <small>({skill.category_name})</small></span>
                                            <button 
                                                type="button" 
                                                className="remove-skill-btn"
                                                onClick={() => handleRemoveSkill(skill.skill_id)}
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <button type="submit" className="login-btn" id="saveEmployeeBtn">Сохранить сотрудника</button>
                        {error && (
                            <div className="login-error" id="employeeError" style={{ display: 'block' }}>
                                {error}
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};

// Компонент модального окна профиля
const UserProfileModal = ({ onClose, user, details }) => {
    return (
        // Меняем onClick на onMouseDown
        <div className="modal" style={{ display: 'flex' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-content" style={{ maxWidth: '450px' }}>
                <div className="modal-header">
                    <div className="modal-title">Профиль пользователя</div>
                    <div className="close-modal" onClick={onClose}>&times;</div>
                </div>
                <div className="modal-body profile-modal-body">
                    <div className="profile-avatar">
                        {user.avatar || '..'}
                    </div>
                    <div className="profile-info">
                        <div className="profile-name">{user.name}</div>
                        <div className="profile-login">@{details.login}</div>
                    </div>
                    
                    <div className="profile-details">
                        <div className="profile-detail-item">
                            <span className="label">Роль в системе</span>
                            <span className="value">{user.role}</span>
                        </div>
                        <div className="profile-detail-item">
                            <span className="label">Должность</span>
                            <span className="value">{details.position || 'Не указана'}</span>
                        </div>
                        <div className="profile-detail-item">
                            <span className="label">Навыки</span>
                            <div className="value skills-list">
                                {/* Отображаем M2M навыки */}
                                {(details.skills && details.skills.length > 0) ? (
                                    details.skills.map(skill => (
                                        <span key={skill.skill_id} className="skill-tag" title={skill.category_name}>
                                            {skill.skill_name}
                                        </span>
                                    ))
                                ) : (
                                    'Навыки не указаны'
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


// Компонент Аналитики (с графиками)
const AnalyticsDashboard = ({ tasks, employees }) => {
    
    // Состояние для выбора графика
    const [activeChart, setActiveChart] = useState('status'); // status, quadrants, complexity, load
    
    // 1. Статистика по статусам (Обновлено)
    const statusStats = useMemo(() => {
        const stats = { new: 0, in_progress: 0, done: 0, canceled: 0 };
        tasks.forEach(task => {
            if (stats[task.status] !== undefined) {
                stats[task.status]++;
            }
        });
        return stats;
    }, [tasks]);
    
    // 2. Статистика по квадрантам
    const quadrantStats = useMemo(() => {
        const stats = {1: 0, 2: 0, 3: 0, 4: 0};
        tasks.forEach(task => {
            const q = calculateQuadrant(task.importance, task.deadline);
            if (stats[q] !== undefined) stats[q]++;
        });
        return stats;
    }, [tasks]);
    
    // 3. Статистика по сложности
    const complexityStats = useMemo(() => {
        const stats = {low: 0, medium: 0, high: 0};
        tasks.forEach(task => {
            if (task.complexity >= 7) stats.high++;
            else if (task.complexity >= 4) stats.medium++;
            else stats.low++;
        });
        return stats;
    }, [tasks]);

    // 4. Загрузка по сотрудникам (активные задачи)
    const employeeLoadStats = useMemo(() => {
        const stats = {};
        const activeTasks = tasks.filter(task => !task.completed && task.assignee_name);
        
        activeTasks.forEach(task => {
            stats[task.assignee_name] = (stats[task.assignee_name] || 0) + 1;
        });
        
        // Сортируем для красоты
        return Object.entries(stats).sort(([, a], [, b]) => b - a);
        
    }, [tasks]);


    // Данные для графиков
    const statusData = {
        labels: ['Новые', 'В работе', 'Выполнено', 'Отменено'],
        datasets: [{
            data: [statusStats.new, statusStats.in_progress, statusStats.done, statusStats.canceled],
            backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#64748b'],
            hoverOffset: 4
        }]
    };

    const quadrantData = {
        labels: ['1. Срочно/Важно', '2. Не срочно/Важно', '3. Срочно/Не важно', '4. Не срочно/Не важно'],
        datasets: [{
            data: [quadrantStats[1], quadrantStats[2], quadrantStats[3], quadrantStats[4]],
            backgroundColor: ['#ef4444', '#10b981', '#f59e0b', '#84cc16'], // Изменены цвета для Q2
            hoverOffset: 4
        }]
    };

    const complexityData = {
        labels: ['Низкая (1-3)', 'Средняя (4-6)', 'Высокая (7-10)'],
        datasets: [{
            label: 'Количество задач',
            data: [complexityStats.low, complexityStats.medium, complexityStats.high],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        }]
    };
    
    const employeeLoadData = {
        labels: employeeLoadStats.map(([name]) => name),
        datasets: [{
            label: 'Активные задачи',
            data: employeeLoadStats.map(([, count]) => count),
            backgroundColor: '#3b82f6',
        }]
    };
    
    const barOptions = {
         plugins: { legend: { display: false } },
         scales: { 
             y: { beginAtZero: true, ticks: { stepSize: 1 } },
             x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 } }
         },
         maintainAspectRatio: false
    };
    
    // Легенда перенесена вниз
    const doughnutOptions = {
         plugins: { legend: { position: 'bottom' } },
         maintainAspectRatio: false
    };
    
    // Легенда перенесена вниз
    const pieOptions = {
         plugins: { legend: { position: 'bottom' } },
         maintainAspectRatio: false
    };

    // Общая статистика (карточки)
    const pendingTasks = statusStats.new + statusStats.in_progress;
    const doneTasks = statusStats.done;

    return (
         <div className="analytics-container">
            {/* Карточки статистики */}
            <div className="stats-cards">
                <div className="stat-card">
                    <div className="stat-value">{tasks.length}</div>
                    <div className="stat-label">Всего задач</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{pendingTasks}</div>
                    <div className="stat-label">В работе</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{doneTasks}</div>
                    <div className="stat-label">Выполнено</div>
                </div>
            </div>
            
            {/* Табы для выбора диаграммы */}
            <div className="chart-tabs">
                <button 
                    className={`tab-button ${activeChart === 'status' ? 'active' : ''}`}
                    onClick={() => setActiveChart('status')}>
                    <i className="fas fa-tasks"></i> По статусам
                </button>
                <button 
                    className={`tab-button ${activeChart === 'quadrants' ? 'active' : ''}`}
                    onClick={() => setActiveChart('quadrants')}>
                    <i className="fas fa-th-large"></i> По квадрантам
                </button>
                <button 
                    className={`tab-button ${activeChart === 'complexity' ? 'active' : ''}`}
                    onClick={() => setActiveChart('complexity')}>
                    <i className="fas fa-signal"></i> По сложности
                </button>
                <button 
                    className={`tab-button ${activeChart === 'load' ? 'active' : ''}`}
                    onClick={() => setActiveChart('load')}>
                    <i className="fas fa-users"></i> Загрузка
                </button>
            </div>

            {/* Контейнер для одной диаграммы */}
            <div className="charts-list">
                {activeChart === 'status' && (
                    /* Увеличена высота для графика */
                    <div className="chart-container" style={{ height: '450px' }}> 
                        <h3>Распределение задач по статусам</h3>
                        <Doughnut data={statusData} options={doughnutOptions} />
                    </div>
                )}
                {activeChart === 'quadrants' && (
                     /* Увеличена высота для графика */
                     <div className="chart-container" style={{ height: '450px' }}> 
                        <h3>Распределение по квадрантам (Активные задачи)</h3>
                        <Pie data={quadrantData} options={pieOptions} />
                    </div>
                )}
                 {activeChart === 'complexity' && (
                     <div className="chart-container" style={{ height: '400px' }}>
                        <h3>Распределение по сложности</h3>
                        <Bar data={complexityData} options={barOptions} />
                    </div>
                )}
                {activeChart === 'load' && (
                     <div className="chart-container" style={{ height: '500px' }}>
                        <h3>Загрузка сотрудников (Активные задачи)</h3>
                        <Bar data={employeeLoadData} options={barOptions} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AppLayout;
