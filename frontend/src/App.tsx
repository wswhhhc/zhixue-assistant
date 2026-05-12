import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import Practice from './pages/Practice'
import Result from './pages/Result'
import WrongBook from './pages/WrongBook'
import WrongBookDetail from './pages/WrongBookDetail'
import Upload from './pages/Upload'
import QuestionBank from './pages/QuestionBank'

import Report from './pages/Report'
import Favorites from './pages/Favorites'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/result/:id" element={<Result />} />
                  <Route path="/wrong-book" element={<WrongBook />} />
                  <Route path="/wrong-book/:id" element={<WrongBookDetail />} />
                  <Route path="/upload" element={<Upload />} />
                  <Route path="/question-bank" element={<QuestionBank />} />
                  <Route path="/report" element={<Report />} />
                  <Route path="/favorites" element={<Favorites />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
