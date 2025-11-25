import React, { useState, useEffect, useMemo } from 'react';
import ReactFlow, { 
  useNodesState, 
  useEdgesState, 
  Background,
  Controls,
  Handle,
  Position,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';

// Кастомные узлы 

// 1. Узел Навыка (Верхний ряд)
const SkillNode = ({ data }) => {
  return (
    <div className="skill-graph-node skill-node-style">
      <div className="skill-node-label">{data.label}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};

// 2. Узел Сотрудника (Нижняя сетка)
const EmployeeNode = ({ data }) => {
  const classes = `skill-graph-node employee-node-style ${data.isMatch ? 'node-highlighted' : ''}`;
  
  return (
    <div className={classes}>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div className="emp-avatar">{data.avatar}</div>
      <div className="emp-name">{data.label}</div>
      <div className="emp-match-count">
        Совпадений: {data.matchCount} из {data.totalSelected}
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

  // ГЕНЕРАЦИЯ ГРАФА
  useEffect(() => {
    if (selectedSkillIds.length === 0) {
        setNodes([]);
        setEdges([]);
        return;
    }

    const newNodes = [];
    const newEdges = [];

    // 1. Узлы НАВЫКОВ (ряд y=50)
    const skillSpacing = 220;
    // Центрируем навыки
    const totalSkillsWidth = selectedSkillIds.length * skillSpacing;
    // Используем ширину окна или фиксированную, чтобы найти центр
    const centerX = window.innerWidth / 2; // Приблизительный центр конваса
    const startXSkills = centerX - (totalSkillsWidth / 2) + 100; // +100 сдвиг вправо от сайдбара

    selectedSkillIds.forEach((sId, index) => {
        const skillInfo = flatSkills.find(s => s.skill_id === sId);
        if (!skillInfo) return;

        newNodes.push({
            id: `skill-${sId}`,
            type: 'skill',
            position: { x: startXSkills + index * skillSpacing, y: 50 },
            data: { label: skillInfo.skill_name }
        });
    });

    // 2. Находим релевантных сотрудников
    const relevantEmployees = employees.filter(emp => {
        if (!emp.skills) return false;
        return emp.skills.some(s => selectedSkillIds.includes(s.skill_id));
    });

    // 3. Узлы СОТРУДНИКОВ (Сетка начиная с y=300)
    const empWidth = 180; // Ширина узла + отступ
    const empHeight = 140; // Высота узла + отступ
    const columns = 6; // Сколько сотрудников в ряд
    
    // Рассчитываем ширину сетки сотрудников, чтобы центрировать её
    const gridWidth = Math.min(relevantEmployees.length, columns) * empWidth;
    const startXEmps = centerX - (gridWidth / 2) + 100;

    relevantEmployees.forEach((emp, index) => {
        const empSkillIds = emp.skills.map(s => s.skill_id);
        const matchCount = selectedSkillIds.filter(id => empSkillIds.includes(id)).length;
        const isFullMatch = matchCount === selectedSkillIds.length;

        // Логика СЕТКИ (Grid Layout)
        const col = index % columns;
        const row = Math.floor(index / columns);

        newNodes.push({
            id: `emp-${emp.id}`,
            type: 'employee',
            // x зависит от колонки, y зависит от ряда
            position: { 
                x: startXEmps + col * empWidth, 
                y: 300 + row * empHeight 
            },
            data: { 
                label: emp.name,
                avatar: emp.name.split(' ').map(n=>n[0]).join(''),
                isMatch: isFullMatch,
                matchCount: matchCount,
                totalSelected: selectedSkillIds.length
            }
        });

        // 4. Связи
        selectedSkillIds.forEach(sId => {
            if (empSkillIds.includes(sId)) {
                newEdges.push({
                    id: `e-${sId}-${emp.id}`,
                    source: `skill-${sId}`,
                    target: `emp-${emp.id}`,
                    animated: isFullMatch,
                    style: { 
                        stroke: isFullMatch ? '#2563eb' : '#cbd5e1',
                        strokeWidth: isFullMatch ? 3 : 1,
                        opacity: isFullMatch ? 1 : 0.2
                    }
                });
            }
        });
    });

    setNodes(newNodes);
    setEdges(newEdges);

  }, [selectedSkillIds, employees, flatSkills, setNodes, setEdges]);

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
            nodeTypes={nodeTypes}
            fitView
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
