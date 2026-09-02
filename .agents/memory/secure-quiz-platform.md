---
name: Secure quiz platform decisions
description: Durable security and product constraints for the quiz platform.
---

Teacher access is an approval-gated flow: application first, moderator approval second, then a short-lived single-use registration key. Raw keys are encrypted at rest so authorized moderators can recover them later without storing plaintext.

**Why:** Students must never be able to create teacher accounts directly, moderator credentials must remain outside the frontend, and moderation needs persistent recovery without weakening storage security.

**How to apply:** Keep role checks server-side, keep moderator provisioning environment-only, derive encryption from the server-only session secret, expose raw keys only through authorized moderator flows, and invalidate keys after registration.

Live participant controls have distinct semantics: lock blocks answer submission, mute suppresses room announcements for that participant, and ban removes them and blocks the same name from rejoining that room.

**Why:** These controls need to remain understandable and non-overlapping as teacher and moderator room tools evolve.

**How to apply:** Preserve the three separate states in session polling, server enforcement, and student-facing messaging; do not treat mute as another form of answer lock.