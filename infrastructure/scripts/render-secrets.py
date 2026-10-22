#!/usr/bin/env python3
"""Render production Compose env files from Secrets Manager through the instance role.

Run on EC2 in a versioned release directory. No secret values are printed.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


def render(values):
    if not isinstance(values, dict) or not values:
        raise ValueError("Expected a nonempty JSON object")
    lines = []
    for key, value in sorted(values.items()):
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
            raise ValueError("Invalid configuration key")
        if not isinstance(value, str) or any(char in value for char in ("'", "\n", "\r", "\x00")):
            raise ValueError("Unsupported configuration value; no values were printed")
        lines.append(f"{key}='{value}'\n")
    return "".join(lines)


def write_private(path, content):
    descriptor, temporary = tempfile.mkstemp(prefix=".boma-", dir=path.parent)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w") as output:
            output.write(content)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--region", default="eu-west-1")
    parser.add_argument("--prefix", default="/boma/production")
    parser.add_argument("--registry", required=True)
    parser.add_argument("--api-tag", required=True)
    parser.add_argument("--web-tag", required=True)
    args = parser.parse_args()
    if not args.directory.is_dir():
        raise ValueError("Deployment directory must already exist")
    staged = {}
    for name, filename in (("api", "api.env"), ("keycloak", "keycloak.env"), ("compose", ".env")):
        result = subprocess.run([
            "aws", "secretsmanager", "get-secret-value", "--region", args.region,
            "--secret-id", f"{args.prefix}/{name}", "--query", "SecretString", "--output", "text",
        ], capture_output=True, text=True, check=False)
        if result.returncode:
            raise RuntimeError("Secret retrieval failed; check instance-role permissions")
        values = json.loads(result.stdout)
        if name == "compose":
            values.update(REGISTRY=args.registry, API_TAG=args.api_tag, WEB_TAG=args.web_tag)
        staged[args.directory / filename] = render(values)
    # Validate all secrets before replacing any file; caller stages a new release directory.
    for path, contents in staged.items():
        write_private(path, contents)
    print("Production runtime files rendered with owner-only permissions; values suppressed.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Never print secret parser errors, subprocess buffers or raw configuration.
        raise SystemExit("Runtime rendering failed (" + type(error).__name__ + "); values suppressed.") from None
