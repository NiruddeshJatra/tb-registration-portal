import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/features/admin/AuthContext'
import { DefaultEventRedirect } from '@/features/register/DefaultEventRedirect'
import { RegisterPage } from '@/features/register/RegisterPage'
import { AdminLoginPage } from '@/features/admin/AdminLoginPage'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { DashboardPage } from '@/features/admin/DashboardPage'
import { RegistrationsPage } from '@/features/admin/RegistrationsPage'
import { ManualAddPage } from '@/features/admin/ManualAddPage'
import { EventConfigPage } from '@/features/admin/EventConfigPage'
import { ReportsPage } from '@/features/admin/ReportsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<DefaultEventRedirect />} />
          <Route path="/register/:eventSlug" element={<RegisterPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="registrations" element={<RegistrationsPage />} />
            <Route path="add" element={<ManualAddPage />} />
            <Route path="events" element={<EventConfigPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
