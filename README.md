# Encrypted MRI consultation viewer

Static, browser-only viewer. The repository contains AES-256-GCM encrypted, gzip-compressed signed 16-bit pixels and allowlisted imaging geometry only. No patient identity tags, raw API responses, original DICOM files or key are published. Source images are not cropped or altered; visual checks cannot guarantee removal of identifying information burned into pixels.

Open the full private share URL with `#key=...`. The fragment is processed in the browser and is not sent as an HTTP request path. Anyone receiving that complete link can decrypt the images, download them, or forward access. Encryption does not provide recipient verification, expiry, or revocation of downloaded copies. Keep the full link private. No analytics, external fonts, CDN scripts, or opinion submission endpoint are used.

Windowing is performed on original signed 16-bit pixel data using DICOM rescale and window parameters. 319 frames decode losslessly. Series 02 frame 99 has truncated source PixelData in both the folder and ZIP; its slot is explicitly marked missing and never displayed as a reconstructed image. All 320 slots remain in original file/instance order; no cross-series spatial synchronization is implied. DWI may contain multiple acquisitions. This page does not replace a diagnostic workstation or complete DICOM review.

Local rebuild: `python build.py` (requires pydicom, numpy, cryptography). It reads the adjacent original study. `.private/key.txt` must never be committed. Serve this directory over localhost HTTP or HTTPS.
