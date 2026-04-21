import os
import json
import secrets
import logging
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode
from pathlib import Path

from dotenv import load_dotenv
import httpx
import redis
from supabase import create_client
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# =========================
# Configuración base
# =========================
BASE_DIR = Path(__file__).resolve().parent

# Busca .env.local subiendo hasta encontrarlo (máximo 4 niveles)
def find_env_file(start: Path, filename: str = ".env.local", max_levels: int = 4) -> Path | None:
    current = start
    for _ in range(max_levels):
        candidate = current / filename
        if candidate.exists():
            return candidate
        current = current.parent
    return None

ENV_PATH = find_env_file(BASE_DIR)

if ENV_PATH:
    load_dotenv(dotenv_path=ENV_PATH)
    print(f"✅ .env.local cargado desde: {ENV_PATH}")
else:
    load_dotenv()  # fallback al directorio de trabajo
    print(f"⚠️ .env.local no encontrado. Usando variables de entorno del sistema.")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("repnet-meli-api")

app = FastAPI()

# =========================
# Variables de entorno
# =========================
ML_APP_ID = os.environ.get("ML_APP_ID", "").strip()
ML_CLIENT_SECRET = os.environ.get("ML_CLIENT_SECRET", "").strip()
ML_REDIRECT_URI = os.environ.get("ML_REDIRECT_URI", "").strip()
FRONTEND_SUCCESS_URL = os.environ.get("FRONTEND_SUCCESS_URL", "").strip()

ALLOWED_ML_USER_ID = os.environ.get("ALLOWED_ML_USER_ID", "").strip()
REDIS_URL = os.environ.get("REDIS_URL", "").strip()

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "").strip()

# =========================
# Validación inicial
# =========================
required_env = {
    "ML_APP_ID": ML_APP_ID,
    "ML_CLIENT_SECRET": ML_CLIENT_SECRET,
    "ML_REDIRECT_URI": ML_REDIRECT_URI,
    "FRONTEND_SUCCESS_URL": FRONTEND_SUCCESS_URL,
    "REDIS_URL": REDIS_URL,
}

missing_env = [k for k, v in required_env.items() if not v]
if missing_env:
    logger.warning(f"Faltan variables de entorno requeridas: {missing_env}")

# =========================
# Clientes
# =========================
r = None
sb = None

try:
    if REDIS_URL:
        r = redis.from_url(REDIS_URL, decode_responses=True)
        r.ping()
        logger.info(f"✅ Redis conectado correctamente: {REDIS_URL}")
    else:
        logger.warning("⚠️ REDIS_URL no está definido.")
except Exception as e:
    logger.error(f"❌ No se pudo conectar a Redis: {e}")
    r = None

try:
    if SUPABASE_URL and SUPABASE_KEY:
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("✅ Supabase inicializado correctamente.")
    else:
        logger.warning("⚠️ Supabase no está configurado. Se omitirá persistencia en base de datos.")
except Exception as e:
    logger.error(f"❌ Error inicializando Supabase: {e}")
    sb = None

# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://repnet.online",
        "https://www.repnet.online",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Helpers
# =========================
def now_utc():
    return datetime.now(timezone.utc)

def build_frontend_success_url(user_id: str | None = None):
    """Construye la URL de éxito post-OAuth. FRONTEND_SUCCESS_URL debe ser la URL limpia sin params."""
    if user_id:
        return f"{FRONTEND_SUCCESS_URL}?meli=connected&user_id={user_id}"
    return f"{FRONTEND_SUCCESS_URL}?meli=connected"

def ensure_redis_available():
    if not r:
        raise RuntimeError("Redis no está disponible. Revisa REDIS_URL y que Redis esté levantado.")

def build_meli_auth_redirect():
    ensure_redis_available()

    state = secrets.token_urlsafe(24)
    logger.info(f"🔐 Generando state OAuth: {state}")

    payload = {
        "ok": True,
        "created_at": now_utc().isoformat(),
    }

    r.setex(
        f"meli:oauth:{state}",
        600,
        json.dumps(payload),
    )
    logger.info(f"✅ State OAuth guardado en Redis: meli:oauth:{state}")

    params = {
        "response_type": "code",
        "client_id": ML_APP_ID,
        "redirect_uri": ML_REDIRECT_URI,
        "state": state,
    }

    auth_url = "https://auth.mercadolibre.cl/authorization?" + urlencode(params)
    logger.info(f"➡️ Redirigiendo a Mercado Libre OAuth: {auth_url}")

    return RedirectResponse(auth_url)

