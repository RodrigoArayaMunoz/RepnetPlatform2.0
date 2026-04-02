import { useEffect, useMemo, useState } from "react";
import "../styles/MainSyncJobs.css";

export default function MainSyncJobs() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [now, setNow] = useState(new Date());

  const [processRows] = useState([
    {
      id: 1,
      archivo: "20260225_ProductosNV.xlsx",
      fecha: "02-04-2026 11:26:35",
      procesadoPor: "Juan Pérez",
      estado: "Completado",
    },
    {
      id: 2,
      archivo: "20260224_StockGeneral.xlsx",
      fecha: "02-04-2026 10:14:12",
      procesadoPor: "María Soto",
      estado: "Pendiente",
    },
    {
      id: 3,
      archivo: "20260223_PreciosMarketplace.xlsx",
      fecha: "02-04-2026 09:08:47",
      procesadoPor: "Carlos Díaz",
      estado: "Error",
    },
    {
      id: 4,
      archivo: "20260222_CatalogoBase.xlsx",
      fecha: "01-04-2026 18:22:09",
      procesadoPor: "Fernanda Ruiz",
      estado: "Completado",
    },
    {
      id: 5,
      archivo: "20260221_ProductosNV.xlsx",
      fecha: "01-04-2026 16:41:55",
      procesadoPor: "Matías Rojas",
      estado: "Completado",
    },
    {
      id: 6,
      archivo: "20260220_StockBodega.xlsx",
      fecha: "01-04-2026 15:03:21",
      procesadoPor: "Ana Torres",
      estado: "Pendiente",
    },
    {
      id: 7,
      archivo: "20260219_PreciosFinales.xlsx",
      fecha: "01-04-2026 12:50:03",
      procesadoPor: "Pedro Gómez",
      estado: "Error",
    },
    {
      id: 8,
      archivo: "20260218_ProductosML.xlsx",
      fecha: "01-04-2026 11:11:44",
      procesadoPor: "Daniela Castro",
      estado: "Completado",
    },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
    });
  }, [now]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleSaveProcess = () => {
    if (!selectedFile) {
      alert("Debes seleccionar un archivo Excel antes de grabar el proceso.");
      return;
    }

    console.log("Archivo seleccionado:", selectedFile);
    console.log("Fecha proceso:", formattedDate);
    console.log("Hora proceso:", formattedTime);

    alert("Proceso grabado correctamente.");
  };

  const handleGenerateProcesses = () => {
    alert("Procesos generados correctamente.");
  };

  const getStatusClass = (status) => {
    const normalized = status.toLowerCase();

    if (normalized === "completado") {
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
    <div className="main-sync-jobs">
      {/* <h1 className="main-sync-jobs__title">Sincronización de trabajos</h1> */}

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
          >
            Grabar Proceso
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
              {processRows.map((row) => (
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
              ))}
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
  );
}