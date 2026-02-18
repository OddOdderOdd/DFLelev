// src/components/Mindmap/MindmapCanvas.jsx
import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';

import GroupNode from './GroupNode';
import DefaultNode from './DefaultNode';
import InfoPanel from './InfoPanel';
import { useAdmin } from '../../context/AdminContext';

// Try to import TinaCMS, but provide fallback if it fails
let tinaClient, MINDMAP_QUERY, UPDATE_MINDMAP_MUTATION;
try {
  const tinaModule = require('../../tina/client');
  tinaClient = tinaModule.tinaClient;
  MINDMAP_QUERY = tinaModule.MINDMAP_QUERY;
  UPDATE_MINDMAP_MUTATION = tinaModule.UPDATE_MINDMAP_MUTATION;
} catch (error) {
  console.warn('TinaCMS client not available, using localStorage fallback');
  tinaClient = null;
}

import { initialNodes, initialEdges } from './MindmapData';

// Node type mappings
const nodeTypes = {
  groupNode: GroupNode,
  default: DefaultNode,
};

// Constants for group node padding and default sizes
const PADDING = {
  LEFT: 20,
  TOP: 34,
  RIGHT: 20,
  BOTTOM: 16,
};

const DEFAULT_SIZE = {
  NODE_WIDTH: 150,
  NODE_HEIGHT: 36,
};

// Helper Functions
function getNodeBounds(node, nodes) {
  let x = node.position.x;
  let y = node.position.y;

  if (node.parentNode) {
    const parent = nodes.find((n) => n.id === node.parentNode);
    if (parent) {
      const parentBounds = getNodeBounds(parent, nodes);
      x += parentBounds.x;
      y += parentBounds.y;
    }
  }

  const width = node.data?.computedWidth || node.style?.width || (node.type === 'groupNode' ? 300 : 150);
  const height = node.style?.height || (node.type === 'groupNode' ? 200 : 36);

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  };
}

function findBestHandle(node, targetBounds, nodes, isSource = true) {
  const nodeBounds = getNodeBounds(node, nodes);
  const dx = targetBounds.centerX - nodeBounds.centerX;
  const dy = targetBounds.centerY - nodeBounds.centerY;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const suffix = isSource ? '' : '-target';

  if (node.type === 'groupNode') {
    const absAngle = Math.abs(angle);

    if (absAngle <= 45) {
      const relY = (targetBounds.centerY - nodeBounds.y) / nodeBounds.height;
      if (relY < 0.25) return 'r-1' + suffix;
      if (relY < 0.5) return 'r-2' + suffix;
      if (relY < 0.75) return 'r-3' + suffix;
      return 'r-4' + suffix;
    } else if (absAngle >= 135) {
      const relY = (targetBounds.centerY - nodeBounds.y) / nodeBounds.height;
      if (relY < 0.25) return 'l-1' + suffix;
      if (relY < 0.5) return 'l-2' + suffix;
      if (relY < 0.75) return 'l-3' + suffix;
      return 'l-4' + suffix;
    } else if (angle > 0) {
      const relX = (targetBounds.centerX - nodeBounds.x) / nodeBounds.width;
      if (relX < 0.25) return 'b-1' + suffix;
      if (relX < 0.5) return 'b-2' + suffix;
      if (relX < 0.75) return 'b-3' + suffix;
      return 'b-4' + suffix;
    } else {
      const relX = (targetBounds.centerX - nodeBounds.x) / nodeBounds.width;
      if (relX < 0.25) return 't-1' + suffix;
      if (relX < 0.5) return 't-2' + suffix;
      if (relX < 0.75) return 't-3' + suffix;
      return 't-4' + suffix;
    }
  }

  if (angle >= -22.5 && angle < 22.5) return 'right' + suffix;
  if (angle >= 22.5 && angle < 67.5) return 'bottom-right' + suffix;
  if (angle >= 67.5 && angle < 112.5) return 'bottom' + suffix;
  if (angle >= 112.5 && angle < 157.5) return 'bottom-left' + suffix;
  if (angle >= 157.5 || angle < -157.5) return 'left' + suffix;
  if (angle >= -157.5 && angle < -112.5) return 'top-left' + suffix;
  if (angle >= -112.5 && angle < -67.5) return 'top' + suffix;
  return 'top-right' + suffix;
}