def save_token_in_redis(token_data: dict):
    ensure_redis_available()

    access_token = token_data.get("access_token", "")
    user_id = str(token_data.get("user_id", "")).strip()
    expires_in = int(token_data.get("expires_in", 21600))
    expires_at = now_utc() + timedelta(seconds=expires_in)

    if not access_token or not user_id:
        raise ValueError("Token inválido: faltan access_token o user_id.")

    r.set("meli:token:current", json.dumps(token_data))
    r.set("meli:token:expires_at", expires_at.isoformat())
    logger.info(f"✅ Token guardado en Redis para ML user_id={user_id}, expira en {expires_at.isoformat()}")

def redis_token_is_valid():
    if not r:
        logger.warning("⚠️ Redis no está disponible al validar token.")
        return False, None, "redis_unavailable"

    raw = r.get("meli:token:current")
    expires_at_raw = r.get("meli:token:expires_at")

    logger.info(f"🧪 Redis token raw: {'presente' if raw else 'ausente'}")
    logger.info(f"🧪 Redis expires_at raw: {expires_at_raw}")

    if not raw:
        return False, None, "no_token_in_redis"

    try:
        token_data = json.loads(raw)
    except Exception as e:
        logger.error(f"❌ Error parseando token desde Redis: {e}")
        return False, None, "invalid_json"

    access_token = token_data.get("access_token", "")
    user_id = str(token_data.get("user_id", "")).strip()

    if not access_token or not user_id:
        logger.warning("⚠️ Token en Redis incompleto.")
        return False, None, "missing_access_token_or_user_id"

    if expires_at_raw:
        try:
            expires_at = datetime.fromisoformat(expires_at_raw)
            if now_utc() >= expires_at:
                logger.warning(f"⚠️ Token expirado en Redis. expires_at={expires_at.isoformat()}")
                return False, None, "expired_token"
        except Exception as e:
            logger.error(f"❌ Error parseando expires_at desde Redis: {e}")
            return False, None, "invalid_expires_at"

    logger.info(f"✅ Token válido encontrado en Redis para user_id={user_id}")
    return True, token_data, "redis_ok"

def save_connection_in_supabase(token_data: dict, user_id: str):
    if not sb:
        logger.warning("⚠️ Supabase no está disponible. Se omite guardado en DB.")
        return

    expires_in = int(token_data.get("expires_in", 21600))
    expires_at = now_utc() + timedelta(seconds=expires_in)

    row = {
        "ml_user_id": user_id,
        "access_token": token_data.get("access_token", ""),
        "refresh_token": token_data.get("refresh_token", ""),
        "expires_at": expires_at.isoformat(),
        "is_active": True,
        "updated_at": now_utc().isoformat(),
    }

    logger.info(f"💾 Guardando conexión en Supabase para user_id={user_id}")

    existing = (
        sb.table("meli_global_connection")
        .select("id")
        .eq("ml_user_id", user_id)
        .limit(1)
        .execute()
    )

    if existing.data and len(existing.data) > 0:
        (
            sb.table("meli_global_connection")
            .update(row)
            .eq("ml_user_id", user_id)
            .execute()
        )
        logger.info(f"✅ Conexión actualizada en Supabase para user_id={user_id}")
    else:
        row["created_at"] = now_utc().isoformat()
        sb.table("meli_global_connection").insert(row).execute()
        logger.info(f"✅ Conexión insertada en Supabase para user_id={user_id}")

def supabase_connection_is_valid():
    if not sb:
        logger.warning("⚠️ Supabase no está disponible al validar conexión.")
        return False, None, "supabase_unavailable"

    try:
        result = (
            sb.table("meli_global_connection")
            .select("ml_user_id, access_token, refresh_token, is_active, expires_at, updated_at")
            .eq("is_active", True)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )

        logger.info(f"🧪 Resultado Supabase meli_global_connection: {result.data}")

        if not result.data or len(result.data) == 0:
            return False, None, "no_active_connection"

        row = result.data[0]

        if not row.get("access_token") or not row.get("ml_user_id"):
            return False, None, "missing_access_token_or_user_id"

        expires_at_raw = row.get("expires_at")
        if expires_at_raw:
            try:
                expires_at = datetime.fromisoformat(expires_at_raw)
                if now_utc() >= expires_at:
                    logger.warning(f"⚠️ Token expirado en Supabase. expires_at={expires_at.isoformat()}")
                    return False, None, "expired_token"
            except Exception as e:
                logger.error(f"❌ Error parseando expires_at desde Supabase: {e}")
                return False, None, "invalid_expires_at"

        logger.info(f"✅ Conexión válida encontrada en Supabase para user_id={row.get('ml_user_id')}")
        return True, row, "supabase_ok"

    except Exception as e:
        logger.error(f"❌ Error consultando Supabase: {e}")
        return False, None, "supabase_query_error"

