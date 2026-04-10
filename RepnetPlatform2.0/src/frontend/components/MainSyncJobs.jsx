import { useEffect, useMemo, useState } from "react";
import "../styles/MainSyncJobs.css";
import { supabase } from "../../lib/supabase.js";
import MercadoLibreConnectModal from "../components/MercadoLibreConnectModal.jsx";

export default function MainSyncJobs() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [now, setNow] = useState(new Date());
  const [processRows, setProcessRows] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTable, setIsLoadingTable] = useState(true);

  const [isConnectingMl, setIsConnectingMl] = useState(false);
  const [isMercadoLibreConnected, setIsMercadoLibreConnected] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadProcesses();
    checkMercadoLibreConnection();
  }, []);

  useEffect(() => {
    if (!isMercadoLibreConnected) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMercadoLibreConnected]);

  const formattedDate = useMemo(() => {
    return now.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [now]);

  const formattedTime = useMemo(() => {
    return now.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }, [now]);

  const sqlDate = useMemo(() => {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [now]);

  const sqlTime = useMemo(() => {
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }, [now]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const formatTableDateTime = (fechaProceso, horaProceso) => {
    if (!fechaProceso) return "-";

    const [year, month, day] = fechaProceso.split("-");
    const safeTime = horaProceso ? horaProceso.slice(0, 8) : "00:00:00";

    return `${day}-${month}-${year} ${safeTime}`;
  };

  const mapProcessRow = (row) => ({
    id: row.id,
    procesoId: row.proceso_id,
    archivo: row.archivo,
    fecha: formatTableDateTime(row.fecha_proceso, row.hora_proceso),
    procesadoPor: row.generado,
    estado: row.estado,
  });

  const loadProcesses = async () => {
    try {
      setIsLoadingTable(true);

      const { data, error } = await supabase
        .from("procesos")
        .select("id, proceso_id, archivo, fecha_proceso, hora_proceso, generado, estado")
        .order("fecha_proceso", { ascending: false })
        .order("hora_proceso", { ascending: false });

      if (error) {
        console.error("Error al cargar procesos:", error);
        alert("No se pudo cargar el historial de procesos.");
        return;
      }

      setProcessRows((data || []).map(mapProcessRow));
    } catch (err) {
      console.error("Error inesperado al cargar procesos:", err);
      alert("Ocurrió un error al cargar los procesos.");
    } finally {
      setIsLoadingTable(false);
    }
  };

  const checkMercadoLibreConnection = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Error obteniendo usuario:", userError);
        setIsMercadoLibreConnected(false);
        return;
      }

      if (!user) {
        setIsMercadoLibreConnected(false);
        return;
      }

      // Ajusta esta consulta según cómo guardas el estado de conexión.
      // Ejemplo 1: tabla perfiles con columna meli_connected
      const { data, error } = await supabase
        .from("usuarios")
        .select("meli_connected")
        .eq("id", user.id)
        .single();

      if (error) {
        console.warn("No se pudo verificar conexión MercadoLibre:", error.message);
        setIsMercadoLibreConnected(false);
        return;
      }

      setIsMercadoLibreConnected(data?.meli_connected === true);
    } catch (error) {
      console.error("Error verificando conexión con MercadoLibre:", error);
      setIsMercadoLibreConnected(false);
    }
  };

  const handleConnectMercadoLibre = async () => {
    try {
      setIsConnectingMl(true);

      // Cambia esta URL por la real de tu backend OAuth
      const apiUrl = import.meta.env.VITE_API_URL;


      if (!apiUrl) {
        alert("Falta configurar VITE_API_URL en tu archivo .env");
        setIsConnectingMl(false);
        return;
      }

      window.location.href = `${apiUrl}/meli/oauth/start`;
    } catch (error) {
      console.error("Error al iniciar conexión con MercadoLibre:", error);
      alert("No se pudo iniciar la conexión con MercadoLibre.");
      setIsConnectingMl(false);
    }
  };

  const handleSaveProcess = async () => {
    if (!selectedFile) {
      alert("Debes seleccionar un archivo Excel antes de grabar el proceso.");
      return;
    }

    try {
      setIsSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Error obteniendo usuario autenticado:", userError);
        alert("No se pudo obtener el usuario autenticado.");
        return;
      }

      if (!user?.email) {
        alert("No se encontró el correo del usuario logeado.");
        return;
      }

      const safeFileName = selectedFile.name.replace(/\s+/g, "_");
      const uniqueFileName = `${Date.now()}_${safeFileName}`;
      const storagePath = `${user.id}/${uniqueFileName}`;
      const bucketName = "excel-procesos";

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Error subiendo archivo a Storage:", uploadError);
        alert(`No se pudo subir el archivo: ${uploadError.message}`);
        return;
      }

      const payload = {
        archivo: selectedFile.name,
        fecha_proceso: sqlDate,
        hora_proceso: sqlTime,
        generado: user.email,
        estado: "Pendiente",
        storage_bucket: bucketName,
        storage_path: storagePath,
      };

      const { data, error } = await supabase
        .from("procesos")
        .insert([payload])
        .select("id, proceso_id, archivo, fecha_proceso, hora_proceso, generado, estado, storage_bucket, storage_path")
        .single();

      if (error) {
        console.error("Error al grabar proceso en tabla:", error);

        await supabase.storage.from(bucketName).remove([storagePath]);

        alert(`No se pudo grabar el proceso: ${error.message}`);
        return;
      }

      setProcessRows((prev) => [mapProcessRow(data), ...prev]);
      setSelectedFile(null);

      const fileInput = document.querySelector(".main-sync-jobs__file-input");
      if (fileInput) fileInput.value = "";

      alert(`Proceso ${data.proceso_id} grabado correctamente.`);
    } catch (err) {
      console.error("Error inesperado al grabar proceso:", err);
      alert("Ocurrió un error inesperado al grabar el proceso.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateProcesses = () => {
    alert("Procesos generados correctamente.");
  };

  const getStatusClass = (status) => {
    const normalized = status.toLowerCase();

    if (normalized === "procesado" || normalized === "completado") {
      return "status-badge status-badge--success";
    }

    if (normalized === "pendiente") {
      return "status-badge status-badge--warning";
    }

    if (normalized === "error") {
      return "status-badge status-badge--danger";
    }

    return "status-badge";
  };

  return (
    <>
      <MercadoLibreConnectModal
        open={!isMercadoLibreConnected}
        onConnect={handleConnectMercadoLibre}
        loading={isConnectingMl}
      />

      <div className="main-sync-jobs">
        <div className="main-sync-jobs__card">
          <div className="main-sync-jobs__row">
            <div className="main-sync-jobs__field main-sync-jobs__field--file">
              <label className="main-sync-jobs__label">Archivo para procesar</label>

              <label className="main-sync-jobs__file-box">
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv"
                  onChange={handleFileChange}
                  className="main-sync-jobs__file-input"
                />
                <span className="main-sync-jobs__file-button">
                  Seleccionar archivo
                </span>
                <span className="main-sync-jobs__file-name">
                  {selectedFile ? selectedFile.name : "Ningún archivo seleccionado"}
                </span>
              </label>
            </div>

            <div className="main-sync-jobs__field">
              <label className="main-sync-jobs__label">Fecha Proceso</label>
              <div className="main-sync-jobs__info-box">{formattedDate}</div>
            </div>

            <div className="main-sync-jobs__field">
              <label className="main-sync-jobs__label">Hora Proceso</label>
              <div className="main-sync-jobs__info-box">{formattedTime}</div>
            </div>
          </div>

          <div className="main-sync-jobs__actions">
            <button
              type="button"
              className="main-sync-jobs__save-button"
              onClick={handleSaveProcess}
              disabled={isSaving}
            >
              {isSaving ? "Grabando..." : "Grabar Proceso"}
            </button>
          </div>
        </div>

        <div className="main-sync-jobs__table-card">
          <div className="main-sync-jobs__table-header">
            <h2 className="main-sync-jobs__table-title">Historial de procesos</h2>
          </div>

          <div className="main-sync-jobs__table-scroll">
            <table className="process-table">
              <thead>
                <tr>
                  <th>Archivo procesado</th>
                  <th>Fecha Proceso</th>
                  <th>Procesado por</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {isLoadingTable ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center" }}>
                      Cargando procesos...
                    </td>
                  </tr>
                ) : processRows.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center" }}>
                      No hay procesos registrados.
                    </td>
                  </tr>
                ) : (
                  processRows.map((row) => (
                    <tr key={row.id}>
                      <td title={row.archivo}>{row.archivo}</td>
                      <td>{row.fecha}</td>
                      <td>{row.procesadoPor}</td>
                      <td>
                        <span className={getStatusClass(row.estado)}>
                          {row.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="main-sync-jobs__generate">
          <button
            type="button"
            className="main-sync-jobs__generate-button"
            onClick={handleGenerateProcesses}
          >
            Generar Procesos
          </button>
        </div>
      </div>
    </>
  );
}