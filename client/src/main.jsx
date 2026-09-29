import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import './index.css';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import AddDrive from './pages/AddDrive.jsx';
import Ask from './pages/Ask.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DriveDetail from './pages/DriveDetail.jsx';
import Drives from './pages/Drives.jsx';
import Profile from './pages/Profile.jsx';
import Resume from './pages/Resume.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/" replace /> : children;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnly><AuthPage mode="login" /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><AuthPage mode="register" /></PublicOnly>} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="drives" element={<Drives />} />
            <Route path="drives/new" element={<AddDrive />} />
            <Route path="drives/:id" element={<DriveDetail />} />
            <Route path="ask" element={<Ask />} />
            <Route path="resume" element={<Resume />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