# =========================
# Rutas base
# =========================
@app.get("/")
def root():
    return {
        "ok": True,
        "service": "repnet-meli-api",
        "redis_enabled": bool(r),
        "supabase_enabled": bool(sb),
    }

# =========================
# OAuth Mercado Libre
# =========================
@app.get("/meli/oauth/login")
def meli_oauth_login():
    try:
        return build_meli_auth_redirect()
    except Exception as e:
        logger.error(f"❌ Error en /meli/oauth/login: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "meli_oauth_login_failed",
                "detail": str(e),
            },
        )

@app.get("/meli/oauth/start")
def meli_oauth_start():
    try:
        return build_meli_auth_redirect()
    except Exception as e:
        logger.error(f"❌ Error en /meli/oauth/start: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "meli_oauth_start_failed",
                "detail": str(e),
            },
        )

@app.get("/auth/login")
def auth_login_alias():
    try:
        return build_meli_auth_redirect()
    except Exception as e:
        logger.error(f"❌ Error en /auth/login: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "auth_login_failed",
                "detail": str(e),
            },
        )

async def process_oauth_callback(code: str | None = None, state: str | None = None, source_path: str = ""):
    logger.info(f"📥 Callback recibido en {source_path}")

    if not code:
        logger.error("❌ Callback sin code")
        #raise HTTPException(status_code=400, detail="Falta code")
        return RedirectResponse(f"{FRONTEND_SUCCESS_URL}?meli=error&reason=missing_code")

    if not state:
        logger.error("❌ Callback sin state")
        #raise HTTPException(status_code=400, detail="Falta state")
        return RedirectResponse(f"{FRONTEND_SUCCESS_URL}?meli=error&reason=missing_state")

    logger.info(f"🧪 Callback params => code={'presente' if code else 'ausente'}, state={state}")

    ensure_redis_available()

    raw = r.get(f"meli:oauth:{state}")
    logger.info(f"🧪 Redis state lookup => key=meli:oauth:{state}, found={'sí' if raw else 'no'}")

    if not raw:
        logger.error(f"❌ State no encontrado en Redis: {state}")
        return RedirectResponse(f"{FRONTEND_SUCCESS_URL}?meli=error&reason=state_expired")

    data = {
        "grant_type": "authorization_code",
        "client_id": ML_APP_ID,
        "client_secret": ML_CLIENT_SECRET,
        "code": code,
        "redirect_uri": ML_REDIRECT_URI,
    }

    logger.info(f"➡️ Intercambiando code por token con Mercado Libre para redirect_uri={ML_REDIRECT_URI}")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.mercadolibre.com/oauth/token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    logger.info(f"🧪 Respuesta token endpoint status={resp.status_code}")

    if resp.status_code >= 400:
        logger.error(f"❌ Error token_exchange_failed: {resp.text}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "token_exchange_failed",
                "status_code": resp.status_code,
                "detail": resp.text,
            },
        )

    token_data = resp.json()
    user_id = str(token_data.get("user_id", "")).strip()

    logger.info(f"🧪 token_data recibido => user_id={user_id}, keys={list(token_data.keys())}")

    if not user_id:
        logger.error("❌ Mercado Libre no devolvió user_id")
        return JSONResponse(
            status_code=500,
            content={
                "error": "missing_user_id",
                "detail": "Mercado Libre no devolvió user_id en el token.",
                "token_data": token_data,
            },
        )

    if ALLOWED_ML_USER_ID and user_id != ALLOWED_ML_USER_ID:
        logger.warning(f"⛔ Cuenta no autorizada. Esperado={ALLOWED_ML_USER_ID}, recibido={user_id}")
        return JSONResponse(
            status_code=403,
            content={
                "error": "unauthorized_meli_account",
                "user_id": user_id,
            },
        )

    try:
        save_token_in_redis(token_data)
    except Exception as e:
        logger.error(f"❌ Error guardando token en Redis: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "redis_save_failed",
                "detail": str(e),
            },
        )

    try:
        save_connection_in_supabase(token_data, user_id)
    except Exception as e:
        logger.error(f"❌ Error guardando conexión en Supabase: {e}")

    try:
        r.delete(f"meli:oauth:{state}")
        logger.info(f"🧹 State OAuth eliminado de Redis: meli:oauth:{state}")
    except Exception as e:
        logger.warning(f"⚠️ No se pudo eliminar el state OAuth: {e}")

    final_redirect = f"{FRONTEND_SUCCESS_URL}?meli=connected&user_id={user_id}"
    logger.info(f"✅ OAuth completo. Redirigiendo a: {final_redirect}")

    return RedirectResponse(final_redirect)

