import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  X,
  Boxes,
  ChevronDown,
  ChevronRight,
  RefreshCcw,
  User,
  PlugZap,
  LogOut,
} from "lucide-react";
import logo from "../../assets/repnetsolo_logo.png";
import { supabase } from "../../lib/supabase.js";
import "../styles/SideBar.css";

const navItems = [
  {
    key: "procesos",
    label: "PROCESOS",
    icon: Boxes,
    children: [
      {
        to: "/menu/procesos/sincronizacion",
        label: "Sincronización de Procesos",
        icon: RefreshCcw,
      },
    ],
  },
];

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [userEmail, setUserEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const [isMlConnected, setIsMlConnected] = useState(false);
  const [mlStatusLoading, setMlStatusLoading] = useState(true);

  const getMenuStateFromPath = (pathname) => ({
    procesos: pathname.startsWith("/menu/procesos"),
  });

  const [openMenus, setOpenMenus] = useState(
    getMenuStateFromPath(location.pathname)
  );

  useEffect(() => {
    setOpenMenus(getMenuStateFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      setAuthLoading(true);

      const { data, error } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error) {
        console.error("No se pudo obtener el usuario autenticado:", error);
        setUserEmail("");
        setAuthLoading(false);
        return;
      }

      setUserEmail(data?.user?.email || "");
      setAuthLoading(false);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || "");
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Verificar conexión con Mercado Libre en la tabla meli_global_connection
  useEffect(() => {
    if (authLoading || !userEmail) return;

    let mounted = true;

    const checkMlConnection = async () => {
      setMlStatusLoading(true);
      try {
        const { data, error } = await supabase
          .from("meli_global_connection")
          .select("id, is_active")
          .limit(1)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error("Error verificando conexión ML:", error);
          setIsMlConnected(false);
        } else {
          setIsMlConnected(!!data && data.is_active === true);
        }
      } catch (err) {
        console.error("Error inesperado verificando conexión ML:", err);
        if (mounted) setIsMlConnected(false);
      } finally {
        if (mounted) setMlStatusLoading(false);
      }
    };

    checkMlConnection();

    return () => {
      mounted = false;
    };
  }, [authLoading, userEmail]);

  const toggleMenu = (key) => {
    setOpenMenus((prev) => ({
      procesos: key === "procesos" ? !prev.procesos : false,
    }));
  };

  const isChildActive = (to) => location.pathname === to;

  const isGroupActive = (children) =>
    children.some((child) => location.pathname === child.to);

  const handleSignOut = async () => {
    try {
      if (signingOut) return;

      setSigningOut(true);

      await supabase.auth.signOut();

      setSidebarOpen(false);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      setSigningOut(false);
    }
  };

  const mlStatusLabel = useMemo(() => {
    if (mlStatusLoading) return "Verificando...";
    return isMlConnected ? "Conectado" : "No conectado";
  }, [mlStatusLoading, isMlConnected]);

  return (
    <>
      <div>
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

          <div className="sidebar__card sidebar__card--user">


            <div className="sidebar__user-row">
              <span className="sidebar__user-icon">
                <User size={16} />
              </span>
              <div className="sidebar__user-content">
                <span className="sidebar__user-title">Usuario:</span>
                <span className="sidebar__user-value">
                  {authLoading
                    ? "Cargando..."
                    : userEmail || "No se encontró usuario autenticado"}
                </span>
              </div>
            </div>

            <div className="sidebar__user-row">
              <span className="sidebar__user-icon">
                <PlugZap size={16} />
              </span>
              <div className="sidebar__user-content">
                <span className="sidebar__user-title">
                  Estado Mercado Libre:
                </span>
                <span
                  className={`sidebar__status-badge ${isMlConnected
                      ? "sidebar__status-badge--success"
                      : "sidebar__status-badge--danger"
                    }`}
                >
                  {mlStatusLabel}
                </span>
              </div>
            </div>
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
                    className={`sidebar__group-button ${groupActive ? "sidebar__group-button--active" : ""
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
                    className={`sidebar__submenu ${groupOpen ? "sidebar__submenu--open" : ""
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
                          className={`sidebar__sublink ${active ? "sidebar__sublink--active" : ""
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

          <div className="sidebar__footer">
            <button
              type="button"
              className="sidebar__logout-button"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut size={18} />
              <span>{signingOut ? "Cerrando sesión..." : "Cerrar sesión"}</span>
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}