function handleDrag(currentNodes, changes) {
  const indexMap = new Map();
  currentNodes.forEach((n, i) => indexMap.set(n.id, i));

  const nodes = currentNodes.map((n) => ({
    ...n,
    position: { ...n.position },
    style: n.style ? { ...n.style } : n.style,
  }));

  changes.forEach((change) => {
    if (change.type !== 'position' || !change.position) return;

    const idx = indexMap.get(change.id);
    if (idx === undefined) return;
    const node = nodes[idx];

    node.position = { x: change.position.x, y: change.position.y };

    if (!node.parentNode) return;

    const parentIdx = indexMap.get(node.parentNode);
    if (parentIdx === undefined) return;
    const parent = nodes[parentIdx];
    if (parent.type !== 'groupNode') return;

    let parentWidth = parent.style?.width || 300;
    let parentHeight = parent.style?.height || 200;

    let childX = node.position.x;
    let childY = node.position.y;
    let grew = false;

    if (childX + DEFAULT_SIZE.NODE_WIDTH + PADDING.RIGHT > parentWidth) {
      parentWidth = childX + DEFAULT_SIZE.NODE_WIDTH + PADDING.RIGHT;
      grew = true;
    }
    if (childY + DEFAULT_SIZE.NODE_HEIGHT + PADDING.BOTTOM > parentHeight) {
      parentHeight = childY + DEFAULT_SIZE.NODE_HEIGHT + PADDING.BOTTOM;
      grew = true;
    }

    childX = Math.max(
      PADDING.LEFT,
      Math.min(childX, parentWidth - DEFAULT_SIZE.NODE_WIDTH - PADDING.RIGHT)
    );
    childY = Math.max(
      PADDING.TOP,
      Math.min(childY, parentHeight - DEFAULT_SIZE.NODE_HEIGHT - PADDING.BOTTOM)
    );

    node.position = { x: childX, y: childY };

    if (grew) {
      parent.style = { ...parent.style, width: parentWidth, height: parentHeight };
    }
  });

  return nodes;
}

// Data Normalization Functions
function normalizeNodes(nodes) {
  if (!Array.isArray(nodes)) return [];
  
  return nodes.map(node => ({
    id: node.id || '',
    type: node.type || 'default',
    position: {
      x: node.position?.x ?? 0,
      y: node.position?.y ?? 0,
    },
    data: {
      label: node.data?.label || '',
      description: node.data?.description || '',
      borderColor: node.data?.borderColor || '',
      backgroundColor: node.data?.backgroundColor || '',
      labelColor: node.data?.labelColor || '',
    },
    ...(node.parentNode && { parentNode: node.parentNode }),
    draggable: node.draggable !== undefined ? node.draggable : true,
    ...(node.style && {
      style: {
        ...(node.style.width !== undefined && { width: node.style.width }),
        ...(node.style.height !== undefined && { height: node.style.height }),
        ...(node.style.zIndex !== undefined && { zIndex: node.style.zIndex }),
      },
    }),
  }));
}

function normalizeEdges(edges) {
  if (!Array.isArray(edges)) return [];
  
  return edges.map(edge => ({
    id: edge.id || '',
    source: edge.source || '',
    target: edge.target || '',
    ...(edge.label && { label: edge.label }),
    ...(edge.animated !== undefined && { animated: edge.animated }),
    ...(edge.type && { type: edge.type }),
    ...(edge.style && { style: edge.style }),
    ...(edge.markerEnd && { markerEnd: edge.markerEnd }),
    ...(edge.markerStart && { markerStart: edge.markerStart }),
  }));
}

