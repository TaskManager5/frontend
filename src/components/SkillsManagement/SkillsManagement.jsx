import React, { useState } from 'react';
import { 
  createSkillCategoryApi, 
  createSkillApi, 
  deleteSkillApi, 
  deleteSkillCategoryApi 
} from '../../api/api'; 

const SkillsManagement = ({ allSkills, onUpdate }) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [error, setError] = useState(null);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setError(null);
    if (!newCategoryName.trim()) return;
    try {
      await createSkillCategoryApi(newCategoryName.trim());
      setNewCategoryName('');
      onUpdate(); // Обновляем данные в AppLayout
    } catch (err) {
      setError(err.error || 'Ошибка сервера');
    }
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    setError(null);
    if (!newSkillName.trim() || !selectedCategoryId) {
        setError('Выберите категорию и введите имя навыка.');
        return;
    }
    try {
      await createSkillApi(newSkillName.trim(), selectedCategoryId);
      setNewSkillName('');
      setSelectedCategoryId('');
      onUpdate(); // Обновляем данные в AppLayout
    } catch (err) {
      setError(err.error || 'Ошибка сервера');
    }
  };

  const handleDeleteSkill = async (skillId, skillName) => {
    if (window.confirm(`Вы уверены, что хотите удалить навык "${skillName}"? Он будет удален у всех сотрудников.`)) {
      try {
        await deleteSkillApi(skillId);
        onUpdate();
      } catch (err) {
        setError(err.error || 'Ошибка сервера');
      }
    }
  };

  const handleDeleteCategory = async (catId, catName) => {
    if (window.confirm(`Вы уверены, что хотите удалить категорию "${catName}"?\n\nВНИМАНИЕ: Все навыки в этой категории будут удалены!`)) {
      try {
        await deleteSkillCategoryApi(catId);
        onUpdate();
      } catch (err) {
        setError(err.error || 'Ошибка сервера');
      }
    }
  };

  return (
    <div className="skills-management">
      {/* <div className="top-bar">
          <div className="page-title">Управление навыками</div>
        </div>
      */}
      {error && (
          <div className="login-error" style={{ display: 'block', maxWidth: '800px', margin: '0 auto 20px auto', textAlign: 'center' }}>
            {error}
          </div>
        )}

      {/* Формы добавления */}
      <div className="skills-forms-grid">
        {/* Форма 1: Добавить Категорию */}
        <form className="skill-form-card" onSubmit={handleAddCategory}>
          <h3>Добавить Категорию</h3>
          <p>Создает новый раздел (например, "DevOps").</p>
          <div className="form-group">
            <label htmlFor="newCategory">Название категории</label>
            <input
              type="text"
              id="newCategory"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Например, DevOps"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <i className="fas fa-plus"></i> Создать категорию
          </button>
        </form>

        {/* Форма 2: Добавить Навык */}
        <form className="skill-form-card" onSubmit={handleAddSkill}>
          <h3>Добавить Навык</h3>
          <p>Добавляет навык в существующую категорию.</p>
          <div className="form-group">
            <label htmlFor="skillCategory">Категория</label>
            <select 
                id="skillCategory" 
                value={selectedCategoryId} 
                onChange={(e) => setSelectedCategoryId(e.target.value)}
            >
              <option value="">Выберите категорию</option>
              {allSkills.map(cat => (
                <option key={cat.category_id} value={cat.category_id}>
                  {cat.category_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="newSkill">Название навыка</label>
            <input
              type="text"
              id="newSkill"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              placeholder="Например, Docker"
            />
          </div>
          <button type="submit" className="btn btn-primary">
             <i className="fas fa-plus"></i> Создать навык
          </button>
        </form>
      </div>

      {/* Список навыков */}
      <div className="skills-list-container">
        <h3>Текущий словарь навыков</h3>
        {allSkills.map(category => (
          <div className="skill-category-item" key={category.category_id}>
            <div className="category-header">
              <strong>{category.category_name}</strong>
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => handleDeleteCategory(category.category_id, category.category_name)}
              >
                <i className="fas fa-trash"></i> Удалить категорию
              </button>
            </div>
            <div className="skill-list">
              {category.skills.length > 0 ? category.skills.map(skill => (
                <div key={skill.skill_id} className="skill-tag-item">
                  <span>{skill.skill_name}</span>
                  <button 
                    className="remove-skill-btn"
                    onClick={() => handleDeleteSkill(skill.skill_id, skill.skill_name)}
                  >
                    &times;
                  </button>
                </div>
              )) : (
                <p className="empty-skill-list">В этой категории пока нет навыков</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkillsManagement;
