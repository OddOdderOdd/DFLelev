// src/components/Mindmap/InfoPanel.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';

const InfoPanel = ({
  element,
  onClose,
  onNodeUpdate,
  onEdgeUpdate,
  onDelete,
  groupNodes = [],
  onAssignNodeToGroup,
  onRemoveNodeFromGroup,
}) => {
  const { isEditingText, isAdmin } = useAdmin();
  const isNode = element.type === 'node';
  const isEdge = element.type === 'edge';
  const isGroupNode = isNode && element.data.type === 'groupNode';

  // Node state
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  
  // Node color state
  const [borderColor, setBorderColor] = useState('#64748b');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#334155');

  // Edge state
  const [edgeLabel, setEdgeLabel] = useState('');
  const [isAnimated, setIsAnimated] = useState(false);
  const [hasStartArrow, setHasStartArrow] = useState(false);
  const [hasEndArrow, setHasEndArrow] = useState(false);
  const [edgeColor, setEdgeColor] = useState('#334155');

  // Initialize state based on element type
  useEffect(() => {
    if (isNode) {
      setLabel(element.data.data?.label || '');
      setDescription(element.data.data?.description || '');
      setLinkUrl(element.data.data?.linkUrl || '/ressourcer');
      setBorderColor(element.data.data?.borderColor || '#64748b');
      setBackgroundColor(element.data.data?.backgroundColor || '#ffffff');
      setTextColor(element.data.data?.textColor || '#334155');
      setSelectedGroup(element.data.parentNode || '');
    } else if (isEdge) {
      setEdgeLabel(element.data.label || '');
      setIsAnimated(element.data.animated || false);
      setHasStartArrow(!!element.data.markerStart);
      setHasEndArrow(!!element.data.markerEnd);
      setEdgeColor(element.data.style?.stroke || '#334155');
    }
  }, [element, isNode, isEdge]);

  // Handle node label change
  const handleLabelChange = (e) => {
    const newLabel = e.target.value;
    setLabel(newLabel);
    onNodeUpdate({ label: newLabel });
  };

  // Handle node description change
  const handleDescriptionChange = (e) => {
    const newDescription = e.target.value;
    setDescription(newDescription);
    onNodeUpdate({ description: newDescription });
  };

  // Handle link URL change
  const handleLinkUrlChange = (e) => {
    const newUrl = e.target.value;
    setLinkUrl(newUrl);
    onNodeUpdate({ linkUrl: newUrl });
  };

  // Handle node border color change
  const handleBorderColorChange = (e) => {
    const newColor = e.target.value;
    setBorderColor(newColor);
    onNodeUpdate({ borderColor: newColor });
  };

  // Handle node background color change
  const handleBackgroundColorChange = (e) => {
    const newColor = e.target.value;
    setBackgroundColor(newColor);
    onNodeUpdate({ backgroundColor: newColor });
  };

  // Handle node text color change
  const handleTextColorChange = (e) => {
    const newColor = e.target.value;
    setTextColor(newColor);
    onNodeUpdate({ textColor: newColor });
  };

  // Handle edge label change
  const handleEdgeLabelChange = (e) => {
    const newLabel = e.target.value;
    setEdgeLabel(newLabel);
    onEdgeUpdate({
      ...element.data,
      label: newLabel || undefined,
    });
  };

  // Handle edge color change
  const handleEdgeColorChange = (e) => {
    const newColor = e.target.value;
    setEdgeColor(newColor);
    
    const updatedEdge = {
      ...element.data,
      style: {
        ...element.data.style,
        stroke: newColor,
      },
    };

    // Update marker colors too
    if (element.data.markerEnd) {
      updatedEdge.markerEnd = { ...element.data.markerEnd, color: newColor };
    }
    if (element.data.markerStart) {
      updatedEdge.markerStart = { ...element.data.markerStart, color: newColor };
    }

    onEdgeUpdate(updatedEdge);
  };

  const handleGroupSelectionChange = (event) => {
    const nextGroupId = event.target.value;
    setSelectedGroup(nextGroupId);

    if (!nextGroupId) {
      onRemoveNodeFromGroup?.(element.data.id);
      return;
    }

    onAssignNodeToGroup?.(element.data.id, nextGroupId);
  };

  // Handle edge animated toggle
  const handleAnimatedToggle = () => {
    const newAnimated = !isAnimated;
    setIsAnimated(newAnimated);
    onEdgeUpdate({
      ...element.data,
      animated: newAnimated || undefined,
    });
  };

  // Handle start arrow toggle
  const handleStartArrowToggle = () => {
    const newHasStartArrow = !hasStartArrow;
    setHasStartArrow(newHasStartArrow);
    
    onEdgeUpdate({
      ...element.data,
      markerStart: newHasStartArrow
        ? { type: 'arrowclosed', color: edgeColor }
        : undefined,
    });
  };

  // Handle end arrow toggle
  const handleEndArrowToggle = () => {
    const newHasEndArrow = !hasEndArrow;
    setHasEndArrow(newHasEndArrow);
    
    onEdgeUpdate({
      ...element.data,
      markerEnd: newHasEndArrow
        ? { type: 'arrowclosed', color: edgeColor }
        : undefined,
    });
  };

  if (!element) return null;

  // Get header title
  const headerTitle = isNode
    ? label || 'Node'
    : `Forbindelse: ${element.data.source} → ${element.data.target}`;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '380px',
        height: '100vh',
        backgroundColor: '#ffffff',
        boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {isNode && isEditingText ? (
          <input
            type="text"
            value={label}
            onChange={handleLabelChange}
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#1e293b',
              margin: 0,
              flex: 1,
              paddingRight: '16px',
              border: '2px solid #3b82f6',
              borderRadius: '4px',
              padding: '8px 12px',
              outline: 'none',
            }}
          />
        ) : (
          <h2
            style={{
              fontSize: isEdge ? '16px' : '20px',
              fontWeight: 700,
              color: '#1e293b',
              margin: 0,
              flex: 1,
              paddingRight: '16px',
              wordBreak: 'break-word',
            }}
          >
            {headerTitle}
          </h2>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#f1f5f9',
            color: '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 600,
            transition: 'background-color 0.2s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e2e8f0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f1f5f9';
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          padding: '24px',
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {/* NODE CONTENT */}
        {isNode && (
          <>
            {/* Color Pickers - Admin Mode Only */}
            {isAdmin && (
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#64748b',
                    marginBottom: '12px',
                  }}
                >
                  🎨 Farver
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        color: '#64748b',
                        marginBottom: '4px',
                      }}
                    >
                      Kant
                    </label>
                    <input
                      type="color"
                      value={borderColor}
                      onChange={handleBorderColorChange}
                      style={{
                        width: '100%',
                        height: '36px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        color: '#64748b',
                        marginBottom: '4px',
                      }}
                    >
                      Baggrund
                    </label>
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={handleBackgroundColorChange}
                      style={{
                        width: '100%',
                        height: '36px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        color: '#64748b',
                        marginBottom: '4px',
                      }}
                    >
                      Tekst
                    </label>
                    <input
                      type="color"
                      value={textColor}
                      onChange={handleTextColorChange}
                      style={{
                        width: '100%',
                        height: '36px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {isAdmin && !isGroupNode && (
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#64748b',
                    marginBottom: '12px',
                  }}
                >
                  🗂️ Gruppe
                </div>
                <select
                  value={selectedGroup}
                  onChange={handleGroupSelectionChange}
                  style={{
                    width: '100%',
                    fontSize: '14px',
                    padding: '10px 12px',
                    border: '2px solid #cbd5e1',
                    borderRadius: '6px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">Ingen gruppe</option>
                  {groupNodes.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.data?.label || group.id}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#64748b',
                    marginTop: '6px',
                  }}
                >
                  Vælg en gruppe for at låse noden inde i den.
                </div>
              </div>
            )}

            {isEditingText ? (
              <>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#64748b',
                    marginBottom: '8px',
                  }}
                >
                  Beskrivelse
                </label>
                <textarea
                  value={description}
                  onChange={handleDescriptionChange}
                  placeholder="Tilføj en beskrivelse..."
                  style={{
                    width: '100%',
                    minHeight: '150px',
                    fontSize: '15px',
                    lineHeight: '1.6',
                    color: '#475569',
                    border: '2px solid #3b82f6',
                    borderRadius: '6px',
                    padding: '12px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                    marginBottom: '16px',
                  }}
                />

                {/* Link URL Editor */}
                {isAdmin && (
                  <div style={{ marginBottom: '16px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#64748b',
                        marginBottom: '8px',
                      }}
                    >
                      "Læs mere" knap link
                    </label>
                    <input
                      type="text"
                      value={linkUrl}
                      onChange={handleLinkUrlChange}
                      placeholder="/ressourcer"
                      style={{
                        width: '100%',
                        fontSize: '14px',
                        padding: '10px 12px',
                        border: '2px solid #3b82f6',
                        borderRadius: '6px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#64748b',
                        marginTop: '4px',
                      }}
                    >
                      Eksempel: /ressourcer, /om, https://example.com
                    </div>
                  </div>
                )}

                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#1e40af',
                  }}
                >
                  💡 Ændringer gemmes automatisk når du skriver
                </div>
              </>
            ) : (
              <>
                {description ? (
                  <>
                    <p
                      style={{
                        fontSize: '15px',
                        lineHeight: '1.6',
                        color: '#475569',
                        margin: '0 0 24px 0',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {description}
                    </p>
                    <Link
                      to={linkUrl || '/ressourcer'}
                      style={{
                        display: 'inline-block',
                        padding: '10px 20px',
                        backgroundColor: '#3b82f6',
                        color: '#ffffff',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: 600,
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2563eb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#3b82f6';
                      }}
                    >
                      Læs mere
                    </Link>
                  </>
                ) : (
                  <p
                    style={{
                      fontSize: '15px',
                      lineHeight: '1.6',
                      color: '#94a3b8',
                      margin: 0,
                      fontStyle: 'italic',
                    }}
                  >
                    Ingen beskrivelse tilgængelig.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {/* EDGE CONTENT */}
        {isEdge && isAdmin && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#64748b',
                  marginBottom: '8px',
                }}
              >
                Farve
              </label>
              <input
                type="color"
                value={edgeColor}
                onChange={handleEdgeColorChange}
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#64748b',
                  marginBottom: '8px',
                }}
              >
                Label (valgfrit)
              </label>
              <input
                type="text"
                value={edgeLabel}
                onChange={handleEdgeLabelChange}
                placeholder="Tilføj en label til forbindelsen..."
                style={{
                  width: '100%',
                  fontSize: '14px',
                  padding: '10px 12px',
                  border: '2px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
              >
                <input
                  type="checkbox"
                  checked={isAnimated}
                  onChange={handleAnimatedToggle}
                  style={{
                    cursor: 'pointer',
                    width: '18px',
                    height: '18px',
                  }}
                />
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#334155',
                  }}
                >
                  Stiplet linje (animeret)
                </span>
              </label>
            </div>

            <div
              style={{
                marginBottom: '12px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#64748b',
              }}
            >
              Pile
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
              >
                <input
                  type="checkbox"
                  checked={hasStartArrow}
                  onChange={handleStartArrowToggle}
                  style={{
                    cursor: 'pointer',
                    width: '18px',
                    height: '18px',
                  }}
                />
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#334155',
                  }}
                >
                  ← Pil i starten
                </span>
              </label>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
              >
                <input
                  type="checkbox"
                  checked={hasEndArrow}
                  onChange={handleEndArrowToggle}
                  style={{
                    cursor: 'pointer',
                    width: '18px',
                    height: '18px',
                  }}
                />
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#334155',
                  }}
                >
                  Pil i enden →
                </span>
              </label>
            </div>

            <div
              style={{
                padding: '12px',
                backgroundColor: '#eff6ff',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#1e40af',
              }}
            >
              💡 Ændringer gemmes automatisk
            </div>
          </>
        )}
      </div>

      {/* Delete Button - Bottom (Admin only) */}
      {isAdmin && (
        <div
          style={{
            padding: '20px 24px',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <button
            onClick={onDelete}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444';
            }}
          >
            🗑️ Slet {isNode ? 'node' : 'forbindelse'}
          </button>
        </div>
      )}
    </div>
  );
};

export default InfoPanel;
