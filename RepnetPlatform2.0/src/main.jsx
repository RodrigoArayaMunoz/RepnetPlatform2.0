import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Login from './frontend/Login.jsx'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SideBar from "./frontend/components/SideBar.jsx";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/menu" element={<SideBar />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
