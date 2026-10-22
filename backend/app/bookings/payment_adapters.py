"""Provider-neutral sandbox contract. No live provider or custody model is assumed."""
from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol


@dataclass(frozen=True)
class PaymentIntent:
    reference: str
    amount: Decimal
    currency: str
    status: str


class PaymentGateway(Protocol):
    def create_intent(self, reference: str, amount: Decimal, currency: str) -> PaymentIntent: ...
    def verify_callback(self, body: bytes, signature: str) -> dict[str, object]: ...


class DisabledGateway:
    def create_intent(self, reference: str, amount: Decimal, currency: str) -> PaymentIntent:
        raise RuntimeError("Live payments require approved policies and a contracted provider")

    def verify_callback(self, body: bytes, signature: str) -> dict[str, object]:
        raise RuntimeError("No payment provider configured")
