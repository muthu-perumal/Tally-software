import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import NewEntry from './pages/NewEntry/NewEntry';
import Transactions from './pages/Transactions/Transactions';
import TransactionDetails from './pages/TransactionDetails/TransactionDetails';
import Masters from './pages/Masters/Masters';
import TallySync from './pages/TallySync/TallySync';
import Settings from './pages/Settings/Settings';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="entry" element={<NewEntry />} />
        <Route path="edit/:id" element={<NewEntry />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="transactions/:id" element={<TransactionDetails />} />
        <Route path="masters" element={<Masters />} />
        <Route path="sync" element={<TallySync />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
