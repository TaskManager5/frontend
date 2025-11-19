import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, { 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  Controls, 
  Background,
  Handle, 
  Position,
  ReactFlowProvider,
  useReactFlow // <-- Хук для работы с проекцией координат
} from 'reactflow';
import 'reactflow/dist/style.css';

import { 
  getTeamsApi, 
  getTeamMembersApi, 
  getEmployeesApi,
  addTeamMemberApi,
  removeTeamMemberApi
} from '../../api/api';

// --- Кастомный узел сотрудника ---
const EmployeeNode = ({ data }) => {
  return (
    <div className="employee-node">
      {/* Точка подключения СВЕРХУ (для входящих связей от Команды) */}
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      
      <div className="employee-node-label">{data.label}</div>
      
      <div className="employee-node-skills">
        {data.skills && data.skills.length > 0 ? (
           data.skills.slice(0, 4).map((skill, idx) => (
             <span key={idx} className="employee-skill-badge">
               {skill}
             </span>
           ))
        ) : (
          <span>Нет навыков</span>
        )}
        {data.skills && data.skills.length > 4 && <span>...</span>}
      </div>

      {data.onRemove && (
        <button 
          className="employee-node-delete"
          onClick={(e) => { e.stopPropagation(); data.onRemove(data.userId); }}
        >
          Удалить
        </button>
      )}

      {/* Точка подключения СНИЗУ (для связей с другими сотрудниками) */}
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};

const nodeTypes = { employee: EmployeeNode };

// --- Основной компонент контента (внутри Provider) ---
const TeamGraphContent = ({ currentUser }) => {
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [allEmployees, setAllEmployees] = useState([]);
  const [sidebarSearch, setSidebarSearch] = useState('');
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Хук для конвертации координат
  const reactFlowInstance = useReactFlow();

  // 1. Загрузка списков
  useEffect(() => {
    const init = async () => {
      try {
        const [tData, eData] = await Promise.all([
            getTeamsApi(),
            getEmployeesApi()
        ]);
        setTeams(tData);
        setAllEmployees(eData);
      } catch (err) {
        console.error("Ошибка загрузки данных:", err);
      }
    };
    init();
  }, []);

  // 2. Загрузка графа при смене команды
  useEffect(() => {
    if (!selectedTeamId) {
        setNodes([]);
        setEdges([]);
        return;
    }
    loadGraphData(selectedTeamId);
  }, [selectedTeamId]);

  // Функция построения графа (УМНАЯ: сохраняет позиции)
  const loadGraphData = async (teamId) => {
    try {
      const members = await getTeamMembersApi(teamId);
      const teamInfo = teams.find(t => t.id.toString() === teamId.toString());
      
      setNodes((currentNodes) => {
          // 1. Центральный узел
          const centerNode = {
            id: 'team-center',
            type: 'input',
            data: { label: teamInfo ? teamInfo.name : 'Команда' },
            position: { x: 400, y: 300 },
            className: 'center-node', // Используем класс из CSS
          };

          // 2. Узлы сотрудников
          const memberNodes = members.map((member, index) => {
            const nodeId = `emp-${member.id}`;
            
            // ПРОВЕРКА: Если узел уже есть, оставляем его позицию!
            const existingNode = currentNodes.find(n => n.id === nodeId);
            
            let position;
            if (existingNode) {
                position = existingNode.position; // Оставляем как было
            } else {
                // Иначе ставим по кругу
                const radius = 300;
                const angle = (index / members.length) * 2 * Math.PI;
                position = { 
                    x: 400 + radius * Math.cos(angle) - 80, 
                    y: 300 + radius * Math.sin(angle) - 40 
                };
            }

            const fullEmployee = allEmployees.find(e => e.id === member.id);
            const skillNames = fullEmployee?.skills?.map(s => s.skill_name) || [];

            return {
              id: nodeId,
              type: 'employee',
              position: position,
              data: { 
                label: fullEmployee?.name || member.login, 
                userId: member.id,
                skills: skillNames,
                onRemove: handleRemoveMember 
              },
            };
          });

          return [centerNode, ...memberNodes];
      });

      // 3. Связи (только базовые, от центра)
      // Важно: Мы не перезаписываем edges полностью, чтобы сохранить ручные связи между сотрудниками
      setEdges((currentEdges) => {
           const teamEdges = members.map((member) => ({
            id: `e-team-${member.id}`,
            source: 'team-center',
            target: `emp-${member.id}`,
            type: 'default',
            animated: true,
            style: { stroke: '#2563eb', strokeWidth: 2 },
          }));
          
          // Оставляем пользовательские связи (между сотрудниками), удаляем старые тим-связи
          const userEdges = currentEdges.filter(e => e.source !== 'team-center');
          
          return [...teamEdges, ...userEdges];
      });

    } catch (err) {
      console.error("Ошибка построения графа:", err);
    }
  };

  // Удаление сотрудника из команды
  const handleRemoveMember = async (userId) => {
    if (!selectedTeamId) return;
    if (window.confirm('Удалить сотрудника из этой команды?')) {
        try {
            await removeTeamMemberApi(selectedTeamId, userId);
            // После удаления API, обновляем граф. 
            // Удаленный узел исчезнет сам, т.к. его не будет в members
            loadGraphData(selectedTeamId); 
        } catch (e) {
            alert('Ошибка удаления');
        }
    }
  };

  // Создание связи (drag-line)
  const onConnect = useCallback((params) => {
      // Разрешаем соединять сотрудников
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#64748b' } }, eds));
  }, [setEdges]);

  // Удаление связи по клику
  const onEdgeClick = useCallback((event, edge) => {
      // Запрещаем удалять связи с центром (они системные)
      if (edge.source === 'team-center') return;

      if (window.confirm('Удалить эту связь?')) {
          setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      }
  }, [setEdges]);

  // Перетаскивание из сайдбара (Drop)
  const onDrop = useCallback(
    async (event) => {
      event.preventDefault();

      if (!selectedTeamId) {
          alert("Сначала выберите команду!");
          return;
      }

      const userIdStr = event.dataTransfer.getData('application/reactflow');
      if (!userIdStr) return;

      const userId = parseInt(userIdStr, 10);
      const nodeId = `emp-${userId}`;
      
      // Проверка дубликатов
      const exists = nodes.some(n => n.id === nodeId);
      if (exists) {
          alert("Этот сотрудник уже в команде");
          return;
      }

      // 1. Вычисляем позицию, куда бросили (в координатах графа)
      const position = reactFlowInstance.project({
        x: event.clientX - 250, // Корректировка на ширину сайдбара и отступы (примерная)
        y: event.clientY - 100,
      });

      try {
          // 2. Сначала добавляем в базу
          await addTeamMemberApi(selectedTeamId, userId, 'member');
          
          // 3. Обновляем граф, но НОВЫЙ узел ставим в позицию DROP, а не в круг
          // Мы делаем это, вызывая loadGraphData, но предварительно можно было бы добавить узел вручную
          // Но проще довериться loadGraphData, так как мы добавили логику сохранения позиций.
          // ХИТРОСТЬ: Мы можем временно добавить узел в state, чтобы loadGraphData его "нашел" и сохранил позицию
          
          const fullEmployee = allEmployees.find(e => e.id === userId);
          const newNode = {
              id: nodeId,
              type: 'employee',
              position: position, // <-- ВОТ ОНО!
              data: { 
                label: fullEmployee?.name, 
                userId: userId,
                skills: fullEmployee?.skills?.map(s=>s.skill_name),
                onRemove: handleRemoveMember 
              }
          };
          
          setNodes((nds) => nds.concat(newNode));
          
          // А теперь обновляем (чтобы создать связи и синхронизироваться)
          // loadGraphData "увидит" наш newNode в currentNodes и сохранит его позицию
          setTimeout(() => loadGraphData(selectedTeamId), 100);

      } catch (err) {
          alert("Не удалось добавить сотрудника");
      }
    },
    [selectedTeamId, nodes, reactFlowInstance, allEmployees]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Фильтр сотрудников
  const filteredEmployees = useMemo(() => {
      if (!sidebarSearch) return allEmployees;
      const lowerSearch = sidebarSearch.toLowerCase();
      return allEmployees.filter(emp => {
          const nameMatch = emp.name.toLowerCase().includes(lowerSearch);
          const skillMatch = emp.skills?.some(s => s.skill_name.toLowerCase().includes(lowerSearch));
          return nameMatch || skillMatch;
      });
  }, [allEmployees, sidebarSearch]);

  const onDragStart = (event, userId) => {
    event.dataTransfer.setData('application/reactflow', userId);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="team-graph-wrapper">
      
      {/* Область графа */}
      <div className="graph-pane">
        <div className="graph-controls-overlay">
            <label className="graph-select-label">Выберите проект/команду:</label>
            <select 
                className="graph-select"
                value={selectedTeamId} 
                onChange={(e) => setSelectedTeamId(e.target.value)}
            >
                <option value="">-- Не выбрано --</option>
                {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
        </div>

        {selectedTeamId ? (
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect} // <-- Связывание
                onEdgeClick={onEdgeClick} // <-- Удаление связей
                nodeTypes={nodeTypes}
                onDragOver={onDragOver}
                onDrop={onDrop}
                fitView
            >
                <Background color="#aaa" gap={16} />
                <Controls />
            </ReactFlow>
        ) : (
            <div className="graph-placeholder">
                <h3>Выберите команду для визуализации</h3>
            </div>
        )}
      </div>

      {/* Сайдбар */}
      <div className="graph-sidebar">
        <h3>Все сотрудники</h3>
        <input 
            type="text" 
            className="graph-search-input"
            placeholder="Поиск по имени или навыку..." 
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
        />
        <p className="graph-sidebar-hint">
            Перетащите сотрудника на поле слева.
        </p>
        
        <div className="graph-employee-list">
            {filteredEmployees.map(emp => (
                <div 
                    key={emp.id} 
                    className="graph-draggable-item"
                    draggable 
                    onDragStart={(event) => onDragStart(event, emp.id)}
                >
                    <div className="graph-emp-name">{emp.name}</div>
                    <div className="graph-emp-skills">
                        {emp.skills && emp.skills.length > 0 ? (
                            emp.skills.slice(0, 5).map(skill => (
                                <span key={skill.skill_id} className="graph-skill-tag">
                                    {skill.skill_name}
                                </span>
                            ))
                        ) : (
                            <span className="graph-skill-tag">Навыки не указаны</span>
                        )}
                        {emp.skills && emp.skills.length > 5 && (
                            <span className="graph-skill-more">+{emp.skills.length - 5}</span>
                        )}
                    </div>
                </div>
            ))}
            {filteredEmployees.length === 0 && (
                <div className="graph-empty-search">
                    Сотрудники не найдены
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

// Обертка Provider обязательна для использования хука useReactFlow
const TeamGraph = (props) => (
    <ReactFlowProvider>
        <TeamGraphContent {...props} />
    </ReactFlowProvider>
);

export default TeamGraph;