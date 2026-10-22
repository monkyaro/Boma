from functools import wraps
import jwt
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
        if self._jwks_client is None:
            issuer = current_app.config['KEYCLOAK_ISSUER'].rstrip('/')
            self._jwks_client = jwt.PyJWKClient(
                f"{issuer}/protocol/openid-connect/certs", cache_keys=True)
        return self._jwks_client

    def decode(self, token):
        signing_key = self._jwks().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=current_app.config['KEYCLOAK_AUDIENCE'],
            issuer=current_app.config['KEYCLOAK_ISSUER'],
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

            try:
                claims = self.decode(auth_header.split(None, 1)[1].strip())
            except jwt.PyJWTError:
                return {"message": "Invalid token"}, 401

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
