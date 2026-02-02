// src/components/Mindmap/MindmapData.js

export const initialNodes = [
  // ──────────────────────────────────────────────────────────────
  // Top Level Nodes
  // ──────────────────────────────────────────────────────────────
  {
    id: 'TM',
    type: 'default',
    data: { label: 'Tillidsmandskredsen' },
    position: { x: 1180, y: -61 },
    draggable: true,
  },
  {
    id: 'STY',
    type: 'default',
    data: { label: 'Styrelsen' },
    position: { x: 880, y: -61 },
    draggable: true,
  },
  {
    id: 'STUD',
    type: 'default',
    data: { label: 'De studerende' },
    position: { x: 846, y: 98 },
    draggable: true,
  },

  // ──────────────────────────────────────────────────────────────
  // Group: LEDELSE
  // ──────────────────────────────────────────────────────────────
  {
    id: 'group_ledelse',
    type: 'groupNode',
    data: {
      label: '📋 LEDELSE',
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
      labelColor: '#1e40af',
    },
    position: { x: 1289, y: 175 },
    style: { width: 456, height: 230, zIndex: -1 },
    draggable: true,
  },
  {
    id: 'FOR',
    type: 'default',
    data: { label: 'Forstanderen' },
    position: { x: 160, y: 50 },
    parentNode: 'group_ledelse',
    draggable: true,
  },
  {
    id: 'LED',
    type: 'default',
    data: { label: 'Ledelsesgruppen' },
    position: { x: 20, y: 143 },
    parentNode: 'group_ledelse',
    draggable: true,
  },
  {
    id: 'LR',
    type: 'default',
    data: { label: 'Lærerrådet' },
    position: { x: 278, y: 154 },
    parentNode: 'group_ledelse',
    draggable: true,
  },

  // ──────────────────────────────────────────────────────────────
  // Group: FOLKESTYRETS KERNE
  // ──────────────────────────────────────────────────────────────
  {
    id: 'group_folkestyret',
    type: 'groupNode',
    data: {
      label: '🏛️ FOLKESTYRETS KERNE',
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      labelColor: '#059669',
    },
    position: { x: 161, y: 161 },
    style: { width: 385, height: 240, zIndex: -1 },
    draggable: true,
  },
  {
    id: 'SHB',
    type: 'default',
    data: { label: 'Studiehåndbogen' },
    position: { x: 20, y: 72 },
    parentNode: 'group_folkestyret',
    draggable: true,
  },
  {
    id: 'SM',
    type: 'default',
    data: {
      label: 'STORMØDET',
      description:
        'Stormødet er folkestyrets centrale beslutningsorgan hvor alle studerende har stemmeret. Her træffes de vigtigste beslutninger om seminarets drift, økonomi og fremtid. Stormødet afholdes flere gange i løbet af året og er åbent for alle.',
    },
    position: { x: 215, y: 117 },
    parentNode: 'group_folkestyret',
    draggable: true,
  },
  {
    id: 'FU',
    type: 'default',
    data: { label: 'FU' },
    position: { x: 23, y: 143 },
    parentNode: 'group_folkestyret',
    draggable: true,
  },

  // ──────────────────────────────────────────────────────────────
  // Student Organizations
  // ──────────────────────────────────────────────────────────────
  {
    id: 'UND',
    type: 'default',
    data: { label: 'Undergrundsudvalget' },
    position: { x: 1073, y: 149 },
    draggable: true,
  },
  {
    id: 'STU_K',
    type: 'default',
    data: { label: 'Studiekredse' },
    position: { x: 719, y: 215 },
    draggable: true,
  },
  {
    id: 'AAM',
    type: 'default',
    data: { label: 'Årgangsmøde' },
    position: { x: 891, y: 313 },
    draggable: true,
  },
  {
    id: 'DSR',
    type: 'default',
    data: { label: 'De Studerendes Råd (inaktiv)' },
    position: { x: 1045, y: 286 },
    draggable: true,
  },

  // ──────────────────────────────────────────────────────────────
  // Group: LEDELSES-UDVALG
  // ──────────────────────────────────────────────────────────────
  {
    id: 'group_ledelses_udvalg',
    type: 'groupNode',
    data: {
      label: '🎓 LEDELSES-UDVALG',
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
      labelColor: '#d97706',
    },
    position: { x: 1010, y: 521 },
    style: { width: 405, height: 231, zIndex: -1 },
    draggable: true,
  },
  {
    id: 'P_UDV',
    type: 'default',
    data: { label: 'Praktikudvalgene' },
    position: { x: 20, y: 50 },
    parentNode: 'group_ledelses_udvalg',
    draggable: true,
  },
  {
    id: 'FAG',
    type: 'default',
    data: { label: 'Fagudvalgene' },
    position: { x: 226, y: 59 },
    parentNode: 'group_ledelses_udvalg',
    draggable: true,
  },
  {
    id: 'LUU',
    type: 'default',
    data: { label: 'Læreruddannelsesudvalget (LUU)' },
    position: { x: 73, y: 144 },
    parentNode: 'group_ledelses_udvalg',
    draggable: true,
  },

  // ──────────────────────────────────────────────────────────────
  // Group: UDVALGENE
  // ──────────────────────────────────────────────────────────────
  {
    id: 'group_udvalgene',
    type: 'groupNode',
    data: {
      label: '📊 UDVALGENE',
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.08)',
      labelColor: '#7c3aed',
    },
    position: { x: 336, y: 509 },
    style: { width: 623, height: 420, zIndex: -1 },
    draggable: true,
  },
  {
    id: 'BEV',
    type: 'default',
    data: { label: 'Bevillingsudvalget' },
    position: { x: 20, y: 50 },
    parentNode: 'group_udvalgene',
    draggable: true,
  },
  {
    id: 'BUD',
    type: 'default',
    data: { label: 'Budgetudvalget' },
    position: { x: 20, y: 120 },
    parentNode: 'group_udvalgene',
    draggable: true,
  },
  {
    id: 'KOST',
    type: 'default',
    data: {
      label: 'Kostudvalget',
      description:
        'Kostudvalget har ansvaret for kostordningen på seminaret. Udvalget arbejder med menu-planlægning, indkøb, og sikrer at alle studerendes behov bliver tilgodeset. De samarbejder tæt med køkkenpersonalet for at skabe gode og sunde måltider.',
    },
    position: { x: 200, y: 50 },
    parentNode: 'group_udvalgene',
    draggable: true,
  },
  {
    id: 'UMU',
    type: 'default',
    data: { label: 'Undervisningsmiljøudvalget' },
    position: { x: 200, y: 120 },
    parentNode: 'group_udvalgene',
    draggable: true,
  },
  {
    id: 'AAR',
    type: 'default',
    data: { label: 'Årsplansudvalget' },
    position: { x: 20, y: 201 },
    parentNode: 'group_udvalgene',
    draggable: true,
  },
  {
    id: 'TIL',
    type: 'default',
    data: { label: 'Tilgængelighedsudvalget' },
    position: { x: 209, y: 208 },
    parentNode: 'group_udvalgene',
    draggable: true,
  },
  {
    id: 'BAE',
    type: 'default',
    data: { label: 'Bæredygtighedsudvalget' },
    position: { x: 30, y: 280 },
    parentNode: 'group_udvalgene',
    draggable: true,
  },
  {
    id: 'BIB',
    type: 'default',
    data: { label: 'Biblioteksudvalget' },
    position: { x: 402, y: 46 },
    parentNode: 'group_udvalgene',
    draggable: true,
  },
  {
    id: 'INT',
    type: 'default',
    data: { label: 'Internationalt udvalg' },
    position: { x: 426, y: 120 },
    parentNode: 'group_udvalgene',
    draggable: true,
  },
  {
    id: 'UDS',
    type: 'default',
    data: { label: 'Udstillingsudvalget' },
    position: { x: 420, y: 191 },
    parentNode: 'group_udvalgene',
    draggable: true,
  },
  {
    id: 'TID',
    type: 'default',
    data: { label: 'Tidsskriftredaktionen' },
    position: { x: 412, y: 263 },
    parentNode: 'group_udvalgene',
    draggable: true,
  },
  {
    id: 'F_UDV',
    type: 'default',
    data: { label: 'Fælestimeudvalget' },
    position: { x: 249, y: 334 },
    parentNode: 'group_udvalgene',
    draggable: true,
  },
];

