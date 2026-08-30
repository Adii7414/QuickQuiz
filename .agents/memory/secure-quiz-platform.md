---
name: Secure quiz platform decisions
description: Durable security and product constraints for the quiz platform.
---

Teacher access is an approval-gated flow: application first, moderator approval second, then a short-lived single-use registration key. Raw keys are encrypted at rest so authorized moderators can recover them later without storing plaintext.

**Why:** Students must never be able to create teacher accounts directly, moderator credentials must remain outside the frontend, and moderation needs persistent recovery without weakening storage security.

**How to apply:** Keep role checks server-side, keep moderator provisioning environment-only, derive encryption from the server-only session secret, expose raw keys only through authorized moderator flows, and invalidate keys after registration.