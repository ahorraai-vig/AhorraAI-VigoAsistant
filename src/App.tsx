/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Chat from './pages/Chat';
import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminConfig from './pages/admin/AdminConfig';
import AdminBusiness from './pages/admin/AdminBusiness';
import AdminBusinessesList from './pages/admin/AdminBusinessesList';
import AdminChats from './pages/admin/AdminChats';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="business" element={<AdminBusiness />} />
          <Route path="businesses" element={<AdminBusinessesList />} />
          <Route path="chats" element={<AdminChats />} />
          <Route path="config" element={<AdminConfig />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
