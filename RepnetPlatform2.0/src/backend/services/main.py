import os
import json
import base64
import hashlib
import secrets
from urllib.parse import urlencode

import httpx
import redis
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse

app = FastAPI()

ML_APP_ID = os.environ["ML_APP_ID"]
ML_CLIENT_SECRET = os.environ["ML_CLIENT_SECRET"]
ML_REDIRECT_URI = os.environ["ML_REDIRECT_URI"]
FRONTEND_SUCCESS_URL = os.environ["FRONTEND_SUCCESS_URL"]
ALLOWED_ML_USER_ID = os.environ.get("ALLOWED_ML_USER_ID", "").strip()

r = redis.from_url(os.environ["REDIS_URL"], decode_responses=True)

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def generate_pkce():
    code_verifier = b64url(secrets.token_bytes(32))
    code_challenge = b64url(hashlib.sha256(code_verifier.encode()).digest())
    return code_verifier, code_challenge

@app.get("/")
def root():
    return {"ok": True, "service": "repnet-meli-api"}

@app.get("/meli/oauth/start")
def meli_oauth_start():
    state = secrets.token_urlsafe(24)
    code_verifier, code_challenge = generate_pkce()

    r.setex(f"meli:oauth:{state}", 600, json.dumps({"code_verifier": code_verifier}))

    params = {
        "response_type": "code",
        "client_id": ML_APP_ID,
        "redirect_uri": ML_REDIRECT_URI,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }

    auth_url = "https://auth.mercadolibre.com.ar/authorization?" + urlencode(params)
    return RedirectResponse(auth_url)

@app.get("/meli/oauth/callback")
async def meli_oauth_callback(code: str | None = None, state: str | None = None):
    if not code:
        raise HTTPException(status_code=400, detail="Falta code")
    if not state:
        raise HTTPException(status_code=400, detail="Falta state")

    raw = r.get(f"meli:oauth:{state}")
    if not raw:
        raise HTTPException(status_code=400, detail="State invalido o expirado")

    code_verifier = json.loads(raw)["code_verifier"]

    data = {
        "grant_type": "authorization_code",
        "client_id": ML_APP_ID,
        "client_secret": ML_CLIENT_SECRET,
        "code": code,
        "redirect_uri": ML_REDIRECT_URI,
        "code_verifier": code_verifier,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.mercadolibre.com/oauth/token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if resp.status_code >= 400:
        return JSONResponse(
            status_code=500,
            content={"error": "token_exchange_failed", "detail": resp.text},
        )

    token_data = resp.json()
    user_id = str(token_data.get("user_id", ""))

    if ALLOWED_ML_USER_ID and user_id != ALLOWED_ML_USER_ID:
        return JSONResponse(
            status_code=403,
            content={"error": "unauthorized_meli_account", "user_id": user_id},
        )

    r.set("meli:token:current", json.dumps(token_data))
    r.delete(f"meli:oauth:{state}")

    return RedirectResponse(FRONTEND_SUCCESS_URL)

@app.get("/meli/token/debug")
def meli_token_debug():
    raw = r.get("meli:token:current")
    if not raw:
        return {"ok": False, "message": "No hay token guardado"}
    return json.loads(raw)