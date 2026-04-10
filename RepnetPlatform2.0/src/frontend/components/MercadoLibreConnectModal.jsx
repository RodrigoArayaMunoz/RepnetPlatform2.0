import React from "react";
import "../styles/MercadoLibreConnectModal.css";
import repnetMercadoLibreLogo from "../../../src/assets/repnetmercadolibrepopup_logo-removebg-preview.png";

export default function MercadoLibreConnectModal({
  open,
  onConnect,
  loading = false,
}) {
  if (!open) return null;

  return (
    <div className="ml-modal-overlay">
      <div className="ml-modal-box">
        <div className="ml-logo-wrapper">
          <img
            src={repnetMercadoLibreLogo}
            alt="Repnet y Mercado Libre"
            className="ml-modal-logo"
          />
        </div>

        <button
          className="ml-connect-btn"
          onClick={onConnect}
          disabled={loading}
        >
          {loading ? "Conectando..." : "Conectar con MercadoLibre"}
        </button>
      </div>
    </div>
  );
}