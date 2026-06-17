import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from './context/AuthContext';
import MainLayout from './components/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ToolList from './pages/ToolList';
import ApplicationList from './pages/ApplicationList';
import ApplyForm from './pages/ApplyForm';
import IssuePage from './pages/IssuePage';
import QualityConfirmPage from './pages/QualityConfirmPage';
import ReturnPage from './pages/ReturnPage';
import InvestigationList from './pages/InvestigationList';
import CalibrationPage from './pages/CalibrationPage';
import ShiftManagementPage from './pages/ShiftManagementPage';
import ShiftHandoverPage from './pages/ShiftHandoverPage';
import PipelineViewPage from './pages/PipelineViewPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <MainLayout>{children}</MainLayout>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />

      <Route path="/tools" element={
        <ProtectedRoute>
          <ToolList />
        </ProtectedRoute>
      } />

      <Route path="/applications" element={
        <ProtectedRoute>
          <ApplicationList />
        </ProtectedRoute>
      } />

      <Route path="/apply" element={
        <ProtectedRoute>
          <ApplyForm />
        </ProtectedRoute>
      } />

      <Route path="/issue" element={
        <ProtectedRoute>
          <IssuePage />
        </ProtectedRoute>
      } />

      <Route path="/quality-confirm" element={
        <ProtectedRoute>
          <QualityConfirmPage />
        </ProtectedRoute>
      } />

      <Route path="/return" element={
        <ProtectedRoute>
          <ReturnPage />
        </ProtectedRoute>
      } />

      <Route path="/investigation" element={
        <ProtectedRoute>
          <InvestigationList />
        </ProtectedRoute>
      } />

      <Route path="/calibration" element={
        <ProtectedRoute>
          <CalibrationPage />
        </ProtectedRoute>
      } />

      <Route path="/shifts" element={
        <ProtectedRoute>
          <ShiftManagementPage />
        </ProtectedRoute>
      } />

      <Route path="/handover" element={
        <ProtectedRoute>
          <ShiftHandoverPage />
        </ProtectedRoute>
      } />

      <Route path="/pipeline" element={
        <ProtectedRoute>
          <PipelineViewPage />
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
