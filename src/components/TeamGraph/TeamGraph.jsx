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
  useReactFlow // Хук для работы с проекцией координат
} from 'reactflow';
import 'reactflow/dist/style.css';

import { 
  getTeamsApi, 
  getTeamMembersApi, 
  getWorkersApi,
  addTeamMemberApi,
  removeTeamMemberApi
} from '../../api/api';

// Кастомный узел сотрудника 
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

//Основной компонент контента (внутри Provider)
const TeamGraphContent = ({ currentUser, activeProjectId }) => {
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [allWorkers, setAllWorkers] = useState([]);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [hiddenNodeIds, setHiddenNodeIds] = useState(new Set());
  const [contextMenu, setContextMenu] = useState(null); // { x, y, nodeId, nodeLabel, type }
  const [hiddenTeamIds, setHiddenTeamIds] = useState(new Set());   // скрытые команды (фильтр)
  const [hiddenWorkerIds, setHiddenWorkerIds] = useState(new Set()); // скрытые сотрудники (фильтр)
  const [showFilters, setShowFilters] = useState(true);
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Хук для конвертации координат
  const reactFlowInstance = useReactFlow();

  // Загрузка списков
  useEffect(() => {
    const init = async () => {
      try {
        const params = activeProjectId ? { projectId: activeProjectId } : {};
        const [tData, eData] = await Promise.all([
            getTeamsApi(params),
            getWorkersApi()
        ]);
        setTeams(tData);
        setAllWorkers(eData);
      } catch (err) {
        console.error("Ошибка загрузки данных:", err);
      }
    };
    init();
  }, [activeProjectId]);

  // Загрузка графа при смене команды или проекта
  useEffect(() => {
    if (!selectedTeamId) {
        loadAllTeamsGraph();
    } else {
        loadGraphData(selectedTeamId);
    }
  }, [selectedTeamId, teams, allWorkers]);

  // Функция построения графа со ВСЕМИ командами активного проекта
  const loadAllTeamsGraph = async () => {
    if (!teams || teams.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    try {
      // Загружаем участников всех команд параллельно
      const teamsWithMembers = await Promise.all(
        teams.map(async (team) => {
          try {
            const members = await getTeamMembersApi(team.id);
            return { team, members };
          } catch (err) {
            return { team, members: [] };
          }
        })
      );

      setNodes((currentNodes) => {
        const newNodes = [];
        const newEdges = [];

        teamsWithMembers.forEach(({ team, members }, teamIndex) => {
          // Центральный узел команды — в колонке (teamIndex)
          const colX = teamIndex * 450;
          const centerId = `team-${team.id}`;

          newNodes.push({
            id: centerId,
            type: 'input',
            data: { label: team.name },
            position: { x: colX + 200, y: 50 },
            className: 'center-node',
          });

          // Узлы сотрудников — вертикально под командой
          members.forEach((member, memberIndex) => {
            const nodeId = `emp-${member.id}`;
            const existingNode = currentNodes.find(n => n.id === nodeId);

            const position = existingNode ? existingNode.position : {
              x: colX,
              y: 200 + memberIndex * 160,
            };

            const fullEmployee = allWorkers.find(e => String(e.id) === String(member.id));
            const skillNames = fullEmployee?.skills?.map(s => s.skill_name) || [];

            newNodes.push({
              id: nodeId,
              type: 'employee',
              position: position,
              data: {
                label: fullEmployee?.name || member.name || member.login || `Сотрудник ${member.id}`,
                userId: member.id,
                skills: skillNames,
                onRemove: null, // без команды нельзя удалить
              },
            });

            // Связь команда → участник
            newEdges.push({
              id: `e-team-${team.id}-${member.id}`,
              source: centerId,
              target: nodeId,
              type: 'default',
              animated: true,
              style: { stroke: '#2563eb', strokeWidth: 2 },
            });
          });
        });

        return newNodes;
      });

      setEdges((currentEdges) => {
        // Пересобираем edges
        const newEdges = [];
        teamsWithMembers.forEach(({ team, members }) => {
          members.forEach((member) => {
            newEdges.push({
              id: `e-team-${team.id}-${member.id}`,
              source: `team-${team.id}`,
              target: `emp-${member.id}`,
              type: 'default',
              animated: true,
              style: { stroke: '#2563eb', strokeWidth: 2 },
            });
          });
        });
        return newEdges;
      });

    } catch (err) {
      console.error('Ошибка построения общего графа:', err);
    }
  };

  // Функция построения графа 
  const loadGraphData = async (teamId) => {
    try {
      const members = await getTeamMembersApi(teamId);
      const teamInfo = teams.find(t => t.id.toString() === teamId.toString());
      
      setNodes((currentNodes) => {
          // 1Центральный узел
          const centerNode = {
            id: 'team-center',
            type: 'input',
            data: { label: teamInfo ? teamInfo.name : 'Команда' },
            position: { x: 400, y: 300 },
            className: 'center-node', //  класс из CSS
          };

          // Узлы сотрудников
          const memberNodes = members.map((member, index) => {
            const nodeId = `emp-${member.id}`;
            
            // Если узел уже есть, оставляем его позицию!
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

            const fullEmployee = allWorkers.find(e => String(e.id) === String(member.id));
            const skillNames = fullEmployee?.skills?.map(s => s.skill_name) || [];

            return {
              id: nodeId,
              type: 'employee',
              position: position,
              data: { 
                label: fullEmployee?.name || member.name || member.login || `Сотрудник ${member.id}`, 
                userId: member.id,
                skills: skillNames,
                onRemove: handleRemoveMember 
              },
            };
          });

          return [centerNode, ...memberNodes];
      });

      // Связи (только базовые, от центра)
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

  // Фильтрация видимых узлов (без скрытых + с учётом фильтров + подсветка выделения)
  const visibleNodes = useMemo(() => {
    return nodes
      .filter(n => {
        if (hiddenNodeIds.has(n.id)) return false;
        if (n.id.startsWith('team-') && hiddenTeamIds.has(n.id)) return false;
        if (n.id.startsWith('emp-') && hiddenWorkerIds.has(n.id)) return false;
        return true;
      })
      .map(n => {
        const isSelected = selectedNodeIds.has(n.id);
        return {
          ...n,
          className: isSelected 
            ? `${n.className || ''} node-selected`.trim() 
            : (n.className || '').replace('node-selected', '').trim(),
        };
      });
  }, [nodes, hiddenNodeIds, hiddenTeamIds, hiddenWorkerIds, selectedNodeIds]);

  const visibleEdges = useMemo(() => {
    return edges.filter(e => 
      !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target)
    );
  }, [edges, hiddenNodeIds]);

  // Правый клик по узлу — открыть контекстное меню
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    const isTeam = node.id.startsWith('team-');
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
      nodeLabel: node.data?.label || 'Узел',
      type: isTeam ? 'team' : 'employee',
    });
  }, []);

  // Скрыть узел
  const hideNode = useCallback((nodeId) => {
    setHiddenNodeIds(prev => {
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });
    setContextMenu(null);
  }, []);

  // Показать все
  const showAll = useCallback(() => {
    setHiddenNodeIds(new Set());
    setHiddenTeamIds(new Set());
    setHiddenWorkerIds(new Set());
  }, []);

  // Переключить команду (показать/скрыть)
  const toggleTeam = useCallback((teamId) => {
    setHiddenTeamIds(prev => {
      const next = new Set(prev);
      const nodeId = `team-${teamId}`;
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }, []);

  // Переключить сотрудника
  const toggleWorker = useCallback((workerId) => {
    setHiddenWorkerIds(prev => {
      const next = new Set(prev);
      const nodeId = `emp-${workerId}`;
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }, []);

  // Закрыть контекстное меню по клику мимо
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Клик по узлу — выделение (Ctrl+клик — множественное)
  const onNodeClick = useCallback((event, node) => {
    // Игнорируем команды — их нельзя выделять массово (пока)
    if (node.id.startsWith('team-')) return;

    setSelectedNodeIds(prev => {
      const next = new Set(prev);
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        // Ctrl/Cmd/Shift — добавить/убрать
        if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
      } else {
        // Обычный клик — сбросить, выделить только этот
        next.clear();
        next.add(node.id);
      }
      return next;
    });
  }, []);

  // Клик по пустому месту — сбросить выделение
  const onPaneClick = useCallback(() => {
    setSelectedNodeIds(new Set());
  }, []);

  // Очистить выделение
  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
  }, []);

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

      // Вычисляем позицию, куда бросили (в координатах графа)
      const position = reactFlowInstance.project({
        x: event.clientX - 250, // Корректировка на ширину сайдбара и отступы 
        y: event.clientY - 100,
      });

      try {
          // Сначала добавляем в базу
          await addTeamMemberApi(selectedTeamId, userId, 'member');
          
          // Обновляем граф, но НОВЫЙ узел ставим в позицию DROP, а не в круг          
          const fullEmployee = allWorkers.find(e => String(e.id) === String(userId));
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
          
          // теперь обновляем (чтобы создать связи и синхронизироваться)
          // loadGraphData "увидит" newNode в currentNodes и сохранит его позицию
          setTimeout(() => loadGraphData(selectedTeamId), 100);

      } catch (err) {
          alert("Не удалось добавить сотрудника");
      }
    },
    [selectedTeamId, nodes, reactFlowInstance, allWorkers]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Фильтр сотрудников
  const filteredEmployees = useMemo(() => {
      if (!sidebarSearch) return allWorkers;
      const lowerSearch = sidebarSearch.toLowerCase();
      return allWorkers.filter(emp => {
          const nameMatch = emp.name.toLowerCase().includes(lowerSearch);
          const skillMatch = emp.skills?.some(s => s.skill_name.toLowerCase().includes(lowerSearch));
          return nameMatch || skillMatch;
      });
  }, [allWorkers, sidebarSearch]);

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

        {(selectedTeamId || teams.length > 0) ? (
            <>
                {hiddenNodeIds.size > 0 && (
                    <button className="graph-show-all-btn" onClick={showAll}>
                        <i className="fas fa-eye"></i> Показать скрытые ({hiddenNodeIds.size})
                    </button>
                )}
                <ReactFlow
                    nodes={visibleNodes}
                    edges={visibleEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    onNodeContextMenu={onNodeContextMenu}
                    nodeTypes={nodeTypes}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    fitView
                    zoomOnScroll={true}
                    zoomOnPinch={true}
                    panOnScroll={false}
                    minZoom={0.2}
                    maxZoom={2}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                >
                    <Background color="#aaa" gap={16} />
                    <Controls />
                </ReactFlow>
                {selectedNodeIds.size > 0 && (
                    <div className="graph-selection-panel">
                        <span className="graph-selection-count">
                            <i className="fas fa-check-square"></i> Выбрано: {selectedNodeIds.size}
                        </span>
                        <button 
                            className="graph-selection-btn"
                            onClick={() => {
                                setHiddenNodeIds(prev => new Set([...prev, ...selectedNodeIds]));
                                clearSelection();
                            }}
                        >
                            <i className="fas fa-eye-slash"></i> Скрыть
                        </button>
                        <button 
                            className="graph-selection-btn danger"
                            onClick={clearSelection}
                        >
                            <i className="fas fa-times"></i> Сбросить
                        </button>
                    </div>
                )}
                {contextMenu && (
                    <div
                        className="node-context-menu"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="node-context-menu-item"
                            onClick={() => hideNode(contextMenu.nodeId)}
                        >
                            <i className="fas fa-eye-slash"></i> Скрыть «{contextMenu.nodeLabel}»
                        </div>
                        <div className="node-context-menu-divider" />
                        <div
                            className="node-context-menu-item"
                            onClick={() => {
                                // Скрыть все узлы того же типа
                                const type = contextMenu.type;
                                const idsToHide = nodes
                                    .filter(n => type === 'team' 
                                        ? n.id.startsWith('team-') 
                                        : !n.id.startsWith('team-'))
                                    .map(n => n.id);
                                setHiddenNodeIds(prev => new Set([...prev, ...idsToHide]));
                                setContextMenu(null);
                            }}
                        >
                            <i className="fas fa-eye-slash"></i> Скрыть все {contextMenu.type === 'team' ? 'команды' : 'сотрудники'}
                        </div>
                    </div>
                )}
            </>
        ) : (
            <div className="graph-placeholder">
                <h3>Выберите команду для визуализации</h3>
            </div>
        )}
      </div>

      {/* Сайдбар */}
      <div className="graph-sidebar">
        {/* Панель фильтров */}
        {showFilters && (
          <div className="graph-filter-panel">
            <div className="graph-filter-header">
              <span>Фильтры</span>
              <button className="graph-filter-toggle" onClick={() => setShowFilters(false)} title="Свернуть">
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
            {teams.length > 0 && (
              <div className="graph-filter-group">
                <div className="graph-filter-group-title">Команды ({teams.length})</div>
                {teams.map(t => (
                  <label key={t.id} className="graph-filter-item">
                    <input
                      type="checkbox"
                      checked={!hiddenTeamIds.has(`team-${t.id}`)}
                      onChange={() => toggleTeam(t.id)}
                    />
                    <span>{t.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {!showFilters && (
          <button className="graph-filter-show" onClick={() => setShowFilters(true)}>
            <i className="fas fa-filter"></i> Фильтры
          </button>
        )}

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

// Обертка Provider обязательна для использования хука useReactFlow!!!!!
const TeamGraph = (props) => (
    <ReactFlowProvider>
        <TeamGraphContent {...props} />
    </ReactFlowProvider>
);

export default TeamGraph;
