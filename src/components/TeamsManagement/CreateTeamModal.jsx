import React, { useState } from 'react';

const CreateTeamModal = ({ onClose, onSave }) => {
  const [teamName, setTeamName] = useState('');
  // Состояние для ошибки валидации
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Проверка на пустое поле
    if (!teamName.trim()) {
      setError('Это обязательное поле. Необходимо заполнить');
      return;
    }

    onSave(teamName.trim());
  };

  return (
    <div className="modal" style={{ display: 'flex' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        
        <div className="modal-header">
          <div className="modal-title">Создать новую команду</div>
          <div className="close-modal" onClick={onClose}>&times;</div>
        </div>

        <div className="modal-body">
          {/* Добавлен noValidate, чтобы отключить стандартные подсказки браузера */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="teamName">Название команды</label>
              <input
                type="text"
                id="teamName"
                value={teamName}
                onChange={(e) => {
                    setTeamName(e.target.value);
                    // Сбрасываем ошибку при вводе
                    setError('');
                }}
                placeholder="Введите название команды"
                // Добавляем класс ошибки для красной рамки
                className={error ? 'input-error' : ''}
                required
              />
              {/* Вывод текста ошибки */}
              {error && <span className="validation-error-text">{error}</span>}
            </div>
            
            <button type="submit" className="login-btn">Создать команду</button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default CreateTeamModal;
