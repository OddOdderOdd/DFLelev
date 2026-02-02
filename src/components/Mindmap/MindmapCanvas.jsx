// src/components/Mindmap/MindmapCanvas.jsx
import React, { useCallback, useState, useMemo, useRef } from 'react';
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

/**
 * Clean node data for export (remove React Flow internals)
 */
const ALLOWED_NODE_KEYS = ['id', 'type', 'data', 'position', 'style', 'parentNode', 'draggable'];

function cleanNode(node) {
  const clean = {};
  ALLOWED_NODE_KEYS.forEach((key) => {
    if (node[key] !== undefined) {
      clean[key] = node[key];
    }
  });

  // Preserve labelPosition and group dimensions for group nodes
  if (node.data) {
    if (node.data.labelPosition) {
      clean.data = {
        ...clean.data,
        labelPosition: node.data.labelPosition,
      };
    }
    if (node.data.groupWidth !== undefined) {
      clean.data = {
        ...clean.data,
        groupWidth: node.data.groupWidth,
      };
    }
    if (node.data.groupHeight !== undefined) {
      clean.data = {
        ...clean.data,
        groupHeight: node.data.groupHeight,
      };
    }
  }

  return clean;
}

/**
 * Clean edge data for export (remove React Flow internals)
 */
const ALLOWED_EDGE_KEYS = ['id', 'source', 'target', 'type', 'animated', 'style', 'markerEnd', 'markerStart', 'label'];

function cleanEdge(edge) {
  const clean = {};
  ALLOWED_EDGE_KEYS.forEach((key) => {
    if (edge[key] !== undefined) {
      clean[key] = edge[key];
    }
  });
  return clean;
}

/**
 * Format nodes array as JavaScript code for export
 */
function formatNodesArray(nodes) {
  const cleaned = nodes.map(cleanNode);

  const lines = cleaned.map((node) => {
    const entries = [];

    entries.push(`    id: '${node.id}'`);
    entries.push(`    type: '${node.type}'`);

    // Format data object
    const dataEntries = [];
    Object.entries(node.data).forEach(([k, v]) => {
      if (k === 'labelPosition' && typeof v === 'object') {
        dataEntries.push(`${k}: { x: ${Math.round(v.x)}, y: ${Math.round(v.y)} }`);
      } else if (k === 'description' && typeof v === 'string') {
        const escaped = v.replace(/'/g, "\\'").replace(/\n/g, '\\n');
        dataEntries.push(`${k}: '${escaped}'`);
      } else if (k === 'computedWidth') {
        // Skip computedWidth from export
        return;
      } else {
        dataEntries.push(`${k}: ${typeof v === 'string' ? `'${v}'` : v}`);
      }
    });
    entries.push(`    data: { ${dataEntries.join(', ')} }`);

    entries.push(
      `    position: { x: ${Math.round(node.position.x)}, y: ${Math.round(node.position.y)} }`
    );

    if (node.style) {
      const styleEntries = Object.entries(node.style)
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v}'` : v}`)
        .join(', ');
      entries.push(`    style: { ${styleEntries} }`);
    }

    if (node.parentNode) {
      entries.push(`    parentNode: '${node.parentNode}'`);
    }

    if (node.draggable !== undefined) {
      entries.push(`    draggable: ${node.draggable}`);
    }

    return `  {\n${entries.join(',\n')},\n  }`;
  });

  return `export const initialNodes = [\n${lines.join(',\n')},\n];\n`;
}

/**
 * Format edges array as JavaScript code for export
 */
function formatEdgesArray(edges) {
  const cleaned = edges.map(cleanEdge);

  const lines = cleaned.map((edge) => {
    const entries = [];

    entries.push(`    id: '${edge.id}'`);
    entries.push(`    source: '${edge.source}'`);
    entries.push(`    target: '${edge.target}'`);
    entries.push(`    type: '${edge.type}'`);

    if (edge.animated) {
      entries.push(`    animated: ${edge.animated}`);
    }

    if (edge.style) {
      const styleEntries = Object.entries(edge.style)
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v}'` : v}`)
        .join(', ');
      entries.push(`    style: { ${styleEntries} }`);
    }

    if (edge.markerEnd) {
      const markerEntries = Object.entries(edge.markerEnd)
        .map(([k, v]) => `${k}: '${v}'`)
        .join(', ');
      entries.push(`    markerEnd: { ${markerEntries} }`);
    }

    if (edge.markerStart) {
      const markerEntries = Object.entries(edge.markerStart)
        .map(([k, v]) => `${k}: '${v}'`)
        .join(', ');
      entries.push(`    markerStart: { ${markerEntries} }`);
    }

    if (edge.label) {
      const escaped = edge.label.replace(/'/g, "\\'");
      entries.push(`    label: '${escaped}'`);
    }

    return `  {\n${entries.join(',\n')},\n  }`;
  });

  return `export const initialEdges = [\n${lines.join(',\n')},\n];\n`;
}

/**
 * Download multiple files as a zip (using JSZip-like functionality via blob)
 */
async function downloadMultipleFiles(files) {
  // If only one file, download directly
  if (files.length === 1) {
    const { filename, content } = files[0];
    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  // For multiple files, download them one by one
  for (const { filename, content } of files) {
    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Small delay between downloads
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// ──────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────

const MindmapCanvas = () => {
  const { isAdmin, isEditingText, toggleAdmin, toggleTextEdit } = useAdmin();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [copyStatus, setCopyStatus] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null); // Can be node or edge
  const isPanningRef = useRef(false);
  const nodeIdCounter = useRef(1000); // Start high to avoid conflicts

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

  // Download all relevant files
  const handleDownloadData = useCallback(async () => {
    const nodesCode = formatNodesArray(nodes);
    const edgesCode = formatEdgesArray(edges);
    const mindmapDataCode = `// src/components/Mindmap/MindmapData.js\n\n${nodesCode}\n${edgesCode}`;

    const files = [
      {
        filename: 'MindmapData.js',
        content: mindmapDataCode,
      },
    ];

    try {
      await downloadMultipleFiles(files);
      setCopyStatus('success');
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new window
      const w = window.open('', '_blank');
      w.document.write(
        '<pre style="padding:20px;font-size:13px;white-space:pre-wrap;">' +
          mindmapDataCode.replace(/</g, '&lt;') +
          '</pre>'
      );
      w.document.close();
      setCopyStatus('error');
    }

    setTimeout(() => setCopyStatus(null), 2500);
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
            onClick={handleDownloadData}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              backgroundColor:
                copyStatus === 'success'
                  ? '#16a34a'
                  : copyStatus === 'error'
                  ? '#ea580c'
                  : '#3b82f6',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              transition: 'background-color 0.2s',
              userSelect: 'none',
            }}
          >
            {copyStatus === 'success'
              ? '✅ Downloadet!'
              : copyStatus === 'error'
              ? '📄 Åbnet i nyt vindue'
              : '💾 Download Filer'}
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

      {/* Admin Mode Toggle - Top Right */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '6px',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        }}
      >
        <label
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#334155',
            cursor: 'pointer',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={toggleAdmin}
            style={{
              cursor: 'pointer',
              width: '16px',
              height: '16px',
            }}
          />
          Admin tools
        </label>
      </div>

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
        />
      )}
    </div>
  );
};

export default MindmapCanvas;
