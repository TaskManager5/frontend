import React, { useState, useEffect } from 'react';
import { 
  getTeamsApi, 
  createTeamApi, 
  getTeamMembersApi, 
  addTeamMemberApi,
  removeTeamMemberApi,
  deleteTeamApi,
  deleteTeamExperimental
} from '../../api/api';
import CreateTeamModal from './CreateTeamModal';
import TeamMembersModal from './TeamMembersModal';

// Получаем tasks и employees из AppLayout
const TeamsManagement = ({ currentUser, tasks, employees }) => {
  const [teams, setTeams] = useState([]);
  // const [employees, setEmployees] = useState([]); 
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isMembersModalOpen, setMembersModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // loadEmployees(); 
    // Запускаем loadTeams, когда tasks или employees (из props) изменятся
    if (tasks && employees) {
      loadTeams();
    }
  }, [tasks, employees]); // Добавляем зависимости

  const loadTeams = async () => {
  try {
    setLoading(true);
    const data = await getTeamsApi();
    
    const teamsWithData = await Promise.all(
      data.map(async (team) => {
        try {
          const members = await getTeamMembersApi(team.id);
          const managers = members.filter(m => 
            m.roleinteam === 'manager' || m.roleInTeam === 'manager'
          );
          
          // Получаем имена менеджеров, используя employees из props
          const managerNames = managers.map(manager => {
              const userId = manager.id || manager.user_id;
              // Ищем в props
              const employee = employees.find(emp => emp.id === userId);
              return employee ? employee.name : 'Неизвестный';
          });

          // Считаем активные задачи из props
          const activeTaskCount = tasks.filter(
            task => task.team_id === team.id && !task.completed
          ).length;

          // Форматируем дату
          let formattedDate = 'Недавно';
          if (team.created_at) {
            try {
              const date = new Date(team.created_at);
              if (!isNaN(date.getTime())) {
                formattedDate = date.toLocaleDateString('ru-RU');
                // console.log(`Реальная дата для команды ${team.id}:`, formattedDate);
              }
            } catch (e) {
              console.error('Ошибка форматирования даты:', e);
            }
          }

          return {
            ...team,
            memberCount: members.length,
            managers: managerNames,
            formattedDate: formattedDate,
            activeTaskCount: activeTaskCount // Добавляем счетчик задач
          };
        } catch (err) {
          console.error(`Ошибка загрузки участников для команды ${team.id}:`, err);
          return { 
            ...team, 
            memberCount: 0, 
            managers: [],
            formattedDate: 'Недавно',
            activeTaskCount: 0 // Добавляем счетчик задач
          };
        }
      })
    );
    
    setTeams(teamsWithData);
  } catch (err) {
    console.error('Ошибка загрузки команд:', err);
  } finally {
    setLoading(false);
  }
};

  const loadTeamMembers = async (teamId) => {
    try {
      const data = await getTeamMembersApi(teamId);
      console.log('СТРУКТУРА УЧАСТНИКОВ команды', teamId, ':', data);
      setTeamMembers(data);
    } catch (err) {
      console.error('Ошибка загрузки участников:', err);
    }
  };

  const handleCreateTeam = async (teamName) => {
    try {
      await createTeamApi({ name: teamName });
      await loadTeams();
      setCreateModalOpen(false);
    } catch (err) {
      console.error('Ошибка создания команды:', err);
      alert('Ошибка при создании команды');
    }
  };

  const handleAddMember = async (teamId, userId, role) => {
    try {
      console.log('Добавление участника...', { teamId, userId, role });
      await addTeamMemberApi(teamId, userId, role);
      await loadTeamMembers(teamId);
      await loadTeams();
      console.log('Участник успешно добавлен!');
    } catch (err) {
      console.error('Ошибка добавления участника:', err);
      alert('Не удалось добавить участника');
    }
  };

  const handleRemoveMember = async (teamId, userId) => {
    try {
      console.log('Удаление участника...', { teamId, userId });
      await removeTeamMemberApi(teamId, userId);
      await loadTeamMembers(teamId);
      await loadTeams();
      console.log('Участник успешно удален!');
    } catch (err) {
      console.error('Ошибка удаления участника:', err);
      alert('Не удалось удалить участника');
    }
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    let teamMembers = [];
    try {
      teamMembers = await getTeamMembersApi(teamId);
      console.log(`Участники команды "${teamName}":`, teamMembers);
    } catch (err) {
      console.error('Ошибка загрузки участников:', err);
    }
  
    const hasMembers = teamMembers.length > 0;
    const membersInfo = hasMembers ? 
      `\n\nВ команде ${teamMembers.length} участников, которые также будут удалены.` : 
      '';
    
    const message = `Вы уверены, что хотите полностью удалить команду "${teamName}"?${membersInfo}\n\nЭто действие нельзя отменить.`;
    
    if (window.confirm(message)) {
      try {
        setLoading(true);
        console.log(`Удаляем команду "${teamName}"...`);
        
        await deleteTeamApi(teamId);
        
        // Обновляем список команд
        await loadTeams();
        console.log('Команда успешно удалена!');
        alert(`Команда "${teamName}" успешно удалена!`);
        
      } catch (error) {
        console.error('Ошибка удаления команды:', error);
        
        if (error.error && error.error.includes('связанные задачи')) {
          alert(`Не удалось удалить команду "${teamName}".\n\nПричина: ${error.error}`);
        } else {
          alert(`Не удалось удалить команду "${teamName}".\n\nОшибка: ${error.error || 'Неизвестная ошибка'}`);
        }
      } finally {
        setLoading(false);
      }
    }
  };
  
  const openMembersModal = async (team) => {
    setSelectedTeam(team);
    await loadTeamMembers(team.id);
    setMembersModalOpen(true);
  };

  return (
    <div className="teams-management">
      <div className="top-bar">
        <div className="page-title">Управление командами</div>
        {currentUser.role === 'admin' && (
          <button 
            // Используем классы .action-button .btn-primary для починки
            className="action-button btn-primary"
            onClick={() => setCreateModalOpen(true)}
          >
            <i className="fas fa-plus"></i> Создать команду
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">
          <i className="fas fa-spinner fa-spin"></i> Загрузка команд...
        </div>
      ) : (
        <div className="teams-grid">
          {teams.length === 0 ? (
            <div className="no-teams">
              <div className="no-teams-icon">
                <i className="fas fa-users fa-3x"></i>
              </div>
              <p>Команды еще не созданы</p>
              {currentUser.role === 'admin' && (
                <button 
                  className="action-button btn-primary"
                  onClick={() => setCreateModalOpen(true)}
                >
                  <i className="fas fa-plus"></i> Создать первую команду
                </button>
              )}
            </div>
          ) : (
            teams.map(team => (
              <div key={team.id} className="team-card">
                <div className="team-header">
                  <h3>{team.name}</h3>
                  <button 
                    className="btn btn-outline"
                    onClick={() => openMembersModal(team)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      fontSize: '14px'
                    }}
                  >
                    <i className="fas fa-users"></i> 
                    Участники ({team.memberCount || 0})
                  </button>
                </div>
                
                <div className="team-info">
                  <div className="team-stats">
                    <span className="team-id">ID: {team.id}</span>
                    <span className="team-created">
                      Создана: {team.formattedDate}
                    </span>
                  </div>

                  {/* Добавляем счетчик задач */}
                  <div className="team-tasks-count">
                    <i className="fas fa-tasks"></i> 
                    Активных задач: {team.activeTaskCount || 0}
                  </div>
                  
                  {team.managers && team.managers.length > 0 && (
                    <div className="team-managers">
                      <small>
                        <i className="fas fa-crown"></i> Менеджеры: {team.managers.join(', ')}
                      </small>
                    </div>
                  )}
                </div>
                
                <div className="team-actions">
                  {currentUser.role === 'admin' && (
                    <button 
                      className="btn btn-danger btn-small"
                      onClick={() => handleDeleteTeam(team.id, team.name)}
                      title="Полностью удалить команду"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        fontSize: '12px'
                      }}
                    >
                      <i className="fas fa-trash"></i> 
                      Удалить команду
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isCreateModalOpen && (
        <CreateTeamModal
          onClose={() => setCreateModalOpen(false)}
          onSave={handleCreateTeam}
        />
      )}

      {isMembersModalOpen && selectedTeam && (
        <TeamMembersModal
          team={selectedTeam}
          members={teamMembers}
          employees={employees} // Передаем employees из props
          onClose={() => setMembersModalOpen(false)}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default TeamsManagement;
