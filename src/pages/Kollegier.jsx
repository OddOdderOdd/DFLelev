import { Link } from 'react-router-dom';

export default function Kollegier() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 text-sm text-slate-500">
        <Link to="/ressourcer" className="font-semibold text-blue-600 hover:underline">
          Ressourcer
        </Link>{' '}
        / Kollegier
      </div>
      <h1 className="mb-4 text-4xl font-bold">Kollegier</h1>
      <p className="text-gray-600">Her er Kollegier siden</p>
    </div>
  );
}
