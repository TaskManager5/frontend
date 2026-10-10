import React, { useState, useEffect } from 'react';
import {
    getProjectsApi,
    createProjectApi,
    updateProjectApi,
    deleteProjectApi,
    getProjectMembersApi,
    addProjectMemberApi,
    removeProjectMemberApi,
} from '../../api/api';

// ==================== Модалка создания/редактирования ====================
const ProjectFormModal = ({ project, workers, onClose, onSave }) => {
    const [name, setName] = useState(project?.name || '');
    const [description, setDescription] = useState(project?.description || '');
    const [ownerWorkerId, setOwnerWorkerId] = useState('');
    const [error, setError] = useState(null);
    const isEdit = !!project;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
            setError('Название обязательно');
            return;
        }
        try {
            const payload = { name: name.trim(), description: description.trim() || null };
            if (!isEdit && ownerWorkerId) {
                payload.ownerWorkerId = Number(ownerWorkerId);
            }
            await onSave(payload);
            onClose();
        } catch (err) {
            setError(err.error || 'Ошибка сохранения');
        }
    };

    return (
        <div className="modal" style={{ display: 'flex' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-content" style={{ maxWidth: 520 }}>
                <div className="modal-header">
                    <div className="modal-title">{isEdit ? 'Редактировать проект' : 'Создать проект'}</div>
                    <div className="close-modal" onClick={onClose}>&times;</div>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ marginBottom: 12 }}>
                            <label>Название *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Например, Разработка CRM"
                                required
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 12 }}>
                            <label>Описание</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                placeholder="Краткое описание проекта"
                            />
                        </div>
                        {!isEdit && (
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label>Владелец проекта</label>
                                <select value={ownerWorkerId} onChange={(e) => setOwnerWorkerId(e.target.value)}>
                                    <option value="">Я (по умолчанию)</option>
                                    {workers.map((w) => (
                                        <option key={w.id} value={w.id}>
                                            {w.name}{w.position ? ' — ' + w.position : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
                            <button type="submit" className="login-btn" style={{ width: 'auto', padding: '8px 20px' }}>
                                {isEdit ? 'Сохранить' : 'Создать'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// ==================== Модалка участников ====================
const ProjectMembersModal = ({ project, workers, currentUser, onClose }) => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedRole, setSelectedRole] = useState('member');
    const [error, setError] = useState(null);

    const load = async () => {
        try {
            setLoading(true);
            const data = await getProjectMembersApi(project.id);
            setMembers(data);
        } catch (err) {
            setError(err.error || 'Ошибка загрузки');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [project.id]);

    const handleAdd = async () => {
        if (!selectedWorkerId) return;
        setError(null);
        try {
            await addProjectMemberApi(project.id, Number(selectedWorkerId), selectedRole);
            setSelectedWorkerId('');
            setSelectedRole('member');
            await load();
        } catch (err) {
            setError(err.error || 'Ошибка добавления');
        }
    };

    const handleRemove = async (workerId, name) => {
        if (!window.confirm(`Удалить "${name}" из проекта?`)) return;
        setError(null);
        try {
            await removeProjectMemberApi(project.id, workerId);
            await load();
        } catch (err) {
            setError(err.error || 'Ошибка удаления');
        }
    };

    const memberIds = new Set(members.map((m) => String(m.id)));
    const available = workers.filter((w) => !memberIds.has(String(w.id)));

    return (
        <div className="modal" style={{ display: 'flex' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-content" style={{ maxWidth: 640 }}>
                <div className="modal-header">
                    <div className="modal-title">Участники проекта: {project.name}</div>
                    <div className="close-modal" onClick={onClose}>&times;</div>
                </div>
                <div className="modal-body">
                    <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Добавить участника</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <select
                                value={selectedWorkerId}
                                onChange={(e) => setSelectedWorkerId(e.target.value)}
                                style={{ flex: '1 1 200px' }}
                            >
                                <option value="">— Выберите сотрудника —</option>
                                {available.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name}{w.position ? ' — ' + w.position : ''}{!w.user_id ? ' (без учётки)' : ''}
                                    </option>
                                ))}
                            </select>
                            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} style={{ flex: '0 0 140px' }}>
                                <option value="member">Участник</option>
                                <option value="manager">Руководитель</option>
                                <option value="owner">Владелец</option>
                            </select>
                            <button className="login-btn" style={{ width: 'auto', padding: '8px 16px' }} onClick={handleAdd} disabled={!selectedWorkerId}>
                                Добавить
                            </button>
                        </div>
                    </div>

                    {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}

                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Участники ({members.length}):</div>
                    {loading ? (
                        <div>Загрузка...</div>
                    ) : members.length === 0 ? (
                        <div style={{ color: '#888' }}>Нет участников</div>
                    ) : (
                        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                            {members.map((m) => (
                                <div key={m.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: 10, borderBottom: '1px solid #eee'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{m.name}{!m.login ? ' (без учётки)' : ''}</div>
                                        <div style={{ fontSize: 12, color: '#888' }}>{m.position || '—'} · роль: {m.role}</div>
                                    </div>
                                    <button
                                        className="delete-btn"
                                        style={{ padding: '6px 12px' }}
                                        onClick={() => handleRemove(m.id, m.name)}
                                    >
                                        Удалить
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ==================== Главный компонент ====================
export default function Projects({ currentUser, workers, activeProjectId, onSelectProject }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [membersProject, setMembersProject] = useState(null);

    const load = async () => {
        try {
            setLoading(true);
            const data = await getProjectsApi();
            setProjects(data);
        } catch (err) {
            setError(err.error || 'Ошибка загрузки проектов');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const isAdmin = currentUser?.role === 'admin';

    const handleCreate = async (payload) => {
        await createProjectApi(payload);
        await load();
    };

    const handleUpdate = async (payload) => {
        await updateProjectApi(editingProject.id, payload);
        await load();
    };

    const handleDelete = async (project) => {
        if (!window.confirm(`Удалить проект "${project.name}"?\n\nЗадачи и команды останутся, но потеряют привязку к проекту.`)) return;
        try {
            await deleteProjectApi(project.id);
            await load();
        } catch (err) {
            alert(err.error || 'Ошибка удаления');
        }
    };

    if (loading) return <div style={{ padding: 20 }}>Загрузка проектов...</div>;

    return (
        <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0 }}>Проекты ({projects.length})</h2>
                {isAdmin && (
                    <button className="login-btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => { setEditingProject(null); setFormOpen(true); }}>
                        + Создать проект
                    </button>
                )}
            </div>

            {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}

            {projects.length === 0 ? (
                <div style={{ color: '#888', padding: 40, textAlign: 'center' }}>Нет доступных проектов</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {projects.map((p) => {
                        const isActive = String(activeProjectId) === String(p.id);
                        return (
                            <div
                                key={p.id}
                                style={{
                                    border: isActive ? '2px solid #2563eb' : '1px solid #ddd',
                                    borderRadius: 8,
                                    padding: 16,
                                    background: isActive ? '#f0f6ff' : '#fff',
                                    cursor: 'pointer',
                                }}
                                onClick={() => onSelectProject(p.id)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                                    {isActive && <span style={{ fontSize: 11, background: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>АКТИВНЫЙ</span>}
                                </div>
                                <div style={{ fontSize: 13, color: '#666', marginBottom: 12, minHeight: 32 }}>
                                    {p.description || '—'}
                                </div>
                                <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                                    Участников: {p.members_count} · Задач: {p.tasks_count} · Команд: {p.teams_count}
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setMembersProject(p)}>
                                        Участники
                                    </button>
                                    {(isAdmin || p.my_role === 'owner') && (
                                        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { setEditingProject(p); setFormOpen(true); }}>
                                            Изменить
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <button className="delete-btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleDelete(p)}>
                                            Удалить
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isFormOpen && (
                <ProjectFormModal
                    project={editingProject}
                    workers={workers}
                    onClose={() => { setFormOpen(false); setEditingProject(null); }}
                    onSave={editingProject ? handleUpdate : handleCreate}
                />
            )}

            {membersProject && (
                <ProjectMembersModal
                    project={membersProject}
                    workers={workers}
                    currentUser={currentUser}
                    onClose={() => setMembersProject(null)}
                />
            )}
        </div>
    );
}
