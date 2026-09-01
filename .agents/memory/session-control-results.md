---
name: Session control response shape
description: Teacher live-control mutations must return the full session shape used by the teacher room UI.
---

Teacher-owned moderation actions need to return the same full session representation as the teacher's session polling endpoint; moderator views can use the slimmer moderation representation.

**Why:** Live controls update cached room state immediately, and the teacher UI needs quiz questions, timer settings, and participants after the mutation. Returning only moderation fields makes the next render incomplete.

**How to apply:** When adding teacher-only session mutations, preserve the role-aware response shape and keep the OpenAPI contract aligned with both consumers.