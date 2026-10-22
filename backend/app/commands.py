import click
from flask.cli import with_appcontext
from sqlalchemy import text
from .extensions import db


@click.command(name='enable_postgis')
@with_appcontext
def enable_postgis():
    """Create the PostGIS extension (needs a role allowed to create extensions)."""
    db.session.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    db.session.commit()