export const initialEdges = [
  // ──────────────────────────────────────────────────────────────
  // Top Level Connections
  // ──────────────────────────────────────────────────────────────
  {
    id: 'e-TM-STY',
    source: 'TM',
    target: 'STY',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#334155' },
    markerEnd: { type: 'arrowclosed', color: '#334155' },
  },

  // ──────────────────────────────────────────────────────────────
  // Styrelse → Ledelse
  // ──────────────────────────────────────────────────────────────
  {
    id: 'e-STY-FOR',
    source: 'STY',
    target: 'FOR',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#334155' },
    markerEnd: { type: 'arrowclosed', color: '#334155' },
  },

  // ──────────────────────────────────────────────────────────────
  // Within Ledelse Group
  // ──────────────────────────────────────────────────────────────
  {
    id: 'e-FOR-LED',
    source: 'FOR',
    target: 'LED',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#3b82f6' },
    markerEnd: { type: 'arrowclosed', color: '#3b82f6' },
  },
  {
    id: 'e-FOR-LR',
    source: 'FOR',
    target: 'LR',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#3b82f6' },
    markerEnd: { type: 'arrowclosed', color: '#3b82f6' },
  },

  // ──────────────────────────────────────────────────────────────
  // Lærerrådet ↔ Ledelses-udvalg (bidirectional)
  // ──────────────────────────────────────────────────────────────
  {
    id: 'e-LR-LUDV',
    source: 'LR',
    target: 'group_ledelses_udvalg',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#ea580c' },
    markerEnd: { type: 'arrowclosed', color: '#ea580c' },
    markerStart: { type: 'arrowclosed', color: '#ea580c' },
  },

  // ──────────────────────────────────────────────────────────────
  // Styrelse → Folkestyrets Kerne (animated)
  // ──────────────────────────────────────────────────────────────
  {
    id: 'e-STY-FOLK',
    source: 'STY',
    target: 'group_folkestyret',
    type: 'default',
    animated: true,
    style: { strokeWidth: 2, stroke: '#059669' },
    markerEnd: { type: 'arrowclosed', color: '#059669' },
  },

  // ──────────────────────────────────────────────────────────────
  // Within Folkestyrets Kerne Group
  // ──────────────────────────────────────────────────────────────
  {
    id: 'e-SHB-SM',
    source: 'SHB',
    target: 'SM',
    type: 'default',
    animated: true,
    style: { strokeWidth: 2, stroke: '#10b981' },
    markerEnd: { type: 'arrowclosed', color: '#10b981' },
  },
  {
    id: 'e-FU-SM',
    source: 'FU',
    target: 'SM',
    type: 'default',
    animated: true,
    style: { strokeWidth: 2, stroke: '#10b981' },
    markerEnd: { type: 'arrowclosed', color: '#10b981' },
  },

  // ──────────────────────────────────────────────────────────────
  // De Studerende Connections
  // ──────────────────────────────────────────────────────────────
  {
    id: 'e-STUD-UND',
    source: 'STUD',
    target: 'UND',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#475569' },
    markerEnd: { type: 'arrowclosed', color: '#475569' },
  },
  {
    id: 'e-STUD-STU_K',
    source: 'STUD',
    target: 'STU_K',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#475569' },
    markerEnd: { type: 'arrowclosed', color: '#475569' },
  },
  {
    id: 'e-STUD-AAM',
    source: 'STUD',
    target: 'AAM',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#475569' },
    markerEnd: { type: 'arrowclosed', color: '#475569' },
  },
  {
    id: 'e-STUD-SM',
    source: 'STUD',
    target: 'SM',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#475569' },
    markerEnd: { type: 'arrowclosed', color: '#475569' },
  },
  {
    id: 'e-STUD-DSR',
    source: 'STUD',
    target: 'DSR',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#475569' },
    markerEnd: { type: 'arrowclosed', color: '#475569' },
  },

  // ──────────────────────────────────────────────────────────────
  // Årgangsmøde → Ledelses-udvalg
  // ──────────────────────────────────────────────────────────────
  {
    id: 'e-AAM-LUDV',
    source: 'AAM',
    target: 'group_ledelses_udvalg',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#ea580c' },
    markerEnd: { type: 'arrowclosed', color: '#ea580c' },
  },

  // ──────────────────────────────────────────────────────────────
  // Årgangsmøde → Udvalgene
  // ──────────────────────────────────────────────────────────────
  {
    id: 'e-AAM-UDV',
    source: 'AAM',
    target: 'group_udvalgene',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#7c3aed' },
    markerEnd: { type: 'arrowclosed', color: '#7c3aed' },
  },

  // ──────────────────────────────────────────────────────────────
  // Stormødet ↔ Udvalgene (bidirectional)
  // ──────────────────────────────────────────────────────────────
  {
    id: 'e-SM-UDV',
    source: 'SM',
    target: 'group_udvalgene',
    type: 'default',
    style: { strokeWidth: 2, stroke: '#7c3aed' },
    markerEnd: { type: 'arrowclosed', color: '#7c3aed' },
    markerStart: { type: 'arrowclosed', color: '#7c3aed' },
  },
];
