import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdminProvider } from './context/AdminContext'; // Ny import
import Header from './components/Layout/Header';
import Navigation from './components/Layout/Navigation';
import Footer from './components/Layout/Footer';
import Home from './pages/Home';
import Mindmap from './pages/Mindmap'; // Husk: Mindmap siden bruger MindmapCanvas
import UdvalgDetail from './pages/UdvalgDetail';
import Skolekort from './pages/Skolekort';
import Ressourcer from './pages/Ressourcer';
import ArtikelDetail from './pages/ArtikelDetail';
import Kollegier from './pages/Kollegier';
import KollegieDetail from './pages/KollegieDetail';
import Arkiv from './pages/Arkiv';
import ArkivDetail from './pages/ArkivDetail';

function App() {
  return (
    <AdminProvider> {/* Her starter Admin systemet */}
      <BrowserRouter>
        <div className="flex flex-col min-h-screen">
          <Header />
          <Navigation />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/mindmap" element={<Mindmap />} />
              <Route path="/udvalg/:id" element={<UdvalgDetail />} />
              <Route path="/skolekort" element={<Skolekort />} />
              <Route path="/ressourcer" element={<Ressourcer />} />
              <Route path="/artikel/:id" element={<ArtikelDetail />} />
              <Route path="/kollegier" element={<Kollegier />} />
              <Route path="/kollegium/:id" element={<KollegieDetail />} />
              <Route path="/arkiv" element={<Arkiv />} />
              <Route path="/arkiv/:id" element={<ArkivDetail />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AdminProvider>
  );
}

export default App;
