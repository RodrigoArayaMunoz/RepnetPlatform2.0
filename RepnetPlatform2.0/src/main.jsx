import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./frontend/Login.jsx";
import MainLayout from "./frontend/components/MainLayout.jsx";
import MainSyncJobs from "./frontend/components/MainSyncJobs.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/menu" element={<MainLayout />}>
          <Route path="procesos/sincronizacion" element={<MainSyncJobs />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);