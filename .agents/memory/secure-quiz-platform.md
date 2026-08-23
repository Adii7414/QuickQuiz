---
name: Secure quiz platform decisions
description: Durable security and product constraints for the quiz platform.
---

Teacher access is an approval-gated flow: application first, moderator approval second, then a short-lived single-use registration key.

**Why:** Students must never be able to create teacher accounts directly, and moderator credentials must remain outside the frontend.

**How to apply:** Keep role checks server-side, keep moderator provisioning environment-only, never expose raw registration keys except to the moderator immediately after approval, and invalidate keys after registration.