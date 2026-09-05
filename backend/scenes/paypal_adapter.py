"""PayPal webhook signature verification adapter (issue #424).

A real network call to PayPal's `/v1/oauth2/token` and
`/v1/notifications/verify-webhook-signature` endpoints. Kept as its own
thin module so tests substitute `verify_webhook_signature` directly
(monkeypatch) -- exactly the technique `test_google_oauth.py`/
`test_github_oauth.py` already use to replace the one or two points that
talk to a provider over HTTP -- so no real PayPal account or sandbox
credentials are ever contacted by the test suite. A real sandbox
end-to-end transaction is a separately recorded deployment boundary
(#445), not something local/CI tests can or should fake their way past.
"""

import requests
from django.conf import settings

_API_BASES = {
    "sandbox": "https://api-m.sandbox.paypal.com",
    "live": "https://api-m.paypal.com",
}

_REQUEST_TIMEOUT_SECONDS = 10


def _get_access_token() -> str:
    base = _API_BASES[settings.PAYPAL_MODE]
    response = requests.post(
        f"{base}/v1/oauth2/token",
        data={"grant_type": "client_credentials"},
        auth=(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_CLIENT_SECRET),
        timeout=_REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def verify_webhook_signature(headers: dict, body: dict) -> bool:
    """Whether PayPal confirms this webhook delivery is genuine.

    `headers` must carry PayPal's own transmission headers
    (`Paypal-Transmission-Id`, `Paypal-Transmission-Time`,
    `Paypal-Transmission-Sig`, `Paypal-Cert-Url`, `Paypal-Auth-Algo`) and
    `body` is the parsed JSON webhook event. Any missing header or a
    network/API failure is treated as unverified (never "assume valid"),
    via `requests.raise_for_status()` propagating -- callers must not
    apply any state change until this returns `True`.
    """
    base = _API_BASES[settings.PAYPAL_MODE]
    token = _get_access_token()
    payload = {
        "transmission_id": headers.get("Paypal-Transmission-Id"),
        "transmission_time": headers.get("Paypal-Transmission-Time"),
        "cert_url": headers.get("Paypal-Cert-Url"),
        "auth_algo": headers.get("Paypal-Auth-Algo"),
        "transmission_sig": headers.get("Paypal-Transmission-Sig"),
        "webhook_id": settings.PAYPAL_WEBHOOK_ID,
        "webhook_event": body,
    }
    response = requests.post(
        f"{base}/v1/notifications/verify-webhook-signature",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=_REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json().get("verification_status") == "SUCCESS"
