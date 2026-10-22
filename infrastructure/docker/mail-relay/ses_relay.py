"""Minimal SMTP-to-SES relay for Keycloak's account emails.

Keycloak can only send mail over SMTP, and SES SMTP needs long-lived IAM user
keys. This relay accepts plain SMTP on the private Docker network only and
sends each message with the SES API using the EC2 instance role, which may
send only from *@bomahoop.com.

No port is published. There is no SMTP auth or TLS: only containers on the
internal network can reach it. Addresses and message bodies are never logged.
"""
import asyncio
import logging
import os

import boto3

PORT = int(os.environ.get("RELAY_PORT", "2525"))
ALLOWED_DOMAIN = os.environ.get("RELAY_FROM_DOMAIN", "bomahoop.com").lower()
MAX_BYTES = int(os.environ.get("RELAY_MAX_BYTES", str(1024 * 1024)))
MAX_RECIPIENTS = 10
TIMEOUT = 60

log = logging.getLogger("ses-relay")
ses = None


def send(sender, recipients, data):
    global ses
    if ses is None:
        ses = boto3.client("sesv2", region_name=os.environ.get("AWS_REGION", "eu-west-1"))
    result = ses.send_email(FromEmailAddress=sender,
                            Destination={"ToAddresses": recipients},
                            Content={"Raw": {"Data": data}})
    return result["MessageId"]


def address(argument, prefix):
    if not argument.upper().startswith(prefix):
        return None
    value = argument[len(prefix):].strip().split(" ", 1)[0]
    if not (value.startswith("<") and value.endswith(">")):
        return None
    value = value[1:-1].strip()
    return value if value.count("@") == 1 and len(value) <= 254 else None


async def session(reader, writer):
    async def reply(line):
        writer.write((line + "\r\n").encode())
        await writer.drain()

    sender, recipients = None, []
    await reply("220 boma-relay ESMTP")
    try:
        while True:
            raw = await asyncio.wait_for(reader.readline(), TIMEOUT)
            if not raw:
                return
            line = raw.decode("ascii", "replace").rstrip("\r\n")
            verb, _, argument = line.partition(" ")
            verb = verb.upper()
            if verb == "EHLO":
                await reply("250-boma-relay")
                await reply(f"250 SIZE {MAX_BYTES}")
            elif verb == "HELO":
                await reply("250 boma-relay")
            elif verb == "MAIL":
                sender = address(argument, "FROM:")
                if sender is None or not sender.lower().endswith("@" + ALLOWED_DOMAIN):
                    sender = None
                    await reply("550 Sender not allowed")
                else:
                    recipients = []
                    await reply("250 OK")
            elif verb == "RCPT":
                recipient = address(argument, "TO:")
                if sender is None:
                    await reply("503 MAIL first")
                elif recipient is None or len(recipients) >= MAX_RECIPIENTS:
                    await reply("550 Recipient rejected")
                else:
                    recipients.append(recipient)
                    await reply("250 OK")
            elif verb == "DATA":
                if sender is None or not recipients:
                    await reply("503 MAIL and RCPT first")
                    continue
                await reply("354 End data with <CR><LF>.<CR><LF>")
                chunks, size, too_big = [], 0, False
                while True:
                    chunk = await asyncio.wait_for(reader.readline(), TIMEOUT)
                    if not chunk:
                        return
                    if chunk in (b".\r\n", b".\n"):
                        break
                    if chunk.startswith(b".."):
                        chunk = chunk[1:]
                    size += len(chunk)
                    if size > MAX_BYTES:
                        too_big = True
                    elif not too_big:
                        chunks.append(chunk)
                if too_big:
                    await reply("552 Message too large")
                else:
                    try:
                        message_id = await asyncio.to_thread(send, sender, recipients, b"".join(chunks))
                        log.info("sent ses_message_id=%s recipients=%d", message_id, len(recipients))
                        await reply("250 OK")
                    except Exception as error:  # report the failure class only, never addresses
                        log.warning("ses send failed: %s", type(error).__name__)
                        await reply("451 Temporary failure, try again later")
                sender, recipients = None, []
            elif verb == "RSET":
                sender, recipients = None, []
                await reply("250 OK")
            elif verb == "NOOP":
                await reply("250 OK")
            elif verb == "QUIT":
                await reply("221 Bye")
                return
            else:
                await reply("502 Command not implemented")
    except (asyncio.TimeoutError, ConnectionError, ValueError):
        pass
    finally:
        writer.close()


async def main():
    server = await asyncio.start_server(session, "0.0.0.0", PORT, limit=8192)
    log.info("listening on %d, sender domain %s", PORT, ALLOWED_DOMAIN)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    asyncio.run(main())
