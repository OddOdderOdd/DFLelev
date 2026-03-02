// src/components/Mindmap/InfoPanel.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';

const EMPTY_NODE_RULE = {
  editContentRoles: [],
  editColorRoles: [],
  deleteNodeRoles: [],
  editAssociationRoles: [],
};
const DEFAULT_ROLE_META = { kind: 'authority', parentRole: null, canManageUnderRole: false, scopeKind: null };

function normalizeTabId(input = '') {
  const clean = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'authority';
}

function getTabForRole(rolle, metaMap, tabs) {
  const meta = metaMap?.[rolle] || DEFAULT_ROLE_META;
  const candidate = meta.kind === 'box' ? (meta.scopeKind || 'authority') : (meta.kind || 'authority');
  const id = normalizeTabId(candidate);
  return (tabs || []).some((tab) => tab.id === id) ? id : 'authority';
}

function normalizeNodeRule(rule = {}) {
  return {
    editContentRoles: Array.isArray(rule.editContentRoles) ? rule.editContentRoles : [],
    editColorRoles: Array.isArray(rule.editColorRoles) ? rule.editColorRoles : [],
    deleteNodeRoles: Array.isArray(rule.deleteNodeRoles) ? rule.deleteNodeRoles : [],
    editAssociationRoles: Array.isArray(rule.editAssociationRoles) ? rule.editAssociationRoles : [],
  };
}

function nodeRuleToRows(rule = EMPTY_NODE_RULE) {
  const normalized = normalizeNodeRule(rule);
  const roles = new Set([
    ...normalized.editContentRoles,
    ...normalized.editColorRoles,
    ...normalized.deleteNodeRoles,
    ...normalized.editAssociationRoles,
  ]);
  return [...roles].map((rolle) => ({
    id: `row-${rolle}`,
    rolle,
    canEditContent: normalized.editContentRoles.includes(rolle),
    canEditColor: normalized.editColorRoles.includes(rolle),
    canDelete: normalized.deleteNodeRoles.includes(rolle),
    canEditAssociation: normalized.editAssociationRoles.includes(rolle),
  }));
}

function rowsToNodeRule(rows = []) {
  const nextRule = {
    editContentRoles: [],
    editColorRoles: [],
    deleteNodeRoles: [],
    editAssociationRoles: [],
  };
  rows.forEach((row) => {
    if (!row.rolle) return;
    if (row.canEditContent) nextRule.editContentRoles.push(row.rolle);
    if (row.canEditColor) nextRule.editColorRoles.push(row.rolle);
    if (row.canDelete) nextRule.deleteNodeRoles.push(row.rolle);
    if (row.canEditAssociation) nextRule.editAssociationRoles.push(row.rolle);
  });
  return nextRule;
}

