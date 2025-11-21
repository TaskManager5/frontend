import React, { useState } from 'react';

const TeamMembersModal = ({ team, members, employees, onClose, onAddMember, onRemoveMember, currentUser }) => {
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');

  const availableEmployees = employees.filter(emp => 
    !members.some(member => member.id === emp.id) // member.id 
  );

  const canManageTeam = currentUser.role === 'admin' || 
    members.some(m => m.id === currentUser.id && m.roleinteam === 'manager'); // roleinteam

  const handleAddMember = () => {
    if (newMemberId && canManageTeam) {
      onAddMember(team.id, parseInt(newMemberId), newMemberRole);
      setNewMemberId('');
      setNewMemberRole('member');
    }
  };

  // функции для работы с данными
  const getUserId = (member) => {
    return member.id; // используем id
  };

  const getUserRole = (member) => {
    return member.roleinteam || member.role_in_team; // roleinteam
  };

  const getDisplayName = (member) => {
    const userId = getUserId(member);
    const employee = employees.find(emp => emp.id === userId);
    
    if (employee) {
      // Используем актуальное имя из 'employees'
      return employee.name || `Сотрудник ${userId}`;
    }
    
    // Fallback, если вдруг сотрудника нет в общем списке
    if (member.login) {
      return member.login;
    }
    
    return `Участник #${userId}`;
  };

  const getDisplayPosition = (member) => {
    const userId = getUserId(member);
    const employee = employees.find(emp => emp.id === userId);
    
    if (!employee) return '';
    
    return employee.position || '';
  };

  // Функция для проверки можно ли удалить участника
  const canRemoveMember = (member) => {
    const userId = getUserId(member);
    const userRole = getUserRole(member);
    
    // Админ не может удалить себя из команды
    if (userId === currentUser.id) return false;
    
    // Нельзя удалить администратора (login === 'admin')
    const employee = employees.find(emp => emp.id === userId);
    if (employee && employee.login === 'admin') return false;
    
    return canManageTeam;
  };

  return (
    // Меняем onClick на onMouseDown
    <div className="modal" style={{ display: 'flex' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <h2 className="modal-title">Участники команды: {team.name}</h2>
          <button className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Добавление нового участника */}
          {canManageTeam && (
            <div className="add-member-section">
              <h3>Добавить участника</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Сотрудник</label>
                  <select 
                    value={newMemberId} 
                    onChange={(e) => setNewMemberId(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Выберите сотрудника</option>
                    {availableEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name || emp.login} - {emp.position || 'Без должности'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Роль</label>
                  <select 
                    value={newMemberRole} 
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="form-select"
                  >
                    <option value="member">Участник</option>
                    <option value="manager">Менеджер</option>
                  </select>
                </div>
                <div className="form-group">
                  <button 
                    className="btn btn-primary" 
                    onClick={handleAddMember}
                    disabled={!newMemberId}
                    style={{ marginTop: '25px' }}
                  >
                    <i className="fas fa-plus"></i> Добавить
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Список участников */}
          <div className="members-section">
            <h3>Текущие участники:</h3>
            {members.length > 0 ? (
              <div className="members-list">
                {members.map((member, index) => {
                  const userId = getUserId(member);
                  const userRole = getUserRole(member);
                  const canRemove = canRemoveMember(member);
                  const isAdmin = employees.find(emp => emp.id === userId)?.login === 'admin';
                  
                  return (
                    <div key={`${userId}-${index}`} className="member-item">
                      <div className="member-info">
                        <div className="member-details">
                          <strong>{getDisplayName(member)}</strong>
                          <span className="member-position">{getDisplayPosition(member)}</span>
                          {isAdmin && <span className="admin-badge">Администратор</span>}
                        </div>
                        <span className={`role-badge ${userRole}`}>
                          {userRole === 'manager' ? 'Менеджер' : 'Участник'}
                        </span>
                      </div>
                      <div className="member-actions">
                        {canRemove ? (
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              console.log('Удаление участника:', { teamId: team.id, userId });
                              onRemoveMember(team.id, userId);
                            }}
                            title="Удалить из команды"
                          >
                            <i className="fas fa-trash"></i> Удалить
                          </button>
                        ) : userId === currentUser.id ? (
                          <span className="current-user-label">Вы</span>
                        ) : isAdmin ? (
                          <span className="protected-label">Защищен</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-members">
                <p>В команде пока нет участников</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamMembersModal;
