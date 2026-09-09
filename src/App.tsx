/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Chat from './pages/Chat';
import Login from './pages/Login';
import BusinessOnboarding from './pages/BusinessOnboarding';
import BusinessPortal from './pages/BusinessPortal';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminConfig from './pages/admin/AdminConfig';
import AdminBusiness from './pages/admin/AdminBusiness';
import AdminBusinessesList from './pages/admin/AdminBusinessesList';
import AdminChats from './pages/admin/AdminChats';
import AdminCooperationGraph from './pages/admin/AdminCooperationGraph';
import AdminMap from './pages/admin/AdminMap';
import AdminProspector from './pages/admin/AdminProspector';
import AdminRoofProspecting from './pages/admin/AdminRoofProspecting';
import ObraClimaDashboard from './pages/admin/obraclima/ObraClimaDashboard';
import ObraClimaMiniApp from './pages/admin/obraclima/ObraClimaMiniApp';
import AdminPontevedraProspector from './pages/admin/AdminPontevedraProspector';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/login" element={<Login />} />
        <Route path="/alta-negocio" element={<BusinessOnboarding />} />
        <Route path="/cooperacion" element={<BusinessPortal />} />
        <Route path="/obraclima-miniapp" element={<ObraClimaMiniApp />} />
        <Route path="/obraclima" element={<ObraClimaMiniApp />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="prospector" element={<AdminProspector />} />
          <Route path="pontevedra-prospector" element={<AdminPontevedraProspector />} />
          <Route path="solar" element={<AdminRoofProspecting />} />
          <Route path="obraclima" element={<ObraClimaDashboard />} />
          <Route path="cooperacion" element={<AdminCooperationGraph />} />
          <Route path="business" element={<AdminBusiness />} />
          <Route path="businesses" element={<AdminBusinessesList />} />
          <Route path="map" element={<AdminMap />} />
          <Route path="chats" element={<AdminChats />} />
          <Route path="config" element={<AdminConfig />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

