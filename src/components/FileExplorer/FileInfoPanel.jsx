import { useEffect, useState } from 'react';

export default function FileInfoPanel({ item, onClose, onRename, onDelete }) {
  const [nextName, setNextName] = useState(item?.filename || '');

  useEffect(() => {
    setNextName(item?.filename || '');
  }, [item]);

  if (!item) return null;

  return (
    <aside className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Info</p>
          <h3 className="text-lg font-semibold text-slate-900">{item.filename}</h3>
          <p className="text-sm text-slate-500">{item.directory || '/'}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
        >
          Luk
        </button>
      </div>

      <div className="mb-4">
        <label className="text-sm font-semibold text-slate-700">Nyt filnavn</label>
        <input
          type="text"
          value={nextName}
          onChange={(event) => setNextName(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onRename(nextName)}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Omdøb
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          Slet
        </button>
      </div>
    </aside>
  );
}
