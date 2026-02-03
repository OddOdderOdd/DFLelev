import { useAdmin } from '../../context/AdminContext';

export default function Header() {
  const { isAdmin, toggleAdmin } = useAdmin();

  return (
    <header className="bg-blue-600 text-white shadow-md">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-6">
        <h1 className="text-3xl font-bold">ElevPåDFL</h1>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={toggleAdmin}
            className="h-4 w-4 cursor-pointer accent-white"
          />
          Admin tools
        </label>
      </div>
    </header>
  );
}
