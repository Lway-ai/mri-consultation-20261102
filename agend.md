# Project notes

- Original study stays in the adjacent directory and is never added to this repository.
- Export 10 series / 320 frames as original signed 16-bit pixels. Preserve original frame order, window center/width, rescale and geometry. No automatic clinical interpretation.
- Public assets must remain AES-256-GCM encrypted. `.private/` is ignored; keys must not appear in commits, logs, or public URLs outside the fragment.
- Repository can be staged privately. Request the user's final approval immediately before making the GitHub Pages publication public.
- Validate pixel round trips, metadata allowlist, browser rendering and frame navigation before handoff.
