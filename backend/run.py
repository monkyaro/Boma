from app import create_app
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app, celery = create_app()
app.app_context().push()
