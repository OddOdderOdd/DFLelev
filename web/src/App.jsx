// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminProvider } from './context/AdminContext';
import Header from './components/Layout/Header';
import Navigation from './components/Layout/Navigation';
import Footer from './components/Layout/Footer';
import Home from './pages/Home';
import Mindmap from './pages/Mindmap';
import UdvalgDetail from './pages/UdvalgDetail';
import Skolekort from './pages/Skolekort';
import Ressourcer from './pages/Ressourcer';
import Arkiv from './pages/Arkiv';
import BoxDetail from './pages/BoxDetail';
import ArtikelDetail from './pages/ArtikelDetail';
import Kontrolpanel from './pages/Kontrolpanel';
import OpretKonto from './pages/OpretKonto';
import Login from './pages/Login';
import Verify from './pages/Verify';
import Log from './pages/Log';
import Brugere from './pages/Brugere';
import RettighederAdmin from './pages/RettighederAdmin';

function App() {
  return (
    // AuthProvider tilføjet her så useAuth() virker i hele appen
    <AuthProvider>
      <AdminProvider>
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
                <Route path="/ressourcer/:id" element={<BoxDetail />} />
                <Route path="/arkiv" element={<Arkiv />} />
                <Route path="/arkiv/:id" element={<BoxDetail />} />
                <Route path="/artikel/:id" element={<ArtikelDetail />} />
                <Route path="/kontrolpanel" element={<Kontrolpanel />} />
                <Route path="/kontrolpanel/opret" element={<OpretKonto />} />
                <Route path="/kontrolpanel/login" element={<Login />} />
                <Route path="/kontrolpanel/verify" element={<Verify />} />
                <Route path="/kontrolpanel/log" element={<Log />} />
                <Route path="/kontrolpanel/brugere" element={<Brugere />} />
                <Route path="/kontrolpanel/rettigheder" element={<RettighederAdmin />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </AdminProvider>
    </AuthProvider>
  );
}

export default App;
