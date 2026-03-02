import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ALLE_RETTIGHEDER } from '../context/AuthContext';
import AccessKeyPanel from '../components/AccessKeyPanel';

const DEFAULT_TABS = [
  { id: 'admins', label: 'Admins' },
  { id: 'year', label: 'Årgange' },
  { id: 'dorm', label: 'Kollegie' },
];

const TABS_META_ROLE = '__dfl_tabs__';
const GROUPS_META_ROLE = '__dfl_groups__';

const DEFAULT_META = {
  kind: 'role',
  tabId: null,
  groupId: null,
};

function normalizeTabId(input = '') {
  const clean = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'ny-fane';
}

function normalizePermissions(raw = {}) {
  const result = {};
  Object.entries(raw || {}).forEach(([rolle, cfg]) => {
    if (Array.isArray(cfg)) {
      result[rolle] = { rights: cfg, __meta: { ...DEFAULT_META } };
      return;
    }
    const meta = { ...DEFAULT_META, ...(cfg?.__meta || {}) };
    result[rolle] = { rights: cfg?.rights || [], __meta: meta };
  });
  return result;
}

function readTabsFromPermissions(permissions) {
  const system = permissions[TABS_META_ROLE];
  if (!system?.__meta?.tabs || !Array.isArray(system.__meta.tabs)) {
    return DEFAULT_TABS;
  }
  const seen = new Map();
  DEFAULT_TABS.forEach((t) => seen.set(t.id, t));
  system.__meta.tabs.forEach((t) => {
    const id = normalizeTabId(t.id || t.label);
    if (!id) return;
    seen.set(id, { id, label: String(t.label || t.id || id) });
  });
  return Array.from(seen.values());
}

function writeTabsToPermissions(permissions, tabs) {
  return {
    ...permissions,
    [TABS_META_ROLE]: {
      rights: [],
      __meta: {
        kind: 'system',
        tabs: tabs.map((t) => ({ id: t.id, label: t.label })),
      },
    },
  };
}

function readGroupsFromPermissions(permissions) {
  const entry = permissions[GROUPS_META_ROLE];
  if (!entry?.__meta?.groups || !Array.isArray(entry.__meta.groups)) {
    return [];
  }
  return entry.__meta.groups;
}

function writeGroupsToPermissions(permissions, groups) {
  return {
    ...permissions,
    [GROUPS_META_ROLE]: {
      rights: [],
      __meta: {
        kind: 'system',
        groups,
      },
    },
  };
}