@app.get("/auth/callback")
async def auth_callback(code: str | None = None, state: str | None = None):
    return await process_oauth_callback(code=code, state=state, source_path="/auth/callback")

@app.get("/meli/oauth/callback")
async def meli_oauth_callback(code: str | None = None, state: str | None = None):
    return await process_oauth_callback(code=code, state=state, source_path="/meli/oauth/callback")

# =========================
# Estado de conexión
# =========================
@app.get("/ml/status")
def ml_status():
    logger.info("📡 Consultando estado de conexión Mercado Libre")

    redis_ok, token_data, redis_reason = redis_token_is_valid()
    logger.info(f"🧪 Resultado Redis => ok={redis_ok}, reason={redis_reason}")

    if redis_ok and token_data:
        return {
            "connected": True,
            "user_id": str(token_data.get("user_id")),
            "source": "redis",
            "detail": redis_reason,
        }

    supabase_ok, row, supabase_reason = supabase_connection_is_valid()
    logger.info(f"🧪 Resultado Supabase => ok={supabase_ok}, reason={supabase_reason}")

    if supabase_ok and row:
        return {
            "connected": True,
            "user_id": str(row.get("ml_user_id")),
            "source": "supabase",
            "detail": supabase_reason,
        }

    return {
        "connected": False,
        "user_id": None,
        "source": None,
        "redis_detail": redis_reason,
        "supabase_detail": supabase_reason,
    }

# =========================
# Debug
# =========================
@app.get("/meli/token/debug")
def meli_token_debug():
    if not r:
        return {"ok": False, "message": "Redis no está disponible"}

    raw = r.get("meli:token:current")
    expires_at_raw = r.get("meli:token:expires_at")

    if not raw:
        return {
            "ok": False,
            "message": "No hay token guardado",
            "expires_at": expires_at_raw,
        }

    try:
        token_data = json.loads(raw)
    except Exception as e:
        return {
            "ok": False,
            "message": "Token guardado pero JSON inválido",
            "detail": str(e),
            "raw": raw,
        }

    return {
        "ok": True,
        "token_data": token_data,
        "expires_at": expires_at_raw,
    }

@app.get("/meli/oauth/debug")
def meli_oauth_debug():
    return {
        "ML_APP_ID": ML_APP_ID,
        "ML_REDIRECT_URI": ML_REDIRECT_URI,
        "FRONTEND_SUCCESS_URL": FRONTEND_SUCCESS_URL,
        "ALLOWED_ML_USER_ID": ALLOWED_ML_USER_ID,
        "REDIS_URL": REDIS_URL,
        "REDIS_ENABLED": bool(r),
        "SUPABASE_ENABLED": bool(sb),
    }

@app.get("/meli/oauth/debug/env")
def meli_oauth_debug_env():
    """Verifica que todas las variables críticas estén cargadas."""
    return {
        "ML_APP_ID": ML_APP_ID[:6] + "..." if ML_APP_ID else "❌ VACÍO",
        "ML_CLIENT_SECRET": "✅ presente" if ML_CLIENT_SECRET else "❌ VACÍO",
        "ML_REDIRECT_URI": ML_REDIRECT_URI or "❌ VACÍO",
        "FRONTEND_SUCCESS_URL": FRONTEND_SUCCESS_URL or "❌ VACÍO",
        "ALLOWED_ML_USER_ID": ALLOWED_ML_USER_ID or "⚠️ no seteado (permite cualquier cuenta)",
        "REDIS_URL": REDIS_URL or "❌ VACÍO",
        "REDIS_CONNECTED": bool(r),
        "env_path_used": str(ENV_PATH),
        "env_path_exists": ENV_PATH.exists() if 'ENV_PATH' in dir() else "no aplica",
    }