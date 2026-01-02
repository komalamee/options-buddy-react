"""Email service for sending magic links via Resend.

Uses Resend API (100 free emails/day) for magic link authentication.
"""

import httpx
from typing import Optional

from config import settings


class EmailService:
    """Service for sending transactional emails via Resend."""

    RESEND_API_URL = "https://api.resend.com/emails"

    def __init__(self):
        self.api_key = settings.resend_api_key
        self.from_email = "Options Buddy <onboarding@resend.dev>"  # Use verified domain in production

    async def send_magic_link(self, to_email: str, magic_link_url: str) -> bool:
        """Send a magic link email to the user.

        Args:
            to_email: Recipient email address
            magic_link_url: Full URL of the magic link

        Returns:
            True if email sent successfully, False otherwise
        """
        if not self.api_key:
            print(f"[DEV MODE] Magic link for {to_email}: {magic_link_url}")
            return True

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background-color: #f5f5f5;">
            <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                <h1 style="margin: 0 0 24px; font-size: 24px; color: #1a1a1a;">Sign in to Options Buddy</h1>

                <p style="margin: 0 0 24px; font-size: 16px; color: #666; line-height: 1.5;">
                    Click the button below to sign in. This link will expire in 10 minutes.
                </p>

                <a href="{magic_link_url}"
                   style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px;
                          border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 16px;">
                    Sign In
                </a>

                <p style="margin: 32px 0 0; font-size: 13px; color: #999; line-height: 1.5;">
                    If you didn't request this email, you can safely ignore it.
                </p>

                <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">

                <p style="margin: 0; font-size: 12px; color: #999;">
                    Options Buddy - Your Options Trading Companion
                </p>
            </div>
        </body>
        </html>
        """

        text_content = f"""
Sign in to Options Buddy

Click the link below to sign in. This link will expire in 10 minutes.

{magic_link_url}

If you didn't request this email, you can safely ignore it.

---
Options Buddy - Your Options Trading Companion
        """

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.RESEND_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": self.from_email,
                        "to": [to_email],
                        "subject": "Sign in to Options Buddy",
                        "html": html_content,
                        "text": text_content
                    },
                    timeout=10.0
                )

                if response.status_code == 200:
                    return True
                else:
                    print(f"Resend API error: {response.status_code} - {response.text}")
                    return False

        except Exception as e:
            print(f"Failed to send email: {e}")
            return False


# Singleton instance
email_service = EmailService()
