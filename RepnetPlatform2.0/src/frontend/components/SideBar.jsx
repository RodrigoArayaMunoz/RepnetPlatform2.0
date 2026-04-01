import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  X,
  Boxes,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  RefreshCcw,
  History,
} from "lucide-react";
import logo from "../../assets/repnetsolo_logo.png";
import mlLogo from "../../assets/repnetmercadolibrepopup_logo-removebg-preview.png";
import "../styles/SideBar.css";

const navItems = [
  {
    key: "compatibilidades",
    label: "PROCESOS",
    icon: Boxes,
    children: [
      {
        to: "/compatibilidades/carga-masiva",
        label: "Sincronización de Procesos",
        icon: RefreshCcw,
      },
    ],
  },
  {
    key: "actualizaciones",
    label: "HISTORIAL",
    icon: History,
    children: [
      {
        to: "/actualizaciones/precios-stock",
        label: "Historial de Procesos",
        icon: FileSpreadsheet,
      },
    ],
  },
];

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const location = useLocation();

  const [isMlConnected, setIsMlConnected] = useState(false);
  const [connectingMl, setConnectingMl] = useState(false);

  const getMenuStateFromPath = (pathname) => ({
    compatibilidades: pathname.startsWith("/compatibilidades"),
    actualizaciones: pathname.startsWith("/actualizaciones"),
  });

  const [openMenus, setOpenMenus] = useState(
    getMenuStateFromPath(location.pathname)
  );

  useEffect(() => {
    setOpenMenus(getMenuStateFromPath(location.pathname));
  }, [location.pathname]);

  const toggleMenu = (key) => {
    setOpenMenus((prev) => ({
      compatibilidades:
        key === "compatibilidades" ? !prev.compatibilidades : false,
      actualizaciones:
        key === "actualizaciones" ? !prev.actualizaciones : false,
    }));
  };

  const isChildActive = (to) => location.pathname === to;

  const isGroupActive = (children) =>
    children.some((child) => location.pathname === child.to);

  const handleConnectMercadoLibre = async () => {
    try {
      setConnectingMl(true);

      // Aquí después conectas la lógica real de OAuth con MercadoLibre
      // Por ahora simulo la conexión exitosa:
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setIsMlConnected(true);
    } catch (error) {
      console.error("Error conectando con MercadoLibre:", error);
    } finally {
      setConnectingMl(false);
    }
  };

  return (
    <>
      {!isMlConnected && (
        <div className="ml-modal-overlay" aria-modal="true" role="dialog">
          <div className="ml-modal">
            <img
              src={mlLogo}
              alt="Repnet y Mercado Libre"
              className="ml-modal__logo"
            />

            <button
              type="button"
              className="ml-modal__button"
              onClick={handleConnectMercadoLibre}
              disabled={connectingMl}
            >
              {connectingMl ? "Conectando..." : "Conectar con MercadoLibre"}
            </button>
          </div>
        </div>
      )}

      <div className={!isMlConnected ? "page-blocked" : ""}>
        <div
          className={`sidebar-overlay ${sidebarOpen ? "sidebar-overlay--show" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
          <div className="sidebar__header">
            <div className="sidebar__branding">
              <img src={logo} alt="Repnet" className="sidebar__brand-logo" />
            </div>

            <button
              className="sidebar__close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Cerrar menú"
              type="button"
            >
              <X size={19} />
            </button>
          </div>

          <div className="sidebar__card">
            <p className="sidebar__card-label">Plataforma</p>
            <p className="sidebar__card-text">
              Gestiona compatibilidades y actualizaciones de precios y stock.
            </p>
          </div>

          <nav className="sidebar__nav">
            {navItems.map((group) => {
              const GroupIcon = group.icon;
              const groupOpen = openMenus[group.key];
              const groupActive = isGroupActive(group.children);

              return (
                <div key={group.key} className="sidebar__group">
                  <button
                    type="button"
                    className={`sidebar__group-button ${
                      groupActive ? "sidebar__group-button--active" : ""
                    }`}
                    onClick={() => toggleMenu(group.key)}
                    aria-expanded={groupOpen}
                  >
                    <div className="sidebar__group-left">
                      <span className="sidebar__icon">
                        <GroupIcon size={20} />
                      </span>
                      <span className="sidebar__group-label">{group.label}</span>
                    </div>

                    <span className="sidebar__group-arrow">
                      {groupOpen ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                    </span>
                  </button>

                  <div
                    className={`sidebar__submenu ${
                      groupOpen ? "sidebar__submenu--open" : ""
                    }`}
                  >
                    {group.children.map((item) => {
                      const ItemIcon = item.icon;
                      const active = isChildActive(item.to);

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setSidebarOpen(false)}
                          className={`sidebar__sublink ${
                            active ? "sidebar__sublink--active" : ""
                          }`}
                        >
                          <span className="sidebar__sublink-icon">
                            <ItemIcon size={18} />
                          </span>
                          <span className="sidebar__sublink-text">
                            {item.label}
                          </span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>
      </div>
    </>
  );
}