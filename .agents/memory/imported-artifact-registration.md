---
name: Imported artifact registration
description: Replit-specific setup behavior for imported artifact monorepos.
---

Imported artifact folders can contain valid `.replit-artifact/artifact.toml` files without being registered as live artifacts. Register the existing project before relying on managed workflows or artifact preview presentation.

**Why:** A manually configured workflow can run the service, but it does not make the artifact discoverable to the preview system and can leave duplicate workflow state behind.

**How to apply:** Preserve the imported source, bootstrap/register the artifact once, restore the source while retaining generated artifact metadata, then use the exact managed workflow names and remove any temporary replacement workflow.