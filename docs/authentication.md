# Authentication and activation integration

The API verifies Keycloak RS256 JWT signatures, issuer, audience, expiry, issued-at and subject. Browser and native clients use Authorization Code + PKCE S256; no public password grant or backend-issued substitute JWT exists. Staff operations additionally require evidence of MFA in the signed `amr` claim (a vetted `mfa` reference or both `pwd` and `otp`) and the appropriate role/geographic assignment. Finance can record receipts within assigned geography without gaining identity/property review access.

The local realm blueprint has public `boma-web`/`boma-mobile` clients with explicit redirects, audience and AMR mappers, role definitions, brute-force protection, and no bundled users. Production realm settings must be applied through a reviewed configuration change. Realm import initializes a missing realm; it does not update an existing one automatically.

A primary email/WhatsApp OTP alone is not accepted as staff MFA. For staff, configure actual MFA execution requirements and an authenticator reference on the completed factor. Never use a constant mapper to claim successful MFA. Keycloak's AMR mapper populates authentication references from completed executions; see the [official authentication-flow guide](https://www.keycloak.org/docs/latest/server_admin/index.html#_authentication-flows) and [protocol mapper reference](https://www.keycloak.org/admin-api/protocol-mappers). Re-test both completed-factor and missing-factor sessions after changing a flow. The supplied local realm alone does not constitute a tested staff-MFA flow.

Owner identity approval is a local business capability, distinct from authentication/property verification. An account can open an identity case and prepare drafts while pending. An approved local case authorizes publishing without requiring a second account or silently elevating Keycloak staff roles. Staff roles are granted through the identity administration process, never a customer endpoint.

## Interim customer registration (owner decision, 2026-10-22)

While the AWS deployment is a test environment awaiting owner acceptance, customers self-register with Keycloak's email + password form: email is the username, the email address must be verified before first sign-in, passwords need at least 10 characters and must not equal the email, and forgotten-password reset by email is enabled. New accounts receive only the default `buyer` role; owner and staff rights still come from the processes above. The web header and signed-out prompts link to Keycloak's registration page.

Keycloak sends account emails over SMTP to the internal `mail-relay` service (`infrastructure/docker/mail-relay/ses_relay.py`), which sends through the SES API with the EC2 instance role (only `*@bomahoop.com` senders; no SMTP keys or IAM users). The relay publishes no port and logs no addresses or message content. Locally, `mailpit` catches the emails at http://localhost:8025. While SES remains in sandbox, mail reaches only SES-verified recipient addresses (200/day); SES production access is required before outside testers can register.

## Activation work still required before launch

Email magic link/OTP and WhatsApp OTP/fallback need a reviewed Keycloak authenticator/broker integration and approved delivery providers. No provider approval or passwordless activation is claimed. The interim email + password registration above stays in place until that integration is tested. Customer registration must not require officer approval; officer identity checks apply only to property owners.

Required delivery adapter contract: generate/send/verify through the chosen Keycloak flow, short-lived single-use challenges, hashed challenge storage, destination/account/IP throttles, resend limits, no account enumeration, no OTP logging, verified email/normalized +255 phone binding, provider signature verification and opted-in fallback. Production secrets come from managed secret storage. Prove replay/expiry/fallback and account-linking behavior in a sandbox before enabling registration.

Staff MFA, device/browser logout and role revocation must also be exercised against the configured provider on real devices before release. Unit tests use mocked claims for authorization and separately verify real cryptographic token validation; neither replaces this integration gate.
