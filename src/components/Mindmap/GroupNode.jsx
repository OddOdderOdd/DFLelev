// src/components/Mindmap/GroupNode.jsx
import React, { useState, useRef, useCallback } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useAdmin } from '../../context/AdminContext';

const GroupNode = ({ data, id }) => {
  const { setNodes } = useReactFlow();
  const { isAdmin } = useAdmin();
  const [isDraggingLabel, setIsDraggingLabel] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const labelStartPos = useRef({ x: 0, y: 0 });

  // Define 16 connection points around the perimeter (4 per edge)
  const handles = [
    // Top edge
    { id: 't-1', position: Position.Top, style: { left: '12.5%' } },
    { id: 't-2', position: Position.Top, style: { left: '37.5%' } },
    { id: 't-3', position: Position.Top, style: { left: '62.5%' } },
    { id: 't-4', position: Position.Top, style: { left: '87.5%' } },
    // Right edge
    { id: 'r-1', position: Position.Right, style: { top: '12.5%' } },
    { id: 'r-2', position: Position.Right, style: { top: '37.5%' } },
    { id: 'r-3', position: Position.Right, style: { top: '62.5%' } },
    { id: 'r-4', position: Position.Right, style: { top: '87.5%' } },
    // Bottom edge
    { id: 'b-1', position: Position.Bottom, style: { left: '12.5%' } },
    { id: 'b-2', position: Position.Bottom, style: { left: '37.5%' } },
    { id: 'b-3', position: Position.Bottom, style: { left: '62.5%' } },
    { id: 'b-4', position: Position.Bottom, style: { left: '87.5%' } },
    // Left edge
    { id: 'l-1', position: Position.Left, style: { top: '12.5%' } },
    { id: 'l-2', position: Position.Left, style: { top: '37.5%' } },
    { id: 'l-3', position: Position.Left, style: { top: '62.5%' } },
    { id: 'l-4', position: Position.Left, style: { top: '87.5%' } },
  ];

  // Handle style - visible in admin mode, invisible otherwise
  const handleStyle = isAdmin
    ? {
        width: '10px',
        height: '10px',
        border: '2px solid #3b82f6',
        background: '#ffffff',
        borderRadius: '50%',
        opacity: 1,
      }
    : {
        width: '1px',
        height: '1px',
        border: 'none',
        background: 'transparent',
        opacity: 0,
        pointerEvents: 'none',
      };

  // Get label position from data or use default
  const labelPos = data.labelPosition || { x: 0, y: 8 };

  const handleLabelMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDraggingLabel(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    labelStartPos.current = { ...labelPos };
    
    // Disable node dragging by marking it as non-draggable
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, draggable: false }
          : node
      )
    );
  }, [id, labelPos, setNodes]);

  const handleLabelMouseMove = useCallback((e) => {
    if (!isDraggingLabel) return;

    e.preventDefault();
    e.stopPropagation();

    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;

    const newX = labelStartPos.current.x + dx;
    const newY = labelStartPos.current.y + dy;

    // Get group dimensions from style or use defaults
    const groupWidth = data.groupWidth || 300;
    const groupHeight = data.groupHeight || 200;
    const labelHeight = 30;

    // Constrain label within group bounds
    const constrainedX = Math.max(-groupWidth / 2 + 50, Math.min(groupWidth / 2 - 50, newX));
    const constrainedY = Math.max(8, Math.min(groupHeight - labelHeight - 8, newY));

    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                labelPosition: { x: constrainedX, y: constrainedY },
                groupWidth: node.style?.width || 300,
                groupHeight: node.style?.height || 200,
              },
            }
          : node
      )
    );
  }, [isDraggingLabel, id, data.groupWidth, data.groupHeight, setNodes]);

  const handleLabelMouseUp = useCallback((e) => {
    if (isDraggingLabel) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setIsDraggingLabel(false);
    
    // Re-enable node dragging
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, draggable: true }
          : node
      )
    );
  }, [isDraggingLabel, id, setNodes]);

  // Add global event listeners for label dragging
  React.useEffect(() => {
    if (isDraggingLabel) {
      const handleMove = (e) => handleLabelMouseMove(e);
      const handleUp = (e) => handleLabelMouseUp(e);
      
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
    }
  }, [isDraggingLabel, handleLabelMouseMove, handleLabelMouseUp]);

  return (
    <>
      {/* Source handles */}
      {handles.map((handle) => (
        <Handle
          key={handle.id}
          type="source"
          position={handle.position}
          id={handle.id}
          style={{ ...handle.style, ...handleStyle }}
        />
      ))}

      {/* Target handles */}
      {handles.map((handle) => (
        <Handle
          key={`${handle.id}-target`}
          type="target"
          position={handle.position}
          id={`${handle.id}-target`}
          style={{ ...handle.style, ...handleStyle }}
        />
      ))}

      {/* Group container */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '8px',
          border: `3px solid ${data.borderColor}`,
          backgroundColor: data.backgroundColor,
          position: 'relative',
          minWidth: '200px',
          minHeight: '150px',
        }}
      >
        {/* Draggable group label */}
        <div
          onMouseDown={handleLabelMouseDown}
          style={{
            position: 'absolute',
            top: `${labelPos.y}px`,
            left: '50%',
            transform: `translateX(calc(-50% + ${labelPos.x}px))`,
            fontSize: '18px',
            fontWeight: 'bold',
            color: data.labelColor,
            whiteSpace: 'nowrap',
            padding: '4px 10px',
            maxWidth: '90%',
            overflow: 'visible',
            textAlign: 'center',
            cursor: isDraggingLabel ? 'grabbing' : 'grab',
            userSelect: 'none',
            zIndex: 10,
            backgroundColor: isDraggingLabel ? 'rgba(255, 255, 255, 0.5)' : 'transparent',
            borderRadius: '4px',
            transition: isDraggingLabel ? 'none' : 'background-color 0.2s',
            pointerEvents: 'auto',
          }}
        >
          {data.label}
        </div>
      </div>
    </>
  );
};

export default GroupNode;