const InfoPanel = ({
  element,
  onClose,
  onNodeUpdate,
  onEdgeUpdate,
  onDelete,
  groupNodes = [],
  onAssignNodeToGroup,
  onRemoveNodeFromGroup,
  canUseMindmapControl = false,
  canConfigurePermissions = false,
  availableRoles = [],
  roleTabs = [],
  roleMetaMap = {},
  topRolesByTab = {},
  underRoller = {},
  nodePermissionRule = null,
  nodeCapabilities = null,
  onNodePermissionChange,
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
  const [showNodeKeyPanel, setShowNodeKeyPanel] = useState(false);
  const [nodePermissionRows, setNodePermissionRows] = useState([]);

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

  useEffect(() => {
    if (!isNode) return;
    const rows = nodeRuleToRows(nodePermissionRule || EMPTY_NODE_RULE).map((row) => {
      const tabId = getTabForRole(row.rolle, roleMetaMap, roleTabs);
      const parentRole = roleMetaMap[row.rolle]?.parentRole || null;
      return {
        ...row,
        uiTabId: tabId,
        uiTopRole: parentRole || row.rolle,
      };
    });
    setNodePermissionRows(rows);
  }, [isNode, isGroupNode, nodePermissionRule, element.data?.id, roleMetaMap, roleTabs]);

  useEffect(() => {
    if (!isNode) setShowNodeKeyPanel(false);
  }, [isNode, isGroupNode, element.data?.id]);

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

  const canEditContent = canUseMindmapControl || !!nodeCapabilities?.canEditContent;
  const canEditColor = canUseMindmapControl || !!nodeCapabilities?.canEditColor;
  const canDeleteNode = canUseMindmapControl || !!nodeCapabilities?.canDeleteNode;
  const canEditAssociation = canUseMindmapControl || !!nodeCapabilities?.canEditAssociation;

  const updateNodePermissionRows = (nextRows) => {
    setNodePermissionRows(nextRows);
    onNodePermissionChange?.(element.data.id, rowsToNodeRule(nextRows));
  };

  const addNodePermissionRole = () => {
    if (!isNode) return;
    const used = new Set(nodePermissionRows.map((row) => row.rolle));
    const defaultTabId = roleTabs[0]?.id || 'authority';
    const topRoles = topRolesByTab[defaultTabId] || [];
    const nextRole = topRoles.find((rolle) => !used.has(rolle)) || availableRoles.find((rolle) => !used.has(rolle)) || availableRoles[0];
    if (!nextRole) return;
    updateNodePermissionRows([
      ...nodePermissionRows,
      {
        id: `row-${nextRole}-${Date.now()}`,
        rolle: nextRole,
        uiTabId: getTabForRole(nextRole, roleMetaMap, roleTabs),
        uiTopRole: roleMetaMap[nextRole]?.parentRole || nextRole,
        canEditContent: true,
        canEditColor: false,
        canDelete: false,
        canEditAssociation: false,
      },
    ]);
  };

  const updateNodePermissionRow = (index, patch) => {
    if (!isNode) return;
    const nextRows = nodePermissionRows.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const next = { ...row, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'uiTabId')) {
        const tabTopRoles = topRolesByTab[patch.uiTabId] || [];
        const nextTop = tabTopRoles[0] || next.uiTopRole || next.rolle;
        const children = underRoller[nextTop] || [];
        return {
          ...next,
          uiTabId: patch.uiTabId,
          uiTopRole: nextTop,
          rolle: children.includes(next.rolle) || next.rolle === nextTop ? next.rolle : nextTop,
        };
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'uiTopRole')) {
        const children = underRoller[patch.uiTopRole] || [];
        const resolvedRole = children.includes(next.rolle) ? next.rolle : patch.uiTopRole;
        return { ...next, uiTopRole: patch.uiTopRole, rolle: resolvedRole };
      }
      return next;
    });
    updateNodePermissionRows(nextRows);
  };

  const removeNodePermissionRow = (index) => {
    if (!isNode) return;
    const nextRows = nodePermissionRows.filter((_, rowIndex) => rowIndex !== index);
    updateNodePermissionRows(nextRows);
  };

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
        {isNode && isEditingText && canEditContent ? (
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isNode && isAdmin && canConfigurePermissions && (
            <button
              onClick={() => setShowNodeKeyPanel((prev) => !prev)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: showNodeKeyPanel ? '#0f172a' : '#f1f5f9',
                color: showNodeKeyPanel ? '#ffffff' : '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 600,
                transition: 'background-color 0.2s',
                flexShrink: 0,
              }}
              title="Node adgang"
            >
              🔑
            </button>
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
            {canEditColor && (
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

            {canEditAssociation && !isGroupNode && (
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

            {isEditingText && canEditContent ? (
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
                {canEditAssociation && (
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
                  <>
                    <p
                      style={{
                        fontSize: '15px',
                        lineHeight: '1.6',
                        color: '#94a3b8',
                        margin: '0 0 16px 0',
                        fontStyle: 'italic',
                      }}
                    >
                      Ingen beskrivelse tilgængelig.
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
                )}
              </>
            )}
          </>
        )}

        {/* EDGE CONTENT */}
        {isEdge && canUseMindmapControl && (
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
      {((isNode && canDeleteNode) || (isEdge && canUseMindmapControl)) && (
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

      {isNode && isAdmin && canConfigurePermissions && showNodeKeyPanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex' }}>
          <div
            style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
            onClick={() => setShowNodeKeyPanel(false)}
          />
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              height: '100%',
              backgroundColor: '#ffffff',
              boxShadow: '-4px 0 16px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
                  Node adgang
                </div>
                <h3 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  🔑 Node kontrol
                </h3>
              </div>
              <button
                onClick={() => setShowNodeKeyPanel(false)}
                style={{
                  border: 'none',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
                title="Luk panel"
              >
                ×
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'grid', gap: '10px' }}>
              <div style={{ fontSize: '13px', color: '#475569' }}>
                Vælg roller og rettigheder for denne node.
              </div>

              {nodePermissionRows.length === 0 && (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Ingen roller endnu. Tryk på &quot;+ Tilføj rolle&quot;.
                </div>
              )}

              {nodePermissionRows.map((row, index) => (
                <div
                  key={row.id || `${row.rolle}-${index}`}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    backgroundColor: '#f8fafc',
                    display: 'grid',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={row.uiTabId || roleTabs[0]?.id || 'authority'}
                      onChange={(event) => updateNodePermissionRow(index, { uiTabId: event.target.value })}
                      style={{
                        flex: 1,
                        fontSize: '13px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      {roleTabs.map((tab) => (
                        <option key={`${row.id}-tab-${tab.id}`} value={tab.id}>
                          {tab.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={row.uiTopRole || row.rolle}
                      onChange={(event) => updateNodePermissionRow(index, { uiTopRole: event.target.value })}
                      style={{
                        flex: 1,
                        fontSize: '13px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      {(topRolesByTab[row.uiTabId || roleTabs[0]?.id || 'authority'] || []).map((rolle) => (
                        <option key={`${row.id}-${rolle}`} value={rolle}>
                          {rolle}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeNodePermissionRow(index)}
                      style={{
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '14px',
                        lineHeight: 1,
                      }}
                      title="Fjern rolle"
                    >
                      ✕
                    </button>
                  </div>
                  {!!underRoller[row.uiTopRole || row.rolle]?.length && (
                    <select
                      value={(underRoller[row.uiTopRole || row.rolle] || []).includes(row.rolle) ? row.rolle : ''}
                      onChange={(event) => {
                        const selected = event.target.value;
                        if (!selected) {
                          updateNodePermissionRow(index, { rolle: row.uiTopRole || row.rolle });
                          return;
                        }
                        updateNodePermissionRow(index, { rolle: selected });
                      }}
                      style={{
                        width: '100%',
                        fontSize: '13px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <option value="">Ingen underrolle</option>
                      {(underRoller[row.uiTopRole || row.rolle] || []).map((rolle) => (
                        <option key={`${row.id}-sub-${rolle}`} value={rolle}>
                          {rolle}
                        </option>
                      ))}
                    </select>
                  )}

                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' }}>
                      <input
                        type="checkbox"
                        checked={!!row.canEditContent}
                        onChange={(event) => updateNodePermissionRow(index, { canEditContent: event.target.checked })}
                      />
                      Rediger indhold
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' }}>
                      <input
                        type="checkbox"
                        checked={!!row.canEditColor}
                        onChange={(event) => updateNodePermissionRow(index, { canEditColor: event.target.checked })}
                      />
                      Rediger farver
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' }}>
                      <input
                        type="checkbox"
                        checked={!!row.canDelete}
                        onChange={(event) => updateNodePermissionRow(index, { canDelete: event.target.checked })}
                      />
                      Slet
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' }}>
                      <input
                        type="checkbox"
                        checked={!!row.canEditAssociation}
                        onChange={(event) => updateNodePermissionRow(index, { canEditAssociation: event.target.checked })}
                      />
                      Rediger association
                    </label>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addNodePermissionRole}
                style={{
                  justifySelf: 'start',
                  border: '1px dashed #94a3b8',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  borderRadius: '999px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Tilføj rolle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoPanel;