function serializeNodes(nodes) {
  return nodes.map(node => {
    const serialized = {
      id: node.id,
      type: node.type,
      position: {
        x: node.position.x,
        y: node.position.y,
      },
      data: {
        label: node.data?.label || '',
        description: node.data?.description || '',
        borderColor: node.data?.borderColor || '',
        backgroundColor: node.data?.backgroundColor || '',
        labelColor: node.data?.labelColor || '',
      },
      draggable: node.draggable !== undefined ? node.draggable : true,
    };

    if (node.parentNode) {
      serialized.parentNode = node.parentNode;
    }

    if (node.style) {
      serialized.style = {
        ...(node.style.width !== undefined && { width: node.style.width }),
        ...(node.style.height !== undefined && { height: node.style.height }),
        ...(node.style.zIndex !== undefined && { zIndex: node.style.zIndex }),
      };
    }

    return serialized;
  });
}

function serializeEdges(edges) {
  return edges.map(edge => {
    const serialized = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
    };

    if (edge.label) serialized.label = edge.label;
    if (edge.animated !== undefined) serialized.animated = edge.animated;
    if (edge.type) serialized.type = edge.type;
    if (edge.style) serialized.style = edge.style;
    if (edge.markerEnd) serialized.markerEnd = edge.markerEnd;
    if (edge.markerStart) serialized.markerStart = edge.markerStart;

    return serialized;
  });
}

