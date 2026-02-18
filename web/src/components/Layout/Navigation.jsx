import { Link, useLocation } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';

export default function Navigation() {
  const location = useLocation();
  const { isAdmin, toggleAdmin } = useAdmin();

  const navItems = [
    { path: '/', label: 'Hjem' },
    { path: '/kontrolpanel', label: 'Kontrolpanel' },
    { path: '/mindmap', label: 'Mindmap' },
    { path: '/skolekort', label: 'Skolekort' },
    { path: '/ressourcer', label: 'Ressourcer' },
    { path: '/arkiv', label: 'Arkiv' },
  ];

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Main Navigation */}
          <div className="flex space-x-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-6 py-4 font-medium transition-all duration-200 whitespace-nowrap border-b-2 ${
                  location.pathname === item.path
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Admin Toggle Button */}
          <button
            onClick={toggleAdmin}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2 ${
              isAdmin
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={isAdmin ? 'Deaktiver Admin Mode' : 'Aktiver Admin Mode'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{isAdmin ? 'Admin' : 'Admin'}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
