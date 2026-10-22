# Import every model here so Flask-Migrate sees them.
from .listings.listing_model import Listing  # noqa: F401
from .onboarding.onboarding_model import IdentityVerificationCase  # noqa: F401
