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
import { useAuth } from '../../context/AuthContext';

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

const DEFAULT_ACCESS_CONTROL = {
  mindmapControlRoles: [],
  nodeRules: {},
};
const DEFAULT_TABS = [
  { id: 'admins', label: 'Admins' },
  { id: 'year', label: 'Årgange' },
  { id: 'dorm', label: 'Kollegie' },
];

const DEFAULT_META = { kind: 'role', tabId: null, groupId: null };
const TABS_META_ROLE = '__dfl_tabs__';
const GROUPS_META_ROLE = '__dfl_groups__';

const DEFAULT_NODE_RULE = {
  editContentRoles: [],
  editColorRoles: [],
  deleteNodeRoles: [],
  editAssociationRoles: [],
};

function normalizeRoles(value) {
  return Array.isArray(value) ? [...new Set(value.filter(Boolean).map((v) => String(v)))] : [];
}

function normalizeNodeRule(rule = {}) {
  return {
    editContentRoles: normalizeRoles(rule.editContentRoles),
    editColorRoles: normalizeRoles(rule.editColorRoles),
    deleteNodeRoles: normalizeRoles(rule.deleteNodeRoles),
    editAssociationRoles: normalizeRoles(rule.editAssociationRoles),
  };
}

function normalizeAccessControl(input = {}) {
  const nodeRulesInput = input?.nodeRules && typeof input.nodeRules === 'object' ? input.nodeRules : {};
  const nodeRules = {};
  Object.entries(nodeRulesInput).forEach(([nodeId, rule]) => {
    nodeRules[nodeId] = normalizeNodeRule(rule);
  });
  return {
    mindmapControlRoles: normalizeRoles(input?.mindmapControlRoles),
    nodeRules,
  };
}

function normalizePermissions(input = {}) {
  const normalized = {};
  Object.entries(input || {}).forEach(([rolle, config]) => {
    if (rolle === TABS_META_ROLE || rolle === GROUPS_META_ROLE) {
      normalized[rolle] = config;
      return;
    }
    if (Array.isArray(config)) {
      normalized[rolle] = { rights: config, __meta: { ...DEFAULT_META } };
      return;
    }
    normalized[rolle] = {
      rights: config?.rights || [],
      __meta: { ...DEFAULT_META, ...(config?.__meta || {}) },
    };
  });
  return normalized;
}

function normalizeTabId(input = '') {
  const clean = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'ny-fane';
}

function readTabsFromPermissions(permissionMap) {
  const entry = permissionMap[TABS_META_ROLE];
  if (!entry?.__meta?.tabs || !Array.isArray(entry.__meta.tabs)) {
    return DEFAULT_TABS;
  }
  const seen = new Map();
  DEFAULT_TABS.forEach((t) => seen.set(t.id, t));
  entry.__meta.tabs.forEach((t) => {
    const id = normalizeTabId(String(t?.id || t?.label || ''));
    const label = String(t?.label || t?.id || id);
    if (!id) return;
    seen.set(id, { id, label });
  });
  return Array.from(seen.values());
}

function readGroupsFromPermissions(permissionMap) {
  const entry = permissionMap[GROUPS_META_ROLE];
  if (!entry?.__meta?.groups || !Array.isArray(entry.__meta.groups)) {
    return [];
  }
  return entry.__meta.groups;
}

function mindmapRolesToRows(roles = []) {
  return normalizeRoles(roles).map((rolle) => ({
    id: `mindmap-${rolle}`,
    rolle,
    canControlMindmap: true,
  }));
}

