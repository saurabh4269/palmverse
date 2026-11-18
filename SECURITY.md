# Security Policy

Palmverse is a static WebXR app with no server, accounts or analytics. It does not request camera access, and readings are stored only in the browser's `localStorage`.

## Reporting a vulnerability
Please report security issues privately through [GitHub security advisories](https://github.com/saurabh4269/palmverse/security/advisories/new) rather than a public issue. Include steps to reproduce and the browser or headset version. You can expect a reply within a week.

## Secrets
The voice and music tools read an ElevenLabs key from `ELEVENLABS_API_KEY` or `--key-file` at render time only. No key is needed to build or run the app, and none should ever be committed.
