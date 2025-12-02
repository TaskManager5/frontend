import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactFlow, { 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  Background,
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';

// Константы для области размещения
const GRAPH_WIDTH = 2500; // для уменьшения наложений
const GRAPH_HEIGHT = 1500; // для уменьшения наложений
const MIN_Y_POSITION = 200; // Минимальный Y, чтобы избежать наложения с узлами навыков
const NODE_SIZE = 180;      // Приблизительный минимальный размер узла (160 + отступы)

// Вспомогательная функция для простого рандомного размещения

// Функция для генерации случайного числа в диапазоне
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Кастомные узлы 

// 1. Узел Навыка (Верхний ряд)
const SkillNode = ({ data }) => {
  return (
    <div className="skill-graph-node skill-node-style">
      <div className="skill-node-label">{data.label}</div>
      {/* Ручки можно оставить по умолчанию, но для гибкости добавим все */}
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};

// 2. Узел Сотрудника (Нижняя сетка)
const EmployeeNode = ({ data }) => {
  // Уберем highlight, если нет выбранных навыков, чтобы они не были все подсвечены
  const classes = `skill-graph-node employee-node-style ${data.isMatch && data.totalSelected > 0 ? 'node-highlighted' : ''}`;
  
  return (
    <div className={classes}>
      {/* Точки подключения по всем сторонам для гибких связей */}
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
      <Handle type="target" position={Position.Right} style={{ background: '#555' }} />
      <Handle type="source" position={Position.Top} style={{ background: '#555' }} />
      <Handle type="source" position={Position.Left} style={{ background: '#555' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} /> {/* Оставляем нижнюю, как и была */}
      
      <div className="emp-avatar">{data.avatar}</div>
      <div className="emp-name">{data.label}</div>
      <div className="emp-match-count">
        {data.totalSelected > 0 ? 
            `Совпадений: ${data.matchCount} из ${data.totalSelected}` 
            : `Роль: ${data.role}`}
      </div>
    </div>
  );
};

const nodeTypes = {
  skill: SkillNode,
  employee: EmployeeNode
};

// Основной компонент

const SkillGraphContent = ({ employees, allSkills }) => {
  // Состояние: выбранные навыки
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);
  
  // Состояние: фильтр категории
  const [selectedCategory, setSelectedCategory] = useState('');

  // Состояние: сайдбар открыт/закрыт
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  
  // React Flow State 
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const reactFlowInstance = useReactFlow(); // Для fitView, если нужно
  
  // Добавляем возможность создавать связи между сотрудниками
  const onConnect = useCallback((params) => {
    // Проверяем, что соединяются два узла-сотрудника
    if (params.source.startsWith('emp-') && params.target.startsWith('emp-')) {
        // Добавляем связь с типом 'straight'
        setEdges((eds) => addEdge({ 
            ...params, 
            type: 'straight', 
            animated: false,
            style: { 
                stroke: '#84cc16', 
                strokeWidth: 2,
                opacity: 1
            } 
        }, eds));
    }
  }, [setEdges]);


  // Плоский список всех навыков
  const flatSkills = useMemo(() => {
      const flat = [];
      allSkills.forEach(cat => {
          cat.skills.forEach(s => {
              flat.push({ ...s, category: cat.category_name, category_id: cat.category_id });
          });
      });
      return flat;
  }, [allSkills]);

  // Список уникальных категорий для фильтра
  const categories = useMemo(() => {
      return allSkills.map(c => ({ id: c.category_id, name: c.category_name }));
  }, [allSkills]);

  // Фильтруем навыки для отображения в списке
  const visibleSkills = useMemo(() => {
      if (!selectedCategory) return flatSkills;
      return flatSkills.filter(s => s.category_id.toString() === selectedCategory.toString());
  }, [flatSkills, selectedCategory]);

  const toggleSkill = (skillId) => {
      setSelectedSkillIds(prev => {
          if (prev.includes(skillId)) return prev.filter(id => id !== skillId);
          return [...prev, skillId];
      });
  };

  useEffect(() => {
    const skillNodes = [];
    let tempEdges = []; 

    const hasSelectedSkills = selectedSkillIds.length > 0;
    
    // 1. Узлы НАВЫКОВ (только если выбраны)
    if (hasSelectedSkills) {
        const skillSpacing = 220;
        const centerOffset = 600; 
        const totalSkillsWidth = selectedSkillIds.length * skillSpacing;
        const startXSkills = centerOffset - (totalSkillsWidth / 2);

        selectedSkillIds.forEach((sId, index) => {
            const skillInfo = flatSkills.find(s => s.skill_id === sId);
            if (!skillInfo) return;

            const nodeId = `skill-${sId}`;
            skillNodes.push({
                id: nodeId,
                type: 'skill',
                position: { x: startXSkills + index * skillSpacing, y: 50 }, 
                data: { label: skillInfo.skill_name }
            });
        });
    }
    
    // 2. Узлы СОТРУДНИКОВ (всегда)
    // Используем функциональное обновление setNodes для сохранения перетащенных позиций
    setNodes(currentNodes => {
        const employeeNodes = [];
        
        employees.forEach((emp) => {
            const nodeId = `emp-${emp.id}`;
            const existingNode = currentNodes.find(n => n.id === nodeId);
            
            let matchCount = 0;
            let isFullMatch = false;

            if (hasSelectedSkills) {
                const empSkillIds = emp.skills.map(s => s.skill_id);
                matchCount = selectedSkillIds.filter(id => empSkillIds.includes(id)).length;
                isFullMatch = matchCount === selectedSkillIds.length;
            }

            let position;
            
            // 1. Приоритет - сохраненная позиция
            if (existingNode && existingNode.position.x !== 0 && existingNode.position.y !== 0) {
                position = existingNode.position; 
            } else {
                // 2. Иначе - генерируем хаотичную позицию 
                position = {
                    x: getRandomInt(0, GRAPH_WIDTH - NODE_SIZE),
                    y: getRandomInt(MIN_Y_POSITION, GRAPH_HEIGHT - NODE_SIZE),
                };
            }


            employeeNodes.push({
                id: nodeId,
                type: 'employee',
                position: position, 
                data: { 
                    label: emp.name,
                    role: emp.role,
                    avatar: emp.name.split(' ').map(n=>n[0]).join(''),
                    isMatch: isFullMatch,
                    matchCount: matchCount,
                    totalSelected: selectedSkillIds.length
                },
                style: { minWidth: '160px', minHeight: '120px' } 
            });

            // 3. Связи (навык-сотрудник)
            if (hasSelectedSkills) {
                const empSkillIds = emp.skills.map(s => s.skill_id);
                selectedSkillIds.forEach(sId => {
                    const isSkillMatch = empSkillIds.includes(sId);
                    
                    tempEdges.push({
                        id: `e-${sId}-${emp.id}`,
                        source: `skill-${sId}`,
                        target: nodeId,
                        type: 'straight', 
                        animated: isFullMatch,
                        style: { 
                            stroke: isFullMatch ? '#2563eb' : (isSkillMatch ? '#64748b' : '#a1a1aa'), 
                            strokeWidth: isFullMatch ? 3 : (isSkillMatch ? 2 : 1),
                            opacity: isFullMatch ? 1 : (isSkillMatch ? 0.7 : 0.4) 
                        }
                    });
                });
            }
        });
        
        // Объединяем узлы навыков и узлы сотрудников
        return [...skillNodes, ...employeeNodes];
    });

    
    // 4. Добавляем старые связи "сотрудник-сотрудник"
    // Используем функциональное обновление setEdges для доступа к последнему состоянию edges
    setEdges(currentEdges => {
        // Фильтруем только существующие edge'ы между сотрудниками
        const userEdges = currentEdges.filter(e => 
            e.source.startsWith('emp-') && e.target.startsWith('emp-')
        );
        // Возвращаем новые связи (навык-сотрудник) + сохраненные пользовательские связи
        return [...tempEdges, ...userEdges];
    });

    
    // При первом рендере или когда навыки выбраны, центрируем
    setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 300 }); 
    }, 50);
    
  }, [selectedSkillIds, employees, flatSkills, setNodes, setEdges, reactFlowInstance]);
  
  // Объект для отображения иконок навыков (симуляция)
  const skillIcons = useMemo(() => ({
    'React': 'fab fa-react',
    'Node.js': 'fab fa-node-js',
    'JavaScript': 'fab fa-js-square',
    'CSS': 'fab fa-css3-alt',
    'HTML': 'fab fa-html5',
    'Docker': 'fab fa-docker',
    'Kubernetes': 'fas fa-cubes',
    'Python': 'fab fa-python',
    'SQL': 'fas fa-database',
    'Management': 'fas fa-user-tie',
    'Leadership': 'fas fa-handshake',
    'Git': 'fab fa-git-alt',
    'AWS': 'fab fa-aws',
  }), []);

  // Функция для получения иконки
  const getSkillIcon = (skillName) => {
    // Удаляем из имени пробелы и не-буквы/цифры для нормализации
    const normalizedName = skillName.replace(/\s/g, '').replace(/[^a-zA-Z0-9.]/g, ''); 
    
    // Ищем точное совпадение в мапе:
    if (skillIcons[skillName]) return skillIcons[skillName];
    
    // Или ищем по подстроке:
    const found = Object.keys(skillIcons).find(key => 
        normalizedName.includes(key.replace(/\s/g, '').replace(/[^a-zA-Z0-9.]/g, ''))
    );
    
    return found ? skillIcons[found] : 'fas fa-wrench'; // Иконка по умолчанию
  };


  return (
    <div className="skill-graph-wrapper" style={{ display: 'flex', height: '100%', position: 'relative' }}>
      
      {/* Кнопка сворачивания/разворачивания (плавающая) */}
      <button 
        className="sidebar-toggle-btn"
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        title={isSidebarOpen ? "Свернуть панель" : "Развернуть панель"}
      >
        <i className={`fas fa-chevron-${isSidebarOpen ? 'left' : 'right'}`}></i>
      </button>

      {/* Левая панель выбора */}
      <div className={`skill-selector-sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
        <h3>Фильтр графа</h3>
        
        {/* Фильтр по категории */}
        <div className="category-filter-box">
            <label>Категория навыков:</label>
            <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
            >
                <option value="">-- Все категории --</option>
                {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
            </select>
        </div>

        <div className="skill-selector-list">
            {visibleSkills.length > 0 ? (
                visibleSkills.map(skill => (
                    <label key={skill.skill_id} className={`skill-checkbox-item ${selectedSkillIds.includes(skill.skill_id) ? 'checked' : ''}`}>
                        <input 
                            type="checkbox" 
                            checked={selectedSkillIds.includes(skill.skill_id)}
                            onChange={() => toggleSkill(skill.skill_id)}
                        />
                        {/* ДОБАВЛЕНИЕ ИКОНКИ */}
                        <i className={`${getSkillIcon(skill.skill_name)} skill-icon-list`}></i> 
                        <span className="skill-name">{skill.skill_name}</span>
                        {/* Показываем категорию, только если выбран режим "Все категории" */}
                        {!selectedCategory && <span className="skill-cat-label">{skill.category}</span>}
                    </label>
                ))
            ) : (
                <div className="no-skills-msg">Нет навыков в этой категории</div>
            )}
        </div>
        
        <div className="hint-text">
           <small>Выбрано: {selectedSkillIds.length}. <br/>Сотрудники со всеми навыками будут подсвечены.</small>
        </div>
      </div>

      {/* Граф */}
      <div className="skill-graph-canvas" style={{ flex: 1, background: '#f8fafc' }}>
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange} 
            onConnect={onConnect} 
            nodeTypes={nodeTypes}
            fitView 
            minZoom={0.2}
            maxZoom={4}
            // Убеждаемся, что узлы можно перетаскивать
            nodesDraggable={true} 
        >
            <Background color="#aaa" gap={16} />
            <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};

const SkillGraph = (props) => (
    <ReactFlowProvider>
        <SkillGraphContent {...props} />
    </ReactFlowProvider>
);

export default SkillGraph;
