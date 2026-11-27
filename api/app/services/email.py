"""Plain-text email over SMTP (L4), standard library only. Off unless SMTP_HOST is set; `send`
never raises, it reports whether the message went out so callers can fall back."""

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.config import Settings

log = logging.getLogger(__name__)


def enabled(settings: Settings) -> bool:
    return bool(settings.smtp_host and (settings.mail_from or settings.smtp_user))


def _send(settings: Settings, to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = settings.mail_from or settings.smtp_user or ""
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(settings.smtp_host or "", settings.smtp_port, timeout=10) as smtp:
        smtp.starttls()
        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password.get_secret_value())
        smtp.send_message(msg)


async def send(settings: Settings, to: str, subject: str, body: str) -> bool:
    if not enabled(settings):
        return False
    try:
        await asyncio.to_thread(_send, settings, to, subject, body)
    except (OSError, smtplib.SMTPException) as exc:
        log.warning("Email to %s failed: %s", to.split("@")[-1], exc)
        return False
    return True
