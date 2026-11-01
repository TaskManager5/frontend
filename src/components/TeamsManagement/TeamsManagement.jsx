import React, { useState, useEffect } from 'react';
import { 
  getTeamsApi, 
  createTeamApi, 
  getTeamMembersApi, 
  addTeamMemberApi,
  removeTeamMemberApi,
  requestJoinTeamApi,
  getTeamJoinRequestsApi,
  approveTeamJoinRequestApi,
  rejectTeamJoinRequestApi,
  updateTeamVisibilityApi,
  deleteTeamApi,
  deleteTeamExperimental
} from '../../api/api';
import CreateTeamModal from './CreateTeamModal';
import TeamMembersModal from './TeamMembersModal';

// Получаем tasks и employees из AppLayout
const TeamsManagement = ({ currentUser, tasks, workers, activeProjectId }) => {
  const [teams, setTeams] = useState([]);
  // const [employees, setEmployees] = useState([]); 
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isMembersModalOpen, setMembersModalOpen] = useState(false);
  const [joinRequestsTeam, setJoinRequestsTeam] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tasks && workers) {
      loadTeams();
    }
  }, [tasks, workers, activeProjectId]);

  const loadTeams = async () => {
  try {
    setLoading(true);
    const params = activeProjectId ? { projectId: activeProjectId } : {};
    const data = await getTeamsApi(params);
    
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
              const employee = workers.find(w => w.id === userId);
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

          // Определяем, является ли текущий user manager'ом этой команды
          const myWorker = workers.find(w => w.user_id && String(w.user_id) === String(currentUser.id));
          const isMyTeam = members.some(m => 
            String(m.id) === String(myWorker?.id) && 
            (m.roleinteam === 'manager' || m.roleInTeam === 'manager')
          );

          return {
            ...team,
            memberCount: members.length,
            managers: managerNames,
            formattedDate: formattedDate,
            activeTaskCount: activeTaskCount,
            isMyTeam: isMyTeam
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

  const handleRequestJoinTeam = async (team) => {
    try {
      await requestJoinTeamApi(team.id);
      alert('Заявка отправлена. Менеджер команды её рассмотрит.');
      await loadTeams();
    } catch (err) {
      if (err.error === 'not_public') alert('Команда не публичная');
      else if (err.error === 'already_member') alert('Вы уже участник');
      else alert('Ошибка подачи заявки');
    }
  };

  const handleToggleVisibility = async (team) => {
    const newVisibility = team.visibility === 'public' ? 'private' : 'public';
    try {
      await updateTeamVisibilityApi(team.id, newVisibility);
      await loadTeams();
    } catch (err) {
      alert(err.error || 'Ошибка изменения видимости');
    }
  };

  const handleCreateTeam = async (teamName) => {
    try {
      await createTeamApi({ name: teamName, projectId: activeProjectId || undefined });
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
        {['admin', 'manager'].includes(currentUser.role) && (
          <button 
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
              {['admin', 'manager'].includes(currentUser.role) && (
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
                  {/* Подать заявку — если не участник и команда публичная */}
                  {!team.my_role && team.visibility === 'public' && !team.has_pending_request && (
                    <button 
                      className="btn btn-primary btn-small"
                      onClick={() => handleRequestJoinTeam(team)}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      <i className="fas fa-paper-plane"></i> Подать заявку
                    </button>
                  )}
                  {!team.my_role && team.visibility === 'public' && team.has_pending_request && (
                    <span style={{ padding: '6px 12px', fontSize: '12px', color: '#888', background: '#f5f5f5', borderRadius: 6 }}>
                      Заявка отправлена
                    </span>
                  )}

                  {/* Сменить visibility — manager/admin */}
                  {(currentUser.role === 'admin' || team.isMyTeam) && (
                    <button 
                      className="btn btn-secondary btn-small"
                      onClick={() => handleToggleVisibility(team)}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      title="Сменить видимость команды"
                    >
                      <i className={`fas fa-${team.visibility === 'public' ? 'lock' : 'globe'}`}></i>
                      {team.visibility === 'public' ? 'Приватная' : 'Публичная'}
                    </button>
                  )}

                  {/* Заявки — manager/admin */}
                  {(currentUser.role === 'admin' || team.isMyTeam) && (
                    <button 
                      className="btn btn-secondary btn-small"
                      onClick={() => setJoinRequestsTeam(team)}
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: '12px',
                        background: Number(team.pending_requests_count) > 0 ? '#fef3c7' : undefined,
                        borderColor: Number(team.pending_requests_count) > 0 ? '#f59e0b' : undefined,
                        fontWeight: Number(team.pending_requests_count) > 0 ? 600 : undefined,
                      }}
                    >
                      <i className="fas fa-inbox"></i> Заявки
                      {Number(team.pending_requests_count) > 0 && (
                        <span style={{ 
                          background: '#f59e0b', color: 'white', borderRadius: 10,
                          padding: '1px 7px', marginLeft: 6, fontSize: 11, fontWeight: 700,
                        }}>
                          {team.pending_requests_count}
                        </span>
                      )}
                    </button>
                  )}

                  {(currentUser.role === 'admin' || team.isMyTeam) && (
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

      {joinRequestsTeam && (
        <TeamJoinRequestsModal
          team={joinRequestsTeam}
          onClose={() => setJoinRequestsTeam(null)}
          onRefresh={loadTeams}
        />
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
          workers={workers} // Передаем employees из props
          onClose={() => setMembersModalOpen(false)}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

// ==================== Модалка заявок в команду ====================
const TeamJoinRequestsModal = ({ team, onClose, onRefresh }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await getTeamJoinRequestsApi(team.id);
      setRequests(data);
    } catch (err) {
      setError(err.error || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [team.id]);

  const handleApprove = async (reqId, name) => {
    if (!window.confirm(`Одобрить вступление "${name}" в команду?`)) return;
    try {
      await approveTeamJoinRequestApi(team.id, reqId);
      await load();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.error || 'Ошибка одобрения');
    }
  };

  const handleReject = async (reqId, name) => {
    if (!window.confirm(`Отклонить заявку "${name}"?`)) return;
    try {
      await rejectTeamJoinRequestApi(team.id, reqId);
      await load();
    } catch (err) {
      alert(err.error || 'Ошибка отклонения');
    }
  };

  return (
    <div className="modal" style={{ display: 'flex' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div className="modal-title">Заявки в команду: {team.name}</div>
          <div className="close-modal" onClick={onClose}>&times;</div>
        </div>
        <div className="modal-body">
          {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Ожидают рассмотрения ({requests.length}):
          </div>
          {loading ? (
            <div>Загрузка...</div>
          ) : requests.length === 0 ? (
            <div style={{ color: '#888', padding: 20, textAlign: 'center' }}>
              Нет активных заявок
            </div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {requests.map(r => (
                <div key={r.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: 12, borderBottom: '1px solid #eee'
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.name}{!r.login ? ' (без учётки)' : ''}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {r.position || '—'} · заявка от {new Date(r.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="login-btn"
                      style={{ padding: '6px 12px', fontSize: 12, width: 'auto' }}
                      onClick={() => handleApprove(r.id, r.name)}
                    >
                      Одобрить
                    </button>
                    <button
                      className="delete-btn"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => handleReject(r.id, r.name)}
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamsManagement;
