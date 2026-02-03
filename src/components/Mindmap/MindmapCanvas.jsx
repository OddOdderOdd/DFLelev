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

import { initialNodes, initialEdges } from './MindmapData';
import GroupNode from './GroupNode';
import DefaultNode from './DefaultNode';
import InfoPanel from './InfoPanel';
import { useAdmin } from '../../context/AdminContext';
import { tinaClient, MINDMAP_QUERY, UPDATE_MINDMAP_MUTATION } from '../../tina/client';

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

// ──────────────────────────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────────────────────────

/**
 * Calculate absolute position and bounds of a node
 */
function getNodeBounds(node, nodes) {
  let x = node.position.x;
  let y = node.position.y;

  // Add parent position if node has a parent
  if (node.parentNode) {
    const parent = nodes.find((n) => n.id === node.parentNode);
    if (parent) {
      const parentBounds = getNodeBounds(parent, nodes);
      x += parentBounds.x;
      y += parentBounds.y;
    }
  }

  // Get dimensions
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

/**
 * Find the best handle on a node for connecting to another node
 */
function findBestHandle(node, targetBounds, nodes, isSource = true) {
  const nodeBounds = getNodeBounds(node, nodes);

  const dx = targetBounds.centerX - nodeBounds.centerX;
  const dy = targetBounds.centerY - nodeBounds.centerY;

  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const suffix = isSource ? '' : '-target';

  // Group nodes use 16-point connection system
  if (node.type === 'groupNode') {
    const absAngle = Math.abs(angle);

    if (absAngle <= 45) {
      // Right edge
      const relY = (targetBounds.centerY - nodeBounds.y) / nodeBounds.height;
      if (relY < 0.25) return 'r-1' + suffix;
      if (relY < 0.5) return 'r-2' + suffix;
      if (relY < 0.75) return 'r-3' + suffix;
      return 'r-4' + suffix;
    } else if (absAngle >= 135) {
      // Left edge
      const relY = (targetBounds.centerY - nodeBounds.y) / nodeBounds.height;
      if (relY < 0.25) return 'l-1' + suffix;
      if (relY < 0.5) return 'l-2' + suffix;
      if (relY < 0.75) return 'l-3' + suffix;
      return 'l-4' + suffix;
    } else if (angle > 0) {
      // Bottom edge
      const relX = (targetBounds.centerX - nodeBounds.x) / nodeBounds.width;
      if (relX < 0.25) return 'b-1' + suffix;
      if (relX < 0.5) return 'b-2' + suffix;
      if (relX < 0.75) return 'b-3' + suffix;
      return 'b-4' + suffix;
    } else {
      // Top edge
      const relX = (targetBounds.centerX - nodeBounds.x) / nodeBounds.width;
      if (relX < 0.25) return 't-1' + suffix;
      if (relX < 0.5) return 't-2' + suffix;
      if (relX < 0.75) return 't-3' + suffix;
      return 't-4' + suffix;
    }
  }

  // Regular nodes use 8-point connection system
  if (angle >= -22.5 && angle < 22.5) return 'right' + suffix;
  if (angle >= 22.5 && angle < 67.5) return 'bottom-right' + suffix;
  if (angle >= 67.5 && angle < 112.5) return 'bottom' + suffix;
  if (angle >= 112.5 && angle < 157.5) return 'bottom-left' + suffix;
  if (angle >= 157.5 || angle < -157.5) return 'left' + suffix;
  if (angle >= -157.5 && angle < -112.5) return 'top-left' + suffix;
  if (angle >= -112.5 && angle < -67.5) return 'top' + suffix;
  return 'top-right' + suffix;
}

/**
 * Handle node dragging and group auto-resize
 */
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

    // Auto-expand parent if child is dragged beyond bounds
    if (childX + DEFAULT_SIZE.NODE_WIDTH + PADDING.RIGHT > parentWidth) {
      parentWidth = childX + DEFAULT_SIZE.NODE_WIDTH + PADDING.RIGHT;
      grew = true;
    }
    if (childY + DEFAULT_SIZE.NODE_HEIGHT + PADDING.BOTTOM > parentHeight) {
      parentHeight = childY + DEFAULT_SIZE.NODE_HEIGHT + PADDING.BOTTOM;
      grew = true;
    }

    // Constrain child within parent bounds
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


// ──────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────

const MindmapCanvas = () => {
  const { isAdmin, isEditingText, toggleTextEdit } = useAdmin();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loadStatus, setLoadStatus] = useState('loading');
  const [saveStatus, setSaveStatus] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null); // Can be node or edge
  const isPanningRef = useRef(false);
  const nodeIdCounter = useRef(1000); // Start high to avoid conflicts

  const groupNodes = useMemo(
    () => nodes.filter((node) => node.type === 'groupNode'),
    [nodes]
  );

  useEffect(() => {
    let isMounted = true;

    const fetchMindmap = async () => {
      try {
        const response = await tinaClient.request({
          query: MINDMAP_QUERY,
          variables: { relativePath: 'index.json' },
        });
        const data = response?.data?.mindmap;
        let parsedNodes = [];
        let parsedEdges = [];

        try {
          parsedNodes = data?.nodes ? JSON.parse(data.nodes) : [];
          parsedEdges = data?.edges ? JSON.parse(data.edges) : [];
        } catch (parseError) {
          console.error('Failed to parse mindmap JSON', parseError);
        }

        const shouldSeed = parsedNodes.length === 0 && parsedEdges.length === 0;

        if (!isMounted) return;
        if (shouldSeed) {
          setNodes(initialNodes);
          setEdges(initialEdges);
          try {
            await tinaClient.request({
              query: UPDATE_MINDMAP_MUTATION,
              variables: {
                relativePath: 'index.json',
                data: {
                  nodes: JSON.stringify(initialNodes),
                  edges: JSON.stringify(initialEdges),
                },
              },
            });
          } catch (seedError) {
            console.error('Failed to seed mindmap data', seedError);
          }
        } else {
          setNodes(parsedNodes);
          setEdges(parsedEdges);
        }
        setLoadStatus('success');
      } catch (error) {
        console.error('Failed to load mindmap from TinaCMS', error);
        if (!isMounted) return;
        setLoadStatus('error');
      }
    };

    fetchMindmap();

    return () => {
      isMounted = false;
    };
  }, [setEdges, setNodes]);

  // Calculate optimal edge routing dynamically
  const optimizedEdges = useMemo(() => {
    return edges.map((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      if (!sourceNode || !targetNode) return edge;

      const targetBounds = getNodeBounds(targetNode, nodes);
      const sourceBounds = getNodeBounds(sourceNode, nodes);

      const sourceHandle = findBestHandle(sourceNode, targetBounds, nodes, true);
      const targetHandle = findBestHandle(targetNode, sourceBounds, nodes, false);

      return {
        ...edge,
        sourceHandle,
        targetHandle,
      };
    });
  }, [nodes, edges]);

  // Handle node changes with drag support
  const handleNodesChange = useCallback(
    (changes) => {
      const dragChanges = changes.filter(
        (c) => c.type === 'position' && c.dragging === true && c.position
      );

      if (dragChanges.length > 0) {
        setNodes((currentNodes) => handleDrag(currentNodes, dragChanges));
      }

      const otherChanges = changes.filter(
        (c) => !(c.type === 'position' && c.dragging === true && c.position)
      );

      if (otherChanges.length > 0) {
        onNodesChange(otherChanges);
      }
    },
    [onNodesChange, setNodes]
  );

  // Handle connecting nodes (Admin only)
  const onConnect = useCallback(
    (connection) => {
      if (!isAdmin) return;

      // Create new edge with proper styling
      const newEdge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}`,
        type: 'default',
        style: { strokeWidth: 2, stroke: '#334155' },
        markerEnd: { type: 'arrowclosed', color: '#334155' },
      };

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [isAdmin, setEdges]
  );

  // Handle node click to show info panel
  const onNodeClick = useCallback((event, node) => {
    setSelectedElement({ type: 'node', data: node });
  }, []);

  // Handle edge click to show info panel (Admin only)
  const onEdgeClick = useCallback((event, edge) => {
    if (!isAdmin) return;
    setSelectedElement({ type: 'edge', data: edge });
  }, [isAdmin]);

  // Track panning to prevent accidental panel close
  const onMoveStart = useCallback(() => {
    isPanningRef.current = true;
  }, []);

  const onMoveEnd = useCallback(() => {
    setTimeout(() => {
      isPanningRef.current = false;
    }, 50);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedElement(null);
  }, []);

  // Add new node (Admin only)
  const handleAddNode = useCallback(() => {
    const newNodeId = `node_${nodeIdCounter.current++}`;
    const newNode = {
      id: newNodeId,
      type: 'default',
      data: { label: 'Ny Node' },
      position: { x: 500, y: 300 },
      draggable: true,
    };

    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const handleAddGroup = useCallback(() => {
    const newGroupId = `group_${nodeIdCounter.current++}`;
    const newGroup = {
      id: newGroupId,
      type: 'groupNode',
      data: {
        label: 'Ny Gruppe',
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        labelColor: '#1e293b',
      },
      position: { x: 420, y: 220 },
      style: {
        width: 320,
        height: 220,
      },
      draggable: true,
    };

    setNodes((nds) => [...nds, newGroup]);
  }, [setNodes]);

  const handleAssignNodeToGroup = useCallback(
    (nodeId, groupId) => {
      setNodes((nds) => {
        const node = nds.find((n) => n.id === nodeId);
        const group = nds.find((n) => n.id === groupId);
        if (!node || !group) return nds;

        const nodeBounds = getNodeBounds(node, nds);
        const groupBounds = getNodeBounds(group, nds);
        const groupWidth = group.style?.width || 300;
        const groupHeight = group.style?.height || 200;

        const maxX = Math.max(
          PADDING.LEFT,
          groupWidth - nodeBounds.width - PADDING.RIGHT
        );
        const maxY = Math.max(
          PADDING.TOP,
          groupHeight - nodeBounds.height - PADDING.BOTTOM
        );

        const relativePosition = {
          x: Math.min(
            maxX,
            Math.max(PADDING.LEFT, nodeBounds.x - groupBounds.x)
          ),
          y: Math.min(
            maxY,
            Math.max(PADDING.TOP, nodeBounds.y - groupBounds.y)
          ),
        };

        return nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                parentNode: groupId,
                position: relativePosition,
              }
            : n
        );
      });
    },
    [setNodes]
  );

  const handleRemoveNodeFromGroup = useCallback(
    (nodeId) => {
      setNodes((nds) => {
        const node = nds.find((n) => n.id === nodeId);
        if (!node || !node.parentNode) return nds;

        const nodeBounds = getNodeBounds(node, nds);

        return nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                parentNode: undefined,
                position: { x: nodeBounds.x, y: nodeBounds.y },
              }
            : n
        );
      });
    },
    [setNodes]
  );

  // Delete selected element (node or edge)
  const handleDelete = useCallback(() => {
    if (!selectedElement) return;

    if (selectedElement.type === 'node') {
      setNodes((nds) => nds.filter((n) => n.id !== selectedElement.data.id));
      // Also remove edges connected to this node
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

  // Update node data
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

  // Update edge data
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

  // Save to TinaCMS
  const handleSaveData = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await tinaClient.request({
        query: UPDATE_MINDMAP_MUTATION,
        variables: {
          relativePath: 'index.json',
          data: {
            nodes: JSON.stringify(nodes),
            edges: JSON.stringify(edges),
          },
        },
      });
      setSaveStatus('success');
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
    }

    setTimeout(() => setSaveStatus(null), 2500);
  }, [nodes, edges]);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Custom styles for ReactFlow */}
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

      {/* Admin Controls - Top Left */}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#059669';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#10b981';
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
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#4f46e5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#6366f1';
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

      {/* ReactFlow canvas */}
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

      {/* Info panel */}
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
