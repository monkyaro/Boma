#!/usr/bin/env python3
"""Run on the approved EC2 host after snapshot availability. Never print credentials."""
import json
import subprocess
import sys
from pathlib import Path


def aws_secret(identifier):
    result = subprocess.run(['aws', 'secretsmanager', 'get-secret-value', '--region', 'eu-west-1',
                             '--secret-id', identifier, '--query', 'SecretString', '--output', 'text'],
                            capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError('Managed secret access failed')
    return json.loads(result.stdout)


PROGRAM = r'''
import json,sys
import psycopg
from psycopg import sql
from urllib.parse import urlparse,unquote
try:
    p=json.load(sys.stdin)
    master=p['master'];meta=p['metadata'];api=p['api'];kc=p['keycloak']
    app_password=unquote(urlparse(api['SQLALCHEMY_DATABASE_URI']).password)
    connection=psycopg.connect(host=meta['Endpoint'],dbname='boma',user=meta['MasterUser'],password=master['password'],sslmode='verify-full',sslrootcert='/run/boma/rds-ca.pem',autocommit=True)
    with connection.cursor() as cursor:
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'spatial_ref_sys'")
        tables=cursor.fetchall()
        if tables:raise RuntimeError('Unexpected application tables; bootstrap stopped')
        cursor.execute("SELECT rolname FROM pg_roles WHERE rolname IN ('boma_app','keycloak')")
        if cursor.fetchall():raise RuntimeError('Existing application roles require review; bootstrap stopped')
        cursor.execute("SELECT 1 FROM pg_database WHERE datname='keycloak'")
        if cursor.fetchone():raise RuntimeError('Existing Keycloak database requires review; bootstrap stopped')
        for role,password in [('boma_app',app_password),('keycloak',kc['KC_DB_PASSWORD'])]:
            cursor.execute(sql.SQL('CREATE ROLE {} LOGIN PASSWORD {}').format(sql.Identifier(role),sql.Literal(password)))
        cursor.execute('ALTER ROLE boma_app SET statement_timeout = \'60s\'')
        cursor.execute(sql.SQL('GRANT keycloak TO {}').format(sql.Identifier(meta['MasterUser'])))
        cursor.execute('CREATE DATABASE keycloak OWNER keycloak')
        cursor.execute('CREATE EXTENSION IF NOT EXISTS postgis')
        cursor.execute('REVOKE ALL ON DATABASE boma FROM PUBLIC')
        cursor.execute('GRANT CONNECT,TEMPORARY ON DATABASE boma TO boma_app')
        cursor.execute('REVOKE CREATE ON SCHEMA public FROM PUBLIC')
        cursor.execute('GRANT USAGE,CREATE ON SCHEMA public TO boma_app')
        cursor.execute('REVOKE ALL ON DATABASE keycloak FROM PUBLIC')
        cursor.execute('GRANT CONNECT ON DATABASE keycloak TO keycloak')
    connection.close()
    print('Isolated application/Keycloak database roles and PostGIS initialized with verified TLS.')
except Exception as error:
    print('Database bootstrap stopped ('+type(error).__name__+'); details/values suppressed.',file=sys.stderr)
    sys.exit(1)
'''


def main():
    directory = Path(sys.argv[1])
    metadata = json.loads((directory / 'db-metadata.json').read_text())
    payload = {'metadata': metadata, 'master': aws_secret(metadata['MasterSecret']),
               'api': aws_secret('/boma/production/api'), 'keycloak': aws_secret('/boma/production/keycloak')}
    result = subprocess.run(['docker', 'run', '--rm', '-i',
                             '-v', str(directory / 'deploy/certs/rds-ca.pem') + ':/run/boma/rds-ca.pem:ro',
                             'boma-api-candidate:1d93d01e6616', 'python', '-c', PROGRAM],
                            input=json.dumps(payload), text=True)
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:
        raise SystemExit('Bootstrap failed (' + type(error).__name__ + '); values suppressed.') from None
