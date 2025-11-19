import React, { useState } from 'react';

const CreateTeamModal = ({ onClose, onSave }) => {
  const [teamName, setTeamName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (teamName.trim()) {
      onSave(teamName.trim());
    }
  };

  return (
    // ИСПРАВЛЕНИЕ: Меняем onClick на onMouseDown
    <div className="modal" style={{ display: 'flex' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        
        <div className="modal-header">
          <div className="modal-title">Создать новую команду</div>
          <div className="close-modal" onClick={onClose}>&times;</div>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="teamName">Название команды</label>
              <input
                type="text"
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Введите название команды"
                required
              />
            </div>
            
            <button type="submit" className="login-btn">Создать команду</button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default CreateTeamModal;