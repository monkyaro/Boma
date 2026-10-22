"""Create local-only credentials without printing them or overwriting a file."""
import os
from pathlib import Path
import secrets

path = Path(__file__).resolve().parents[1] / ".env"
if path.exists():
    print("Local environment file already exists; left unchanged.")
else:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as output:
        output.write("BOMA_LOCAL_ADMIN_PASSWORD=" + secrets.token_urlsafe(32) + "\n")
        output.write("BOMA_LOCAL_DB_PASSWORD=" + secrets.token_urlsafe(32) + "\n")
    print("Local credentials created in ignored .env with owner-only permissions.")
