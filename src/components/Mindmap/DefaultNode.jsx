// src/components/Mindmap/DefaultNode.jsx
import React, { useRef, useEffect, useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useAdmin } from '../../context/AdminContext';

const DefaultNode = ({ data, id }) => {
  const measureRef = useRef(null);
  const { setNodes } = useReactFlow();
  const { isAdmin } = useAdmin();
  const [localWidth, setLocalWidth] = useState(data.computedWidth || 150);

  // Auto-resize node based on text content
  useEffect(() => {
    if (measureRef.current) {
      // Measure the actual text width
      const textWidth = measureRef.current.offsetWidth;
      
      // Calculate content width (min 120, max 350)
      const contentWidth = Math.max(120, Math.min(350, textWidth));
      
      // Calculate total node width: content + padding (16px * 2) + border (2px * 2)
      const totalWidth = contentWidth + 32 + 4;

      // Only update if width actually changed
      if (Math.abs(localWidth - totalWidth) > 2) {
        setLocalWidth(totalWidth);
        setNodes((nodes) =>
          nodes.map((node) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    computedWidth: totalWidth,
                  },
                }
              : node
          )
        );
      }
    }
  }, [id, setNodes, data.label, localWidth]);

  // Define 8 connection handles with offset for better arrow positioning
  const handleOffset = 8; // pixels offset from edge
  
  const handles = [
    { id: 'top', position: Position.Top, style: { left: '50%', top: `-${handleOffset}px` } },
    { id: 'right', position: Position.Right, style: { top: '50%', right: `-${handleOffset}px` } },
    { id: 'bottom', position: Position.Bottom, style: { left: '50%', bottom: `-${handleOffset}px` } },
    { id: 'left', position: Position.Left, style: { top: '50%', left: `-${handleOffset}px` } },
    { id: 'top-right', position: Position.Top, style: { left: '75%', top: `-${handleOffset}px` } },
    { id: 'top-left', position: Position.Top, style: { left: '25%', top: `-${handleOffset}px` } },
    { id: 'bottom-right', position: Position.Bottom, style: { left: '75%', bottom: `-${handleOffset}px` } },
    { id: 'bottom-left', position: Position.Bottom, style: { left: '25%', bottom: `-${handleOffset}px` } },
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

      {/* Invisible measurement div */}
      <div
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          fontSize: '14px',
          fontWeight: 500,
          pointerEvents: 'none',
        }}
      >
        {data.label}
      </div>

      {/* Node content */}
      <div
        style={{
          width: `${localWidth}px`,
          height: '36px',
          borderRadius: '6px',
          border: `2px solid ${data.borderColor || '#64748b'}`,
          backgroundColor: data.backgroundColor || '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: data.textColor || '#334155',
            whiteSpace: 'nowrap',
          }}
        >
          {data.label}
        </div>
      </div>
    </>
  );
};

export default DefaultNode;
