import { Link } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';

export default function Navigation() {
  const { isAdmin, toggleAdmin } = useAdmin();
  const navLinks = [
    { path: '/', label: 'Forside' },
    { path: '/mindmap', label: 'Mindmap' },
    { path: '/skolekort', label: 'Skolekort' },
    { path: '/ressourcer', label: 'Ressourcer' },
    { path: '/arkiv', label: 'Arkiv' }
  ];

  return (
    <nav className="bg-blue-500 text-white">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <ul className="flex flex-wrap gap-6">
          {navLinks.map((link) => (
            <li key={link.path}>
              <Link 
                to={link.path} 
                className="hover:text-blue-200 transition-colors duration-200"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
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
    </nav>
  );
}
