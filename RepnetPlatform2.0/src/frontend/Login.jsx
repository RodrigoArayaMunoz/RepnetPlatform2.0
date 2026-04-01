import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/Login.css";
import loginVisual from "../assets/repnetmercadolibre_logo.png";
import { supabase } from "../lib/supabase";
import repnetlogo from "../assets/repnetsolo_logo.png";

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="input-icon" aria-hidden="true">
    <path
      d="M4 7.5L10.94 12.46C11.57 12.91 12.43 12.91 13.06 12.46L20 7.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="3"
      y="5"
      width="18"
      height="14"
      rx="2.5"
      stroke="currentColor"
      strokeWidth="1.8"
    />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="input-icon" aria-hidden="true">
    <path
      d="M8 10V7.75C8 5.68 9.68 4 11.75 4H12.25C14.32 4 16 5.68 16 7.75V10"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <rect
      x="5"
      y="10"
      width="14"
      height="10"
      rx="2.5"
      stroke="currentColor"
      strokeWidth="1.8"
    />
  </svg>
);

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setErrorMsg("");
    setLoading(true);

    const startTime = Date.now();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    const elapsed = Date.now() - startTime;
    const remaining = Math.max(2500 - elapsed, 0);

    await wait(remaining);

    if (error) {
      setLoading(false);
      setErrorMsg("Correo o contraseña incorrectos");
      return;
    }

    navigate("/menu");
  };

  return (
    <>
{loading && (
  <div className="login-loading-overlay" aria-live="polite" aria-busy="true">
    <div className="login-loading-box">
      <div className="login-spinner-wrap">
        <div className="login-spinner"></div>
        <img
          src={repnetlogo}
          alt="Repnet"
          className="login-spinner-logo"
        />
      </div>
    </div>
  </div>
)}

      <main className={`login-page ${loading ? "login-page--blocked" : ""}`}>
        <div className="login-layout">
          <section className="login-left">
            <div className="brand-visual-wrapper">
              <img
                src={loginVisual}
                alt="Marcas asociadas"
                className="brand-visual"
              />
            </div>
          </section>

          <section className="login-right">
            <div className="login-card">
              <div className="login-card-content">
                <form className="login-form" onSubmit={handleSubmit}>
                  <div className="input-group">
                    <span className="icon-wrapper">
                      <MailIcon />
                    </span>
                    <input
                      type="email"
                      name="email"
                      placeholder="Usuario"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="input-group">
                    <span className="icon-wrapper">
                      <LockIcon />
                    </span>
                    <input
                      type="password"
                      name="password"
                      placeholder="Password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  {errorMsg && <p className="auth-message error">{errorMsg}</p>}

                  <button type="submit" className="login-btn" disabled={loading}>
                    Ingresar
                  </button>
                </form>
              </div>
            </div>

            <div className="curve curve-one"></div>
            <div className="curve curve-two"></div>
          </section>
        </div>
      </main>
    </>
  );
}