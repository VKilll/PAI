import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pakketten from './pages/Pakketten';
import Samenwerkingen from './pages/Samenwerkingen';
import Verkoopfacturen from './pages/Verkoopfacturen';
import MijnFacturen from './pages/MijnFacturen';
import Berichten from './pages/Berichten';
import Financien from './pages/Financien';
import Reizen from './pages/Reizen';
import Content from './pages/Content';
import Briefings from './pages/Briefings';
import Research from './pages/Research';
import Statistieken from './pages/Statistieken';
import Engagement from './pages/Engagement';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2 } },
});

function Beschermd({ children }) {
  const { gebruiker, laden } = useAuth();
  if (laden) return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <p className="font-serif text-goud-500 text-lg">PA Atelier laden...</p>
    </div>
  );
  return gebruiker ? children : <Navigate to="/login" replace />;
}

// Verkoopfacturen zijn van de manager, eigen facturen van de influencer/PA
function AlleenRollen({ rollen, children }) {
  const { gebruiker } = useAuth();
  return rollen.includes(gebruiker?.rol) ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { gebruiker } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={gebruiker ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Beschermd><Layout /></Beschermd>}>
        <Route index element={<Dashboard />} />
        <Route path="pakketten" element={<Pakketten />} />
        <Route path="samenwerkingen" element={<Samenwerkingen />} />
        <Route path="verkoopfacturen" element={<AlleenRollen rollen={['manager']}><Verkoopfacturen /></AlleenRollen>} />
        <Route path="mijn-facturen" element={<AlleenRollen rollen={['influencer', 'pa']}><MijnFacturen /></AlleenRollen>} />
        <Route path="berichten" element={<AlleenRollen rollen={['influencer']}><Berichten /></AlleenRollen>} />
        <Route path="financien" element={<Financien />} />
        <Route path="reizen" element={<Reizen />} />
        <Route path="content" element={<Content />} />
        <Route path="briefings" element={<Briefings />} />
        <Route path="research" element={<Research />} />
        <Route path="statistieken" element={<Statistieken />} />
        <Route path="engagement" element={<Engagement />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
