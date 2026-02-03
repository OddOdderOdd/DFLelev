import { Link } from 'react-router-dom';
export default function Navigation() {
  const navLinks = [
    { path: '/', label: 'Forside' },
    { path: '/mindmap', label: 'Mindmap' },
    { path: '/skolekort', label: 'Skolekort' },
    { path: '/ressourcer', label: 'Ressourcer' },
    { path: '/arkiv', label: 'Arkiv' },
  ];

  return (
    <nav className="bg-blue-500 text-white">
      <div className="container mx-auto px-4 py-4">
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
      </div>
    </nav>
  );
}