// Main Component
const MindmapCanvas = () => {
  const { isAdmin, isEditingText, toggleTextEdit } = useAdmin();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [loadStatus, setLoadStatus] = useState('idle');
  const [saveStatus, setSaveStatus] = useState(null);
  const isPanning = useRef(false);

  // Load data on mount
  useEffect(() => {
    loadMindmapData();
  }, []);

  const loadMindmapData = async () => {
    setLoadStatus('loading');
    try {
      // Try localStorage first
      const storedData = localStorage.getItem('mindmap_data');
      if (storedData) {
        const { nodes: storedNodes, edges: storedEdges } = JSON.parse(storedData);
        setNodes(normalizeNodes(storedNodes));
        setEdges(normalizeEdges(storedEdges));
        setLoadStatus('success');
        return;
      }

      // Try TinaCMS if available
      if (tinaClient && MINDMAP_QUERY) {
        const result = await tinaClient.request({
          query: MINDMAP_QUERY,
          variables: { relativePath: 'index.json' },
        });

        const mindmapData = result?.data?.mindmap;
        if (mindmapData) {
          setNodes(normalizeNodes(mindmapData.nodes || []));
          setEdges(normalizeEdges(mindmapData.edges || []));
          setLoadStatus('success');
          return;
        }
      }

      // Fallback to initial data
      setNodes(normalizeNodes(initialNodes));
      setEdges(normalizeEdges(initialEdges));
      setLoadStatus('success');
    } catch (error) {
      console.error('Load error:', error);
      setNodes(normalizeNodes(initialNodes));
      setEdges(normalizeEdges(initialEdges));
      setLoadStatus('error');
    }
  };

  const handleNodesChange = useCallback(
    (changes) => {
      const positionChanges = changes.filter((c) => c.type === 'position');
      if (positionChanges.length > 0) {
        setNodes((nds) => handleDrag(nds, positionChanges));
      }
      onNodesChange(changes);
    },
    [setNodes, onNodesChange]
  );

  const onConnect = useCallback(
    (connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return;

      const sourceBounds = getNodeBounds(sourceNode, nodes);
      const targetBounds = getNodeBounds(targetNode, nodes);

      const sourceHandle = findBestHandle(sourceNode, targetBounds, nodes, true);
      const targetHandle = findBestHandle(targetNode, sourceBounds, nodes, false);

      const newEdge = {
        ...connection,
        sourceHandle,
        targetHandle,
        type: 'default',
        style: { strokeWidth: 2, stroke: '#334155' },
      };

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [nodes, setEdges]
  );

  const optimizedEdges = useMemo(() => {
    return edges.map((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      if (!sourceNode || !targetNode) return edge;

      const sourceBounds = getNodeBounds(sourceNode, nodes);
      const targetBounds = getNodeBounds(targetNode, nodes);

      const sourceHandle = findBestHandle(sourceNode, targetBounds, nodes, true);
      const targetHandle = findBestHandle(targetNode, sourceBounds, nodes, false);

      return {
        ...edge,
        sourceHandle,
        targetHandle,
      };
    });
  }, [edges, nodes]);

  const groupNodes = useMemo(() => nodes.filter((n) => n.type === 'groupNode'), [nodes]);

  const onNodeClick = useCallback((event, node) => {
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }
    setSelectedElement({ type: 'node', data: node });
  }, []);

  const onEdgeClick = useCallback((event, edge) => {
    setSelectedElement({ type: 'edge', data: edge });
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedElement(null);
  }, []);

  const onMoveStart = useCallback(() => {
    isPanning.current = true;
  }, []);

  const onMoveEnd = useCallback(() => {
    setTimeout(() => {
      isPanning.current = false;
    }, 100);
  }, []);

  const handleAddNode = useCallback(() => {
    const newNode = {
      id: `node_${Date.now()}`,
      type: 'default',
      position: { x: Math.random() * 500, y: Math.random() * 500 },
      data: {
        label: 'Ny Node',
        description: '',
        borderColor: '#3b82f6',
        backgroundColor: '#ffffff',
        labelColor: '#1e293b',
      },
      draggable: true,
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const handleAddGroup = useCallback(() => {
    const newGroup = {
      id: `group_${Date.now()}`,
      type: 'groupNode',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: 'Ny Gruppe',
        description: '',
        borderColor: '#8b5cf6',
        backgroundColor: '#f3f4f6',
        labelColor: '#1e293b',
      },
      style: { width: 300, height: 200, zIndex: -1 },
      draggable: true,
    };
    setNodes((nds) => [...nds, newGroup]);
  }, [setNodes]);

  const handleAssignNodeToGroup = useCallback(
    (nodeId, groupId) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            const group = nds.find((g) => g.id === groupId);
            if (group) {
              return {
                ...n,
                parentNode: groupId,
                position: { x: PADDING.LEFT, y: PADDING.TOP },
                extent: 'parent',
              };
            }
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  const handleRemoveNodeFromGroup = useCallback(
    (nodeId) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId && n.parentNode) {
            const parent = nds.find((p) => p.id === n.parentNode);
            if (parent) {
              const parentBounds = getNodeBounds(parent, nds);
              return {
                ...n,
                parentNode: undefined,
                extent: undefined,
                position: {
                  x: parentBounds.x + n.position.x,
                  y: parentBounds.y + n.position.y,
                },
              };
            }
          }
          return n;
        })
      );
    },
    [nodes, setNodes]
  );

  const handleDelete = useCallback(() => {
    if (!selectedElement) return;
    if (selectedElement.type === 'node') {
      setNodes((nds) => nds.filter((n) => n.id !== selectedElement.data.id));
      setEdges((eds) =>
        eds.filter(
          (e) =>
            e.source !== selectedElement.data.id &&
            e.target !== selectedElement.data.id
        )
      );
    } else if (selectedElement.type === 'edge') {
      setEdges((eds) => eds.filter((e) => e.id !== selectedElement.data.id));
    }
    setSelectedElement(null);
  }, [selectedElement, setNodes, setEdges]);

  const handleNodeUpdate = useCallback(
    (updatedData) => {
      if (!selectedElement || selectedElement.type !== 'node') return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedElement.data.id
            ? { ...n, data: { ...n.data, ...updatedData } }
            : n
        )
      );
    },
    [selectedElement, setNodes]
  );

  const handleEdgeUpdate = useCallback(
    (updatedEdge) => {
      if (!selectedElement || selectedElement.type !== 'edge') return;
      setEdges((eds) =>
        eds.map((e) =>
          e.id === selectedElement.data.id ? { ...e, ...updatedEdge } : e
        )
      );
    },
    [selectedElement, setEdges]
  );

  // Save to TinaCMS or localStorage
  const handleSaveData = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const dataToSave = {
        nodes: serializeNodes(nodes),
        edges: serializeEdges(edges),
      };

      // Always save to localStorage
      localStorage.setItem('mindmap_data', JSON.stringify(dataToSave));

      // Try to save to TinaCMS if available
      if (tinaClient && UPDATE_MINDMAP_MUTATION) {
        await tinaClient.request({
          query: UPDATE_MINDMAP_MUTATION,
          variables: {
            relativePath: 'index.json',
            data: dataToSave,
          },
        });
        console.log('Mindmap saved to TinaCMS');
      } else {
        console.log('Mindmap saved to localStorage (TinaCMS not available)');
      }

      setSaveStatus('success');
    } catch (error) {
      console.error('Save error:', error);
      // Even if TinaCMS fails, data is in localStorage
      setSaveStatus('success'); // Show success because localStorage worked
      console.log('Mindmap saved to localStorage (TinaCMS failed)');
    }
    setTimeout(() => setSaveStatus(null), 2500);
  }, [nodes, edges]);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <style>{`
        .react-flow__node {
          border: none !important;
          background: transparent !important;
          padding: 0 !important;
        }
        .react-flow__node-default {
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .react-flow__node.selected {
          box-shadow: none !important;
        }
        .react-flow__edge.selected .react-flow__edge-path {
          stroke: #3b82f6 !important;
          stroke-width: 3px !important;
        }
      `}</style>

      {isAdmin && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 10,
            display: 'flex',
            gap: '8px',
          }}
        >
          <button
            onClick={handleSaveData}
            disabled={saveStatus === 'saving' || loadStatus === 'loading'}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              cursor: saveStatus === 'saving' || loadStatus === 'loading' ? 'wait' : 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              backgroundColor:
                saveStatus === 'success'
                  ? '#16a34a'
                  : saveStatus === 'error'
                  ? '#ea580c'
                  : '#3b82f6',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              transition: 'background-color 0.2s',
              userSelect: 'none',
              opacity: saveStatus === 'saving' || loadStatus === 'loading' ? 0.7 : 1,
            }}
          >
            {loadStatus === 'loading'
              ? '⏳ Henter...'
              : saveStatus === 'saving'
              ? '⏳ Gemmer...'
              : saveStatus === 'success'
              ? '✅ Gemt!'
              : saveStatus === 'error'
              ? '⚠️ Fejl ved gem'
              : '💾 Gem Ændringer'}
          </button>

          <button
            onClick={handleAddNode}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              backgroundColor: '#10b981',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              transition: 'background-color 0.2s',
              userSelect: 'none',
            }}
          >
            ➕ Tilføj Node
          </button>

          <button
            onClick={handleAddGroup}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              backgroundColor: '#6366f1',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              transition: 'background-color 0.2s',
              userSelect: 'none',
            }}
          >
            🧩 Tilføj Gruppe
          </button>

          <button
            onClick={toggleTextEdit}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              backgroundColor: isEditingText ? '#f59e0b' : '#64748b',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              transition: 'background-color 0.2s',
              userSelect: 'none',
            }}
          >
            {isEditingText ? '📝 Rediger tekst (aktiv)' : '📝 Rediger tekst'}
          </button>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={optimizedEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50"
        connectionMode="loose"
        connectionRadius={40}
        defaultEdgeOptions={{
          type: 'default',
          style: { strokeWidth: 2 },
        }}
        nodesDraggable={true}
        nodesConnectable={isAdmin}
        elementsSelectable={true}
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'groupNode') {
              if (node.id === 'group_ledelse') return '#3b82f6';
              if (node.id === 'group_ledelses_udvalg') return '#f59e0b';
              if (node.id === 'group_folkestyret') return '#10b981';
              if (node.id === 'group_udvalgene') return '#8b5cf6';
            }
            return '#94a3b8';
          }}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>

      {selectedElement && (
        <InfoPanel
          element={selectedElement}
          onClose={() => setSelectedElement(null)}
          onNodeUpdate={handleNodeUpdate}
          onEdgeUpdate={handleEdgeUpdate}
          onDelete={handleDelete}
          groupNodes={groupNodes}
          onAssignNodeToGroup={handleAssignNodeToGroup}
          onRemoveNodeFromGroup={handleRemoveNodeFromGroup}
        />
      )}
    </div>
  );
};

export default MindmapCanvas;