export default function RettighederAdmin() {
  const navigate = useNavigate();
  const { bruger, erAdmin, token } = useAuth();

  const [permissions, setPermissions] = useState({});
  const [tabs, setTabs] = useState(DEFAULT_TABS);
  const [groups, setGroups] = useState([]);
  const [roller, setRoller] = useState([]);

  const [aktivTabId, setAktivTabId] = useState('admins');
  const [nyNavn, setNyNavn] = useState('');
  const [valgtRolleNavn, setValgtRolleNavn] = useState('');
  const [viserFaneRettigheder, setViserFaneRettigheder] = useState(false);
  const [accessTarget, setAccessTarget] = useState(null);

  const rollerMap = useMemo(
    () => Object.fromEntries((roller || []).map((r) => [r, true])),
    [roller]
  );

  const aktiveFaner = useMemo(() => {
    if (!tabs.length) return DEFAULT_TABS;
    return tabs;
  }, [tabs]);

  const aktiveRollerKonfig = useMemo(() => normalizePermissions(permissions), [permissions]);

  const rollerIaktivFane = useMemo(() => {
    return Object.entries(aktiveRollerKonfig)
      .filter(([navn, cfg]) => {
        if (navn === TABS_META_ROLE || navn === GROUPS_META_ROLE) return false;
        if (!rollerMap[navn]) return false;
        return cfg.__meta.tabId === aktivTabId && !cfg.__meta.groupId;
      })
      .map(([navn]) => navn)
      .sort((a, b) => a.localeCompare(b, 'da'));
  }, [aktiveRollerKonfig, rollerMap, aktivTabId]);

  const grupperIaktivFane = useMemo(
    () => groups.filter((g) => g.tabId === aktivTabId),
    [groups, aktivTabId]
  );

  const grupperoller = useMemo(() => {
    const map = {};
    Object.entries(aktiveRollerKonfig).forEach(([navn, cfg]) => {
      const groupId = cfg.__meta.groupId;
      if (!groupId) return;
      if (!rollerMap[navn]) return;
      if (!map[groupId]) map[groupId] = [];
      map[groupId].push(navn);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => a.localeCompare(b, 'da'))
    );
    return map;
  }, [aktiveRollerKonfig, rollerMap]);

  const aktivRolleConfig = valgtRolleNavn
    ? aktiveRollerKonfig[valgtRolleNavn] || { rights: [], __meta: { ...DEFAULT_META } }
    : null;

  const faneRettigheder = useMemo(() => {
    const system = aktiveRollerKonfig[TABS_META_ROLE];
    if (!system?.__meta?.tabRights) return {};
    return system.__meta.tabRights || {};
  }, [aktiveRollerKonfig]);

  const aktiveFaneRettigheder = useMemo(() => {
    const ids = new Set(faneRettigheder[aktivTabId] || []);
    return ALLE_RETTIGHEDER.filter((r) => ids.has(r.id));
  }, [faneRettigheder, aktivTabId]);

  const alleFaneRettigheder = useMemo(
    () => ALLE_RETTIGHEDER,
    []
  );

  const [mindmapKeyObjects, setMindmapKeyObjects] = useState([]);
  const [mindmapNodeRules, setMindmapNodeRules] = useState({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mindmap_data');
      if (!stored) {
        setMindmapKeyObjects([]);
        setMindmapNodeRules({});
        return;
      }
      const parsed = JSON.parse(stored);
      const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
      const nodeRules = parsed?.accessControl?.nodeRules || {};

      const groupNodes = nodes.filter((n) => n?.type === 'groupNode');
      const groupLabelMap = groupNodes.reduce((acc, n) => {
        if (n?.id && n.data?.label) {
          acc[n.id] = n.data.label;
        }
        return acc;
      }, {});

      const keyNodes = nodes.filter(
        (n) => n?.data && n.data.label && n.type !== 'groupNode'
      );

      const mapped = keyNodes.map((n) => {
        const parentId = n.parentNode || '';
        const groupLabel = parentId ? groupLabelMap[parentId] || 'Uden gruppe' : 'Uden gruppe';
        return {
          boxId: 'mindmap',
          folderPath: n.id || '',
          objectType: 'mindmap-node',
          objectLabel: n.data.label,
          category: 'mindmap',
          groupLabel,
        };
      });

      setMindmapKeyObjects(mapped);
      setMindmapNodeRules(nodeRules);
    } catch {
      setMindmapKeyObjects([]);
      setMindmapNodeRules({});
    }
  }, []);

  const noegleObjekter = useMemo(() => {
    const boxObjects = Object.entries(aktiveRollerKonfig)
      .filter(([, cfg]) => cfg?.__meta?.kind === 'box' && !!cfg.__meta.boxId)
      .map(([, cfg]) => {
        const meta = cfg.__meta || {};
        return {
          boxId: meta.boxId,
          folderPath: meta.folderPath || '',
          objectType: meta.objectType || (meta.folderPath ? 'folder' : 'box'),
          objectLabel:
            meta.objectLabel ||
            (meta.folderPath ? meta.folderPath.split('/').pop() : meta.boxId),
          category: meta.scopeKind || null,
        };
      });

    const combined = [...boxObjects, ...mindmapKeyObjects];

    return combined.sort((a, b) => {
      const labelSort = a.objectLabel.localeCompare(b.objectLabel, 'da');
      if (labelSort !== 0) return labelSort;
      return (a.folderPath || '').localeCompare(b.folderPath || '', 'da');
    });
  }, [aktiveRollerKonfig, mindmapKeyObjects]);

  const objektSektionMap = useMemo(() => {
    const labelMap = {
      arkiv: 'Arkiv',
      ressourcer: 'Ressourcer',
      mindmap: 'Mindmap',
      kontrolpanel: 'Kontrolpanel',
      home: 'Hjem',
      skolekort: 'Skolekort',
    };
    return noegleObjekter.reduce((acc, obj) => {
      const key = obj.category || 'andet';
      const label = labelMap[key] || 'Andre nøgleobjekter';
      if (!acc[key]) {
        acc[key] = { label, items: [] };
      }
      acc[key].items.push(obj);
      return acc;
    }, {});
  }, [noegleObjekter]);

  useEffect(() => {
    if (!erAdmin) return;
    (async () => {
      const [rollerSvar, rettighederSvar] = await Promise.all([
        fetch('/api/auth/roller'),
        fetch('/api/admin/rettigheder', { headers: { 'x-auth-token': token } }),
      ]);

      if (rollerSvar.ok) {
        setRoller(await rollerSvar.json());
      }
      if (rettighederSvar.ok) {
        const raw = await rettighederSvar.json();
        const normalized = normalizePermissions(raw);
        setPermissions(normalized);
        setTabs(readTabsFromPermissions(normalized));
        setGroups(readGroupsFromPermissions(normalized));
      }
    })();
  }, [erAdmin, token]);

  async function hentRettigheder() {
    const rettighederSvar = await fetch('/api/admin/rettigheder', {
      headers: { 'x-auth-token': token },
    });
    if (rettighederSvar.ok) {
      const raw = await rettighederSvar.json();
      const normalized = normalizePermissions(raw);
      setPermissions(normalized);
      setTabs(readTabsFromPermissions(normalized));
      setGroups(readGroupsFromPermissions(normalized));
    }
  }

  async function refreshRoller() {
    const svar = await fetch('/api/auth/roller');
    if (svar.ok) setRoller(await svar.json());
  }

  async function gemAlleRettigheder(nextPermissions) {
    const payload = nextPermissions || permissions;
    setPermissions(payload);
    await fetch('/api/auth/admin/rettigheder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify(payload),
    });
  }

  function opdaterTabs(nextTabs) {
    setTabs(nextTabs);
    const withTabs = writeTabsToPermissions(permissions, nextTabs);
    setPermissions(withTabs);
    void gemAlleRettigheder(withTabs);
  }

  function opdaterGroups(nextGroups) {
    setGroups(nextGroups);
    const withGroups = writeGroupsToPermissions(permissions, nextGroups);
    setPermissions(withGroups);
    void gemAlleRettigheder(withGroups);
  }

  async function opretFane() {
    const label = window.prompt('Navn på ny fane (fx Udvalg):');
    if (!label?.trim()) return;
    const id = normalizeTabId(label);
    if (aktiveFaner.some((t) => t.id === id)) {
      setAktivTabId(id);
      return;
    }
    opdaterTabs([...aktiveFaner, { id, label: label.trim() }]);
    setAktivTabId(id);
  }

  async function omdoebAktivFane() {
    const current = aktiveFaner.find((t) => t.id === aktivTabId);
    if (!current) return;
    const nyt = window.prompt('Nyt navn for fanen:', current.label);
    if (!nyt?.trim()) return;
    const next = aktiveFaner.map((t) =>
      t.id === aktivTabId ? { ...t, label: nyt.trim() } : t
    );
    opdaterTabs(next);
  }

  async function sletAktivFane() {
    const current = aktiveFaner.find((t) => t.id === aktivTabId);
    if (!current) return;
    if (!window.confirm(`Slet fanen "${current.label}"?`)) return;
    const next = aktiveFaner.filter((t) => t.id !== aktivTabId);
    opdaterTabs(next.length ? next : DEFAULT_TABS);
    setAktivTabId((next[0] || DEFAULT_TABS[0]).id);
  }

  function seBrugereIFane() {
    navigate('/brugere');
  }

  async function opretLoesRolle() {
    const navn = nyNavn.trim();
    if (!navn) return;
    const svar = await fetch('/api/admin/roller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ navn }),
    });
    if (!svar.ok) return;
    const nextPermissions = {
      ...permissions,
      [navn]: {
        rights: [],
        __meta: { ...DEFAULT_META, tabId: aktivTabId, groupId: null },
      },
    };
    await gemAlleRettigheder(nextPermissions);
    await refreshRoller();
    setNyNavn('');
    setValgtRolleNavn(navn);
  }

  function opretGruppe() {
    const label = nyNavn.trim();
    if (!label) return;
    const id = `grp_${Date.now().toString(36)}`;
    const nextGroups = [...groups, { id, tabId: aktivTabId, label }];
    opdaterGroups(nextGroups);
    setNyNavn('');
  }

  async function opretGruppeRolle(groupId) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const navn = window.prompt(`Navn på ny rolle i gruppen "${group.label}":`);
    if (!navn?.trim()) return;
    const clean = navn.trim();
    const svar = await fetch('/api/admin/roller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ navn: clean }),
    });
    if (!svar.ok) return;
    const nextPermissions = {
      ...permissions,
      [clean]: {
        rights: [],
        __meta: { ...DEFAULT_META, tabId: aktivTabId, groupId },
      },
    };
    await gemAlleRettigheder(nextPermissions);
    await refreshRoller();
    setValgtRolleNavn(clean);
  }

  async function sletRolle(rolleNavn) {
    if (!window.confirm(`Slet rollen "${rolleNavn}"?`)) return;
    await fetch(`/api/admin/roller/${encodeURIComponent(rolleNavn)}/anmod-slet`, {
      method: 'POST',
      headers: { 'x-auth-token': token },
    });
    const nextPermissions = { ...permissions };
    delete nextPermissions[rolleNavn];
    Object.entries(nextPermissions).forEach(([navn, cfg]) => {
      if (cfg.__meta.groupId && !groups.find((g) => g.id === cfg.__meta.groupId)) {
        nextPermissions[navn] = {
          ...cfg,
          __meta: { ...cfg.__meta, groupId: null },
        };
      }
    });
    await gemAlleRettigheder(nextPermissions);
    await refreshRoller();
    if (valgtRolleNavn === rolleNavn) setValgtRolleNavn('');
  }

  function sletGruppe(groupId) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    if (!window.confirm(`Slet gruppen "${group.label}"? Roller i gruppen bliver liggende som løse roller.`)) return;
    const nextGroups = groups.filter((g) => g.id !== groupId);
    opdaterGroups(nextGroups);
    const nextPermissions = { ...permissions };
    Object.entries(nextPermissions).forEach(([navn, cfg]) => {
      if (cfg.__meta.groupId === groupId) {
        nextPermissions[navn] = {
          ...cfg,
          __meta: { ...cfg.__meta, groupId: null },
        };
      }
    });
    void gemAlleRettigheder(nextPermissions);
  }

  async function omdoebRolle(rolleNavn) {
    const nyt = window.prompt('Nyt navn for rollen:', rolleNavn);
    if (!nyt?.trim() || nyt.trim() === rolleNavn) return;
    const clean = nyt.trim();
    const svar = await fetch(`/api/admin/roller/${encodeURIComponent(rolleNavn)}/omdoeb`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ nytNavn: clean }),
    });
    if (!svar.ok) return;

    const nextPermissions = {};
    Object.entries(permissions).forEach(([navn, cfg]) => {
      if (navn === rolleNavn) {
        nextPermissions[clean] = cfg;
      } else {
        nextPermissions[navn] = cfg;
      }
    });
    await gemAlleRettigheder(nextPermissions);
    await refreshRoller();
    if (valgtRolleNavn === rolleNavn) setValgtRolleNavn(clean);
  }

  function toggleFaneRet(tabId, rightId) {
    const current = permissions[TABS_META_ROLE]?.__meta?.tabRights || {};
    const existing = new Set(current[tabId] || []);
    if (existing.has(rightId)) existing.delete(rightId);
    else existing.add(rightId);
    const updated = {
      ...permissions,
      [TABS_META_ROLE]: {
        rights: [],
        __meta: {
          kind: 'system',
          tabs: (permissions[TABS_META_ROLE]?.__meta?.tabs || aktiveFaner).map((t) => ({
            id: t.id,
            label: t.label,
          })),
          tabRights: {
            ...current,
            [tabId]: Array.from(existing),
          },
        },
      },
    };
    void gemAlleRettigheder(updated);
  }

  if (!bruger || !erAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Kun admin/owner har adgang.
      </div>
    );
  }

  const aktivFane = aktiveFaner.find((t) => t.id === aktivTabId) || aktiveFaner[0];

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-6xl mx-auto space-y-5">
          <button
            onClick={() => navigate('/kontrolpanel')}
            className="text-sm text-gray-500"
          >
            ← Tilbage
          </button>

          <h1 className="text-3xl font-bold">Rettigheder & Roller</h1>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              {aktiveFaner.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setAktivTabId(tab.id);
                    setViserFaneRettigheder(false);
                  }}
                  className={`px-3 py-1.5 rounded-full border text-sm ${
                    aktivTabId === tab.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <button
                type="button"
                onClick={opretFane}
                className="px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-gray-50"
                title="Tilføj fane"
              >
                +
              </button>
            </div>

            {aktivFane && (
              <div className="flex items-center gap-1 text-sm">
                <button
                  type="button"
                  className="flex items-center gap-1 font-semibold px-2 py-1 rounded-full hover:bg-gray-100"
                  onClick={() => setViserFaneRettigheder((v) => !v)}
                  title="Klik for at vælge rettigheder for denne fane i højre panel"
                >
                  <span>{aktivFane.label}</span>
                  <span className="text-xs text-gray-500">
                    {viserFaneRettigheder ? '▼' : '▶'}
                  </span>
                </button>
                <button
                  onClick={omdoebAktivFane}
                  className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                  title="Omdøb fane"
                >
                  ✏
                </button>
                <button
                  onClick={sletAktivFane}
                  className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                  title="Slet fane"
                >
                  🗑
                </button>
                <button
                  onClick={seBrugereIFane}
                  className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                  title="Se alle brugere under denne fane"
                >
                  👥
                </button>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="bg-white border rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <h2 className="font-semibold">
                  Roller og grupper i fanen "{aktivFane?.label}"
                </h2>
                <div className="flex gap-2">
                  <input
                    value={nyNavn}
                    onChange={(e) => setNyNavn(e.target.value)}
                    placeholder="Navn på rolle eller gruppe"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={opretLoesRolle}
                    className="px-3 py-2 rounded-lg bg-indigo-700 text-white text-sm"
                  >
                    Opret
                  </button>
                  <button
                    onClick={opretGruppe}
                    className="px-3 py-2 rounded-lg bg-green-700 text-white text-sm"
                  >
                    Opret gruppe
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {rollerIaktivFane.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm">Løse roller</h3>
                    {rollerIaktivFane.map((navn) => (
                      <div
                        key={navn}
                        className="flex items-center justify-between border rounded-lg px-2 py-1.5"
                      >
                        <button
                          onClick={() => setValgtRolleNavn(navn)}
                          className={`text-sm text-left ${
                            valgtRolleNavn === navn
                              ? 'text-blue-700 font-medium'
                              : ''
                          }`}
                        >
                          {navn}
                        </button>
                        <div className="flex gap-1">
                          <button
                            className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                            onClick={() => omdoebRolle(navn)}
                            title="Rediger navn"
                          >
                            ✏
                          </button>
                          <button
                            className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                            onClick={() => sletRolle(navn)}
                            title="Slet rolle"
                          >
                            🗑
                          </button>
                          <button
                            className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                            onClick={() => navigate('/brugere')}
                            title="Se medlemmer med denne rolle"
                          >
                            👥
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {grupperIaktivFane.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Grupper</h3>
                    {grupperIaktivFane.map((group) => (
                      <div
                        key={group.id}
                        className="border rounded-xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm">
                            {group.label}
                          </span>
                          <div className="flex gap-1">
                            <button
                              className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                              onClick={() => {
                                const nyt = window.prompt(
                                  'Nyt gruppenavn:',
                                  group.label
                                );
                                if (!nyt?.trim()) return;
                                const updated = groups.map((g) =>
                                  g.id === group.id
                                    ? { ...g, label: nyt.trim() }
                                    : g
                                );
                                opdaterGroups(updated);
                              }}
                              title="Omdøb gruppe"
                            >
                              ✏
                            </button>
                            <button
                              className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                              onClick={() => navigate('/brugere')}
                              title="Se medlemmer i gruppen"
                            >
                              👥
                            </button>
                            <button
                              className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                              onClick={() => opretGruppeRolle(group.id)}
                              title="Tilføj rolle under gruppen"
                            >
                              ➕
                            </button>
                            <button
                              className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                              onClick={() => sletGruppe(group.id)}
                              title="Slet gruppe"
                            >
                              🗑
                            </button>
                          </div>
                        </div>

                        {(grupperoller[group.id] || []).map((navn) => (
                          <div
                            key={navn}
                            className="flex items-center justify-between border rounded-lg px-2 py-1"
                          >
                            <button
                              onClick={() => setValgtRolleNavn(navn)}
                              className={`text-sm text-left ${
                                valgtRolleNavn === navn
                                  ? 'text-blue-700 font-medium'
                                  : ''
                              }`}
                            >
                              {navn}
                            </button>
                            <div className="flex gap-1">
                              <button
                                className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                                onClick={() => omdoebRolle(navn)}
                                title="Rediger navn"
                              >
                                ✏
                              </button>
                              <button
                                className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                                onClick={() => sletRolle(navn)}
                                title="Slet rolle"
                              >
                                🗑
                              </button>
                              <button
                                className="px-2 py-1 text-xs rounded-full border bg-white hover:bg-gray-50"
                                onClick={() => navigate('/brugere')}
                                title="Se medlemmer med denne rolle"
                              >
                                👥
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-4 space-y-3">
              {viserFaneRettigheder ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold">
                      Rettigheder for fane: {aktivFane?.label}
                    </h2>
                    <button
                      onClick={() => gemAlleRettigheder(permissions)}
                      className="px-3 py-1.5 text-xs rounded-full bg-gray-900 text-white"
                    >
                      💾
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Vælg hvilke rettigheder roller under denne fane i princippet
                    må have. Roller kan aldrig få mere end det, du markerer her.
                  </p>
                  <div className="space-y-2">
                    {['Sider', 'Kontrolpanel', 'Filer', 'Generelt'].map((gruppe) => {
                      const rettighederForGruppe = alleFaneRettigheder.filter(
                        (r) => r.gruppe === gruppe
                      );
                      if (!rettighederForGruppe.length) return null;
                      return (
                        <details
                          key={gruppe}
                          className="border rounded-lg bg-gray-50"
                          open
                        >
                          <summary className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-gray-700 flex items-center gap-2">
                            <span>▾</span>
                            <span>{gruppe}</span>
                          </summary>
                          <div className="px-3 pb-2 pt-1 grid md:grid-cols-2 gap-1 text-xs">
                            {rettighederForGruppe.map((r) => {
                              const checked = !!(
                                faneRettigheder[aktivTabId] || []
                              ).includes(r.id);
                              return (
                                <label
                                  key={r.id}
                                  className="flex items-center gap-2 border rounded px-2 py-1 bg-white"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      toggleFaneRet(aktivTabId, r.id)
                                    }
                                  />
                                  <span>{r.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold">
                      Rettigheder for rolle:{' '}
                      {valgtRolleNavn || (
                        <span className="text-gray-500">–</span>
                      )}
                    </h2>
                    <button
                      disabled={!valgtRolleNavn}
                      onClick={() => gemAlleRettigheder(permissions)}
                      className="px-3 py-1.5 text-xs rounded-full bg-gray-900 text-white disabled:bg-gray-400"
                      title="Gem rettigheder"
                    >
                      💾
                    </button>
                  </div>

                  {!valgtRolleNavn && (
                    <p className="text-xs text-gray-500">
                      Vælg en rolle i venstre side for at tildele rettigheder.
                    </p>
                  )}

                  {valgtRolleNavn && aktivRolleConfig && (
                    <div className="space-y-2 text-sm">
                      <p className="text-xs text-gray-500">
                        Rettigheder begrænses af fanens loft. Du kan ikke give
                        denne rolle mere end det, der er markeret under fanens
                        rettigheder.
                      </p>
                      <div className="space-y-2">
                        {['Sider', 'Kontrolpanel', 'Filer', 'Generelt'].map(
                          (gruppe) => {
                            const rettighederForGruppe =
                              alleFaneRettigheder.filter(
                                (r) => r.gruppe === gruppe
                              );
                            if (!rettighederForGruppe.length) return null;
                            return (
                              <details
                                key={gruppe}
                                className="border rounded-lg bg-gray-50"
                                open
                              >
                                <summary className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-gray-700 flex items-center gap-2">
                                  <span>▾</span>
                                  <span>{gruppe}</span>
                                </summary>
                                <div className="px-3 pb-2 pt-1 grid md:grid-cols-2 gap-1 text-xs">
                                  {rettighederForGruppe.map((r) => {
                                    const faneSet = new Set(
                                      faneRettigheder[aktivTabId] || []
                                    );
                                    const allowed = faneSet.has(r.id);
                                    const roleHas = (
                                      aktivRolleConfig.rights || []
                                    ).includes(r.id);
                                    return (
                                      <label
                                        key={r.id}
                                        className={`flex items-center gap-2 border rounded px-2 py-1 ${
                                          allowed
                                            ? 'bg-white'
                                            : 'bg-gray-100 opacity-60'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          disabled={!allowed}
                                          checked={roleHas && allowed}
                                          onChange={() => {
                                            const current =
                                              normalizePermissions(permissions);
                                            const cfg =
                                              current[valgtRolleNavn] ||
                                              aktivRolleConfig;
                                            const set = new Set(
                                              cfg.rights || []
                                            );
                                            if (set.has(r.id)) set.delete(r.id);
                                            else set.add(r.id);
                                            const next = {
                                              ...current,
                                              [valgtRolleNavn]: {
                                                ...cfg,
                                                rights: Array.from(set),
                                              },
                                            };
                                            setPermissions(next);
                                          }}
                                        />
                                        <span>{r.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </details>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs text-gray-500">
                      Brug nøgle-ikonet rundt omkring på siden for at finjustere,
                      hvilke roller der har adgang til konkrete mapper og bokse.
                      Ændringer der bliver lavet dér, synkroniseres med denne
                      side.
                    </p>
                  </div>
                </>
              )}

              {Object.keys(objektSektionMap).length > 0 && (
                <div className="border-t pt-3 mt-3 space-y-2">
                  <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <span>🔑</span>
                    <span>Nøgleobjekter</span>
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Her kan du åbne nøglepanelet for konkrete kasser og mapper.
                    Når du gemmer der, opdateres rettighederne her på siden.
                  </p>
                  <div className="space-y-1.5 text-xs">
                    {Object.entries(objektSektionMap).map(([key, section]) => (
                      <details key={key} className="border rounded-lg bg-gray-50" open>
                        <summary className="cursor-pointer px-3 py-1.5 font-semibold text-gray-700 flex items-center gap-2">
                          <span>▾</span>
                          <span>{section.label}</span>
                          <span className="text-[11px] text-gray-400">
                            ({section.items.length})
                          </span>
                        </summary>
                        <div className="px-3 pb-2 pt-1 space-y-1">
                          {key === 'mindmap'
                            ? Object.entries(
                                section.items.reduce((acc, obj) => {
                                  const g = obj.groupLabel || 'Uden gruppe';
                                  if (!acc[g]) acc[g] = [];
                                  acc[g].push(obj);
                                  return acc;
                                }, {})
                              ).map(([groupLabel, items]) => (
                                <div key={groupLabel} className="space-y-1">
                                  <div className="text-[11px] font-semibold text-gray-600 px-1 mt-1">
                                    {groupLabel}
                                  </div>
                                  {items
                                    .slice()
                                    .sort((a, b) =>
                                      a.objectLabel.localeCompare(b.objectLabel, 'da')
                                    )
                                    .map((obj) => (
                                      <div
                                        key={`${obj.boxId}-${obj.folderPath || 'root'}`}
                                        className="flex items-center justify-between border rounded px-2 py-1 bg-white"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate">{obj.objectLabel}</p>
                                          <p className="text-[10px] text-gray-500 truncate">
                                            {obj.objectType === 'mindmap-node'
                                              ? `Mindmap-node: ${obj.folderPath}`
                                              : obj.objectType === 'folder'
                                              ? `Mappe: ${obj.folderPath}`
                                              : `Kasse: ${obj.boxId}`}
                                          </p>
                                        </div>
                                        {obj.objectType === 'mindmap-node' && valgtRolleNavn ? (
                                          <div className="flex flex-wrap gap-2 pl-3 text-[10px] text-gray-700">
                                            {(() => {
                                              const rules = mindmapNodeRules[obj.folderPath] || {};
                                              const editContentRoles = Array.isArray(rules.editContentRoles)
                                                ? rules.editContentRoles
                                                : [];
                                              const editColorRoles = Array.isArray(rules.editColorRoles)
                                                ? rules.editColorRoles
                                                : [];
                                              const deleteNodeRoles = Array.isArray(rules.deleteNodeRoles)
                                                ? rules.deleteNodeRoles
                                                : [];
                                              const editAssociationRoles = Array.isArray(rules.editAssociationRoles)
                                                ? rules.editAssociationRoles
                                                : [];

                                              const hasEditContent = editContentRoles.includes(valgtRolleNavn);
                                              const hasEditColor = editColorRoles.includes(valgtRolleNavn);
                                              const hasDelete = deleteNodeRoles.includes(valgtRolleNavn);
                                              const hasEditAssociation = editAssociationRoles.includes(valgtRolleNavn);

                                              return (
                                                <>
                                                  <label className="flex items-center gap-1">
                                                    <input type="checkbox" readOnly checked={hasEditContent} />
                                                    <span>Indhold</span>
                                                  </label>
                                                  <label className="flex items-center gap-1">
                                                    <input type="checkbox" readOnly checked={hasEditColor} />
                                                    <span>Farver</span>
                                                  </label>
                                                  <label className="flex items-center gap-1">
                                                    <input type="checkbox" readOnly checked={hasDelete} />
                                                    <span>Slet</span>
                                                  </label>
                                                  <label className="flex items-center gap-1">
                                                    <input type="checkbox" readOnly checked={hasEditAssociation} />
                                                    <span>Association</span>
                                                  </label>
                                                </>
                                              );
                                            })()}
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => navigate('/mindmap')}
                                            className="px-2 py-1 text-[11px] rounded-full border bg-white hover:bg-gray-50"
                                            title="Gå til mindmap"
                                          >
                                            ↗
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              ))
                            : section.items.map((obj) => (
                                <div
                                  key={`${obj.boxId}-${obj.folderPath || 'root'}`}
                                  className="flex items-center justify-between border rounded px-2 py-1 bg-white"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate">{obj.objectLabel}</p>
                                    <p className="text-[10px] text-gray-500 truncate">
                                      {obj.objectType === 'folder'
                                        ? `Mappe: ${obj.folderPath}`
                                        : `Kasse: ${obj.boxId}`}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAccessTarget({
                                        boxId: obj.boxId,
                                        folderPath: obj.folderPath,
                                        label: obj.objectLabel,
                                        objectType: obj.objectType,
                                      })
                                    }
                                    className="px-2 py-1 text-[11px] rounded-full border bg-white hover:bg-gray-50"
                                    title="Rediger adgang for dette objekt"
                                  >
                                    🔑
                                  </button>
                                </div>
                              ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {accessTarget && (
        <AccessKeyPanel
          isOpen={!!accessTarget}
          onClose={async () => {
            setAccessTarget(null);
            await hentRettigheder();
          }}
          boxId={accessTarget.boxId}
          folderPath={accessTarget.folderPath}
          objectLabel={accessTarget.label}
          objectType={accessTarget.objectType}
          showHideToggle={true}
        />
      )}
    </>
  );
}