function mindmapRowsToRoles(rows = []) {
  return normalizeRoles(
    rows.filter((row) => row.rolle && row.canControlMindmap).map((row) => row.rolle)
  );
}

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
      textColor: node.data?.textColor || '',
      // Alle objekter optræder som nøgleobjekter
      isKeyObject: true,
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
        textColor: node.data?.textColor || '',
        // Gem altid som nøgleobjekt
        isKeyObject: true,
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
  const { isAdmin, isEditingText, toggleTextEdit, setIsEditingText } = useAdmin();
  const { bruger, erAdmin, token } = useAuth();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [accessControl, setAccessControl] = useState(DEFAULT_ACCESS_CONTROL);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [permissionMap, setPermissionMap] = useState({});
  const [mindmapPermissionRows, setMindmapPermissionRows] = useState([]);
  const [showMindmapKeyPanel, setShowMindmapKeyPanel] = useState(false);
  const [loadStatus, setLoadStatus] = useState('idle');
  const [saveStatus, setSaveStatus] = useState(null);
  const isPanning = useRef(false);

  const [mmTabId, setMmTabId] = useState('');
  const [mmShowScope, setMmShowScope] = useState(false);
  const [mmScope, setMmScope] = useState(''); // 'role:<rolle>' | 'group:<id>'
  const [mmGroupRole, setMmGroupRole] = useState(''); // rolle i valgt gruppe (valgfrit)

  const userRoles = useMemo(
    () => (bruger?.myndigheder || []).map((m) => m.rolle).filter(Boolean),
    [bruger]
  );

  const hasAnyRoleAccess = useCallback(
    (allowedRoles = []) => {
      if (erAdmin) return true;
      const allowedSet = new Set(normalizeRoles(allowedRoles));
      if (!allowedSet.size) return false;
      return userRoles.some((role) => allowedSet.has(role));
    },
    [erAdmin, userRoles]
  );

  const hasMindmapControl = useMemo(
    () => hasAnyRoleAccess(accessControl.mindmapControlRoles),
    [accessControl.mindmapControlRoles, hasAnyRoleAccess]
  );

  const canUseAdminTools = isAdmin && hasMindmapControl;

  const roleMetaMap = useMemo(() => {
    return Object.fromEntries(
      Object.entries(permissionMap)
        .filter(([rolle]) => rolle !== TABS_META_ROLE && rolle !== GROUPS_META_ROLE)
        .map(([rolle, cfg]) => [rolle, cfg?.__meta || { ...DEFAULT_META }]),
    );
  }, [permissionMap]);

  const tabs = useMemo(() => readTabsFromPermissions(permissionMap), [permissionMap]);
  const groups = useMemo(() => readGroupsFromPermissions(permissionMap), [permissionMap]);

  useEffect(() => {
    if (!tabs.length) return;
    if (!mmTabId || !tabs.some((t) => t.id === mmTabId)) {
      setMmTabId(tabs[0].id);
    }
  }, [tabs, mmTabId]);

  const mmGroupsInTab = useMemo(() => groups.filter((g) => g.tabId === mmTabId), [groups, mmTabId]);

  const mmTopRolesInTab = useMemo(() => {
    const fallback = tabs[0]?.id || 'admins';
    return availableRoles
      .filter((rolle) => {
        if (!rolle) return false;
        const meta = roleMetaMap[rolle] || DEFAULT_META;
        if (meta.groupId) return false;
        const tabId = meta.tabId || fallback;
        return tabId === mmTabId;
      })
      .sort((a, b) => a.localeCompare(b, 'da'));
  }, [availableRoles, roleMetaMap, tabs, mmTabId]);

  const mmRolesInSelectedGroup = useMemo(() => {
    const groupId = mmScope.startsWith('group:') ? mmScope.split(':')[1] : '';
    if (!groupId) return [];
    return availableRoles
      .filter((rolle) => (roleMetaMap[rolle] || DEFAULT_META).groupId === groupId)
      .sort((a, b) => a.localeCompare(b, 'da'));
  }, [availableRoles, roleMetaMap, mmScope]);

  useEffect(() => {
    setMindmapPermissionRows(mindmapRolesToRows(accessControl.mindmapControlRoles));
  }, [accessControl.mindmapControlRoles]);

  // Load data on mount
  useEffect(() => {
    loadMindmapData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRolesAndPermissions() {
      try {
        // Roller (åben endpoint)
        let roles = ['Admin', 'Owner', ...userRoles];
        const rolesRes = await fetch('/api/auth/roller');
        if (rolesRes.ok) {
          const roleData = await rolesRes.json();
          if (Array.isArray(roleData) && roleData.length) {
            roles = roleData;
          }
        }
        if (!cancelled) {
          setAvailableRoles([...new Set(roles.filter(Boolean))]);
        }

        // Rettigheder (kun for admin, med fuld meta)
        if (!erAdmin) {
          if (!cancelled) {
            setPermissionMap({});
          }
          return;
        }

        const permRes = await fetch('/api/admin/rettigheder', {
          headers: { 'x-auth-token': token || '' },
        });

        if (permRes.ok) {
          const permissionData = await permRes.json();
          const nextPermissions = normalizePermissions(permissionData);
          if (!cancelled) {
            setPermissionMap(nextPermissions);
          }
        } else if (!cancelled) {
          setPermissionMap({});
        }
      } catch {
        if (!cancelled) {
          setAvailableRoles(['Admin', 'Owner', ...userRoles]);
          setPermissionMap({});
        }
      }
    }

    loadRolesAndPermissions();
    return () => {
      cancelled = true;
    };
  }, [userRoles, erAdmin, token]);

  const loadMindmapData = async () => {
    setLoadStatus('loading');
    try {
      // Try localStorage first
      const storedData = localStorage.getItem('mindmap_data');
      if (storedData) {
        const {
          nodes: storedNodes,
          edges: storedEdges,
          accessControl: storedAccessControl,
        } = JSON.parse(storedData);
        const normalizedNodes = normalizeNodes(storedNodes);
        const normalizedEdges = normalizeEdges(storedEdges);
        const normalizedAccess = normalizeAccessControl(storedAccessControl);

        // Hvis der ikke er nogen gemte noder/edges, falder vi tilbage til standard-mindmap
        const hasContent = Array.isArray(normalizedNodes) && normalizedNodes.length > 0;
        if (hasContent) {
          setNodes(normalizedNodes);
          setEdges(normalizedEdges);
          setAccessControl(normalizedAccess);
          setLoadStatus('success');
          return;
        }
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
          setAccessControl(normalizeAccessControl(mindmapData.accessControl));
          setLoadStatus('success');
          return;
        }
      }

      // Fallback to initial data
      setNodes(normalizeNodes(initialNodes));
      setEdges(normalizeEdges(initialEdges));
      setAccessControl(DEFAULT_ACCESS_CONTROL);
      setLoadStatus('success');
    } catch (error) {
      console.error('Load error:', error);
      setNodes(normalizeNodes(initialNodes));
      setEdges(normalizeEdges(initialEdges));
      setAccessControl(DEFAULT_ACCESS_CONTROL);
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
      if (!canUseAdminTools) return;
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
    [canUseAdminTools, nodes, setEdges]
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

  const getNodeRule = useCallback(
    (nodeId) => normalizeNodeRule(accessControl.nodeRules?.[nodeId] || DEFAULT_NODE_RULE),
    [accessControl.nodeRules]
  );

  const getNodeCapabilities = useCallback(
    (nodeId) => {
      const rule = getNodeRule(nodeId);
      return {
        canEditContent: hasAnyRoleAccess(rule.editContentRoles),
        canEditColor: hasAnyRoleAccess(rule.editColorRoles),
        canDeleteNode: hasAnyRoleAccess(rule.deleteNodeRoles),
        canEditAssociation: hasAnyRoleAccess(rule.editAssociationRoles),
      };
    },
    [getNodeRule, hasAnyRoleAccess]
  );

  const selectedNodeCapabilities = useMemo(() => {
    if (selectedElement?.type !== 'node') {
      return null;
    }
    return getNodeCapabilities(selectedElement.data.id);
  }, [selectedElement, getNodeCapabilities]);

  const canEditSelectedNodeText = !!selectedNodeCapabilities?.canEditContent || canUseAdminTools;

  useEffect(() => {
    if (!isEditingText) return;
    if (!canEditSelectedNodeText) {
      setIsEditingText(false);
    }
  }, [isEditingText, canEditSelectedNodeText, setIsEditingText]);

  const handleMindmapControlRolesChange = useCallback((roles) => {
    setAccessControl((prev) => ({
      ...prev,
      mindmapControlRoles: normalizeRoles(roles),
    }));
  }, []);

  const updateMindmapPermissionRows = useCallback((nextRows) => {
    setMindmapPermissionRows(nextRows);
    handleMindmapControlRolesChange(mindmapRowsToRoles(nextRows));
  }, [handleMindmapControlRolesChange]);

  const addMindmapPermissionRoles = useCallback((rolesToAdd = []) => {
    const used = new Set(mindmapPermissionRows.map((row) => row.rolle));
    const nextRows = [...mindmapPermissionRows];
    rolesToAdd.forEach((rolle) => {
      const clean = String(rolle || '').trim();
      if (!clean || used.has(clean)) return;
      used.add(clean);
      nextRows.push({
        id: `mindmap-${clean}-${Date.now()}`,
        rolle: clean,
        canControlMindmap: true,
      });
    });
    updateMindmapPermissionRows(nextRows);
  }, [mindmapPermissionRows, updateMindmapPermissionRows]);

  const updateMindmapPermissionRow = useCallback((index, patch) => {
    const nextRows = mindmapPermissionRows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row
    );
    updateMindmapPermissionRows(nextRows);
  }, [mindmapPermissionRows, updateMindmapPermissionRows]);

  const removeMindmapPermissionRow = useCallback((index) => {
    const nextRows = mindmapPermissionRows.filter((_, rowIndex) => rowIndex !== index);
    updateMindmapPermissionRows(nextRows);
  }, [mindmapPermissionRows, updateMindmapPermissionRows]);

  const handleNodePermissionChange = useCallback((nodeId, nextRule) => {
    setAccessControl((prev) => ({
      ...prev,
      nodeRules: {
        ...prev.nodeRules,
        [nodeId]: normalizeNodeRule(nextRule),
      },
    }));
  }, []);

  const handleAddNode = useCallback(() => {
    if (!canUseAdminTools) return;
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
  }, [canUseAdminTools, setNodes]);

  const handleAddGroup = useCallback(() => {
    if (!canUseAdminTools) return;
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
  }, [canUseAdminTools, setNodes]);

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
      const caps = getNodeCapabilities(selectedElement.data.id);
      if (!caps.canDeleteNode && !canUseAdminTools) return;
      setNodes((nds) => nds.filter((n) => n.id !== selectedElement.data.id));
      setEdges((eds) =>
        eds.filter(
          (e) =>
            e.source !== selectedElement.data.id &&
            e.target !== selectedElement.data.id
        )
      );
    } else if (selectedElement.type === 'edge') {
      if (!canUseAdminTools) return;
      setEdges((eds) => eds.filter((e) => e.id !== selectedElement.data.id));
    }
    setSelectedElement(null);
  }, [selectedElement, canUseAdminTools, getNodeCapabilities, setNodes, setEdges]);

  const handleNodeUpdate = useCallback(
    (updatedData) => {
      if (!selectedElement || selectedElement.type !== 'node') return;
      if (!canUseAdminTools) {
        const caps = getNodeCapabilities(selectedElement.data.id);
        const isColorChange = ['borderColor', 'backgroundColor', 'textColor'].some(
          (key) => Object.prototype.hasOwnProperty.call(updatedData, key)
        );
        const isAssociationChange = ['linkUrl', 'parentNode'].some((key) =>
          Object.prototype.hasOwnProperty.call(updatedData, key)
        );
        const isContentChange = ['label', 'description'].some((key) =>
          Object.prototype.hasOwnProperty.call(updatedData, key)
        );
        if ((isColorChange && !caps.canEditColor) || (isAssociationChange && !caps.canEditAssociation) || (isContentChange && !caps.canEditContent)) {
          return;
        }
      }
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedElement.data.id
            ? { ...n, data: { ...n.data, ...updatedData } }
            : n
        )
      );
    },
    [selectedElement, canUseAdminTools, getNodeCapabilities, setNodes]
  );

  const handleEdgeUpdate = useCallback(
    (updatedEdge) => {
      if (!selectedElement || selectedElement.type !== 'edge') return;
      if (!canUseAdminTools) return;
      setEdges((eds) =>
        eds.map((e) =>
          e.id === selectedElement.data.id ? { ...e, ...updatedEdge } : e
        )
      );
    },
    [selectedElement, canUseAdminTools, setEdges]
  );

  // Save to TinaCMS or localStorage
  const handleSaveData = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const dataToSave = {
        nodes: serializeNodes(nodes),
        edges: serializeEdges(edges),
        accessControl: normalizeAccessControl(accessControl),
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
  }, [nodes, edges, accessControl]);

  useEffect(() => {
    if (loadStatus === 'loading') return;
    const dataToPersist = {
      nodes: serializeNodes(nodes),
      edges: serializeEdges(edges),
      accessControl: normalizeAccessControl(accessControl),
    };
    localStorage.setItem('mindmap_data', JSON.stringify(dataToPersist));
  }, [nodes, edges, accessControl, loadStatus]);

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
          {canUseAdminTools && (
            <>
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
            </>
          )}

          {(canEditSelectedNodeText || canUseAdminTools) && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
              {erAdmin && (
                <button
                  onClick={() => setShowMindmapKeyPanel((prev) => !prev)}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: '#fff',
                    backgroundColor: showMindmapKeyPanel ? '#0f172a' : '#475569',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                  }}
                  title="Mindmap kontrol adgang"
                >
                  🔑
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isAdmin && erAdmin && showMindmapKeyPanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex' }}>
          <div
            style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
            onClick={() => setShowMindmapKeyPanel(false)}
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
                  Mindmap adgang
                </div>
                <h3 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  🔑 Mindmap kontrol
                </h3>
              </div>
              <button
                onClick={() => setShowMindmapKeyPanel(false)}
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
                Vælg roller og tilladelser for mindmap-kontrol.
              </div>
              {mindmapPermissionRows.length === 0 && (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Ingen roller endnu. Tryk på &quot;+ Tilføj rolle&quot;.
                </div>
              )}

              {mindmapPermissionRows.map((row, index) => (
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                        Rolle
                      </div>
                      <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.rolle}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMindmapPermissionRow(index)}
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={!!row.canControlMindmap}
                      onChange={(event) => updateMindmapPermissionRow(index, { canControlMindmap: event.target.checked })}
                    />
                    Mindmap kontrol
                  </label>
                </div>
              ))}

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', display: 'grid', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                  Tilføj rolle (trinvis)
                </div>

                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Fane</div>
                    <select
                      value={mmTabId}
                      onChange={(e) => {
                        setMmTabId(e.target.value);
                        setMmScope('');
                        setMmGroupRole('');
                        setMmShowScope(false);
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
                      {tabs.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!mmShowScope ? (
                    <button
                      type="button"
                      onClick={() => setMmShowScope(true)}
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
                      + Vælg rolle / gruppe (valgfrit)
                    </button>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gap: '4px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Rolle eller gruppe</div>
                        <select
                          value={mmScope}
                          onChange={(e) => {
                            setMmScope(e.target.value);
                            setMmGroupRole('');
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
                          <option value="">(valgfrit) Vælg rolle eller gruppe</option>
                          {mmTopRolesInTab.map((rolle) => (
                            <option key={`role-${rolle}`} value={`role:${rolle}`}>
                              Rolle: {rolle}
                            </option>
                          ))}
                          {mmGroupsInTab.map((g) => (
                            <option key={`group-${g.id}`} value={`group:${g.id}`}>
                              Gruppe: {g.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {mmScope.startsWith('group:') && (
                        <div style={{ display: 'grid', gap: '4px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                            Rolle i gruppen (valgfrit)
                          </div>
                          <select
                            value={mmGroupRole}
                            onChange={(e) => setMmGroupRole(e.target.value)}
                            style={{
                              width: '100%',
                              fontSize: '13px',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                            }}
                          >
                            <option value="">Hele gruppen</option>
                            {mmRolesInSelectedGroup.map((rolle) => (
                              <option key={`grole-${rolle}`} value={rolle}>
                                {rolle}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const nextRoles = [];
                            if (mmScope.startsWith('role:')) {
                              nextRoles.push(mmScope.slice('role:'.length));
                            } else if (mmScope.startsWith('group:')) {
                              if (mmGroupRole) nextRoles.push(mmGroupRole);
                              else nextRoles.push(...mmRolesInSelectedGroup);
                            }
                            addMindmapPermissionRoles(nextRoles);
                            setMmScope('');
                            setMmGroupRole('');
                            setMmShowScope(false);
                          }}
                          disabled={!mmScope}
                          style={{
                            flex: 1,
                            border: 'none',
                            backgroundColor: mmScope ? '#0f172a' : '#94a3b8',
                            color: '#ffffff',
                            borderRadius: '10px',
                            padding: '8px 10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: mmScope ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Tilføj
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMmScope('');
                            setMmGroupRole('');
                            setMmShowScope(false);
                          }}
                          style={{
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            borderRadius: '10px',
                            padding: '8px 10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Annuller
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
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
        nodesDraggable={canUseAdminTools}
        nodesConnectable={canUseAdminTools}
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
          canUseMindmapControl={canUseAdminTools}
          canConfigurePermissions={isAdmin && erAdmin}
          availableRoles={availableRoles}
          roleMetaMap={roleMetaMap}
          tabs={tabs}
          groups={groups}
          nodePermissionRule={
            selectedElement?.type === 'node'
              ? getNodeRule(selectedElement.data.id)
              : null
          }
          nodeCapabilities={selectedNodeCapabilities}
          onNodePermissionChange={handleNodePermissionChange}
        />
      )}
    </div>
  );
};

export default MindmapCanvas;
