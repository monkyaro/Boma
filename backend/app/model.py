# Import every model here so Flask-Migrate sees them.
from .listings.listing_model import Listing  # noqa: F401
from .onboarding.onboarding_model import IdentityVerificationCase  # noqa: F401
from .workspace.workspace_model import (  # noqa: F401
    Region, District, Ward, OfficerAssignment, AuditEvent, Favorite, Inquiry,
    OfficerMessage, VerificationCase, PropertyChangeRequest, Notification, PropertyViewEvent,
)
from .deals.deals_model import Deal, Offer, CommissionAgreement, CommissionPayment  # noqa: F401
from .bookings.bookings_model import Booking, AvailabilityNight  # noqa: F401
from .media.media_model import ProtectedUpload  # noqa: F401
from .workspace.workspace_model import DeviceToken  # noqa: F401
from .payments.payments_model import SandboxPaymentIntent, SandboxPaymentEvent  # noqa: F401
