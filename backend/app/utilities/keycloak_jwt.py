from functools import wraps
import jwt
import redis
import hashlib
from flask import request, current_app, g


class KeycloakJWT(object):
    """Verifies Keycloak access tokens against the realm JWKS.

    The verified claims are stored on ``flask.g.token`` (per request), and the
    caller as ``g.user = {"name", "userId"}``.
    """

    def __init__(self, app=None):
        self._jwks_client = None
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        app.config.setdefault('KEYCLOAK_ISSUER', None)
        app.config.setdefault('KEYCLOAK_AUDIENCE', None)

    def _jwks(self):
        issuer = current_app.config.get('KEYCLOAK_ISSUER')
        if not issuer:
            raise jwt.InvalidIssuerError("Authentication is not configured")
        issuer = issuer.rstrip('/')
        endpoint = current_app.config.get("KEYCLOAK_JWKS_URL") or f"{issuer}/protocol/openid-connect/certs"
        clients = current_app.extensions.setdefault("boma_jwks_clients", {})
        if endpoint not in clients:
            clients[endpoint] = jwt.PyJWKClient(endpoint, cache_keys=True)
        return clients[endpoint]

    def decode(self, token):
        signing_key = self._jwks().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=current_app.config['KEYCLOAK_AUDIENCE'],
            issuer=current_app.config['KEYCLOAK_ISSUER'],
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )

    def require_token(self, view_func):
        """
        Use this to decorate view functions that require a user to be logged in.
        """
        @wraps(view_func)
        def decorated(*args, **kwargs):
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                return {"message": "Authorization token not provided"}, 401

            parts = auth_header.split()
            if len(parts) != 2:
                return {"message": "Invalid token"}, 401
            try:
                claims = self.decode(parts[1])
                if not isinstance(claims.get("sub"), str) or not 1 <= len(claims["sub"]) <= 36:
                    raise jwt.InvalidTokenError("Invalid subject")
            except jwt.PyJWTError:
                return {"message": "Invalid token"}, 401

            if request.method not in {"GET", "HEAD", "OPTIONS"}:
                limit = max(1, current_app.config.get("API_WRITE_RATE_PER_MINUTE", 60))
                cache = current_app.extensions.get("boma_rate_limits")
                if cache is None:
                    cache = redis.Redis.from_url(current_app.config["CELERY_BROKER_URL"], socket_timeout=2)
                    current_app.extensions["boma_rate_limits"] = cache
                subject = hashlib.sha256(claims["sub"].encode()).hexdigest()
                try:
                    count = cache.eval(
                        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
                        1, "boma:write-limit:" + subject)
                except redis.RedisError:
                    return {"message": "Request protection is temporarily unavailable"}, 503
                if count > limit:
                    return {"message": "Too many requests; please try again in a minute"}, 429

            g.token = claims
            g.user = {
                "name": claims.get("name", claims.get("preferred_username", "")),
                "userId": claims["sub"]}
            return view_func(*args, **kwargs)

        return decorated

    def check_realm_access(self, *roles):
        """Pass if the token has ANY of the given realm roles. Use under require_token."""
        def wrapper(view_func):
            @wraps(view_func)
            def decorated(*args, **kwargs):
                token_roles = g.token.get('realm_access', {}).get('roles', [])
                if any(role in token_roles for role in roles):
                    return view_func(*args, **kwargs)
                return {'message': 'You do not have permission to perform this action'}, 403
            return decorated
        return wrapper

    def check_resource_access(self, client, *roles):
        """Pass if the token has ANY of the given roles for the client. Use under require_token."""
        def wrapper(view_func):
            @wraps(view_func)
            def decorated(*args, **kwargs):
                token_roles = g.token.get('resource_access', {}).get(
                    client, {}).get('roles', [])
                if any(role in token_roles for role in roles):
                    return view_func(*args, **kwargs)
                return {'message': 'You do not have permission to perform this action'}, 403
            return decorated
        return wrapper
