import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Kontrolpanel() {
  const { bruger, logout, erAdmin, harRettighed } = useAuth();
  const navigate = useNavigate();

  const rolleBadge = (rolle) => {
    if (rolle === 'Owner') return 'bg-purple-100 text-purple-800';
    if (rolle === 'Admin') return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-50 text-blue-700';
  };

  const menuItems = [
    {
      id: 'profil-opret',
      label: bruger ? 'Se profil' : 'Opret konto',
      icon: bruger ? '🪪' : '👤',
      beskrivelse: bruger ? 'Se og anmod om ændringer til dine profiloplysninger' : 'Opret en ny brugerkonto',
      vis: true,
      path: '/kontrolpanel/opret',
    },
    {
      id: 'login',
      label: 'Login',
      icon: '🔑',
      beskrivelse: 'Log ind med dit e-mailadresse',
      vis: !bruger,
      path: '/kontrolpanel/login',
    },
    {
      id: 'log',
      label: 'Log & Verify',
      icon: '📋',
      beskrivelse: 'Røde flag, bruger-log, rolle-log og verify',
      vis: bruger && (erAdmin || harRettighed('kp:log') || harRettighed('kp:verify')),
      path: '/kontrolpanel/log',
    },
    {
      id: 'brugere',
      label: 'Brugerstyring',
      icon: '👥',
      beskrivelse: 'Se og rediger brugere under dit hierarki',
      vis: bruger && (erAdmin || harRettighed('kp:brugere')),
      path: '/kontrolpanel/brugere',
    },
    {
      id: 'rettigheder',
      label: 'Rettigheder & Roller',
      icon: '🔐',
      beskrivelse: 'Styr myndigheder, roller, årgange og kollegier',
      vis: bruger && erAdmin,
      path: '/kontrolpanel/rettigheder',
    },
  ];

  const synlige = menuItems.filter(item => item.vis);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Kontrolpanel</h1>
          {bruger ? (
            <div>
              <p className="text-gray-600 mb-2">Logget ind som <span className="font-semibold text-green-700">{bruger.navn}</span></p>
              {bruger.myndigheder?.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  {bruger.myndigheder.map((m, i) => (
                    <span key={i} className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${rolleBadge(m.rolle)}`}>{m.rolle}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Log ind for at se dine muligheder</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {synlige.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 text-left hover:shadow-md hover:border-gray-300 transition-all duration-200 group"
            >
              <div className="text-4xl mb-3">{item.icon}</div>
              <h2 className="text-xl font-bold text-gray-800 group-hover:text-green-700 transition-colors">{item.label}</h2>
              <p className="text-gray-500 text-sm mt-1">{item.beskrivelse}</p>
            </button>
          ))}
        </div>

        {bruger && (
          <div className="mt-8 text-center">
            <button onClick={logout} className="text-red-400 hover:text-red-600 text-sm font-medium transition-colors">
              Log ud ({bruger.navn})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
