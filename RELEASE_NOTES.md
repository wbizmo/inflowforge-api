# Release Notes

## inFlowForge API v1.0.1 — Security, Reliability & Performance Hardening

Released: 2026-09-10

Tag: `inFlowForge_API_v1.0.1`

GitHub Release: https://github.com/wbizmo/inflowforge-api/releases/tag/inFlowForge_API_v1.0.1

inFlowForge API v1.0.1 is a production hardening release focused on dependency security, safer privileged authentication, bounded data access, lower write amplification, database-side aggregation, better query indexes, safer worker logging, external-action reliability, and a permanent release verification gate.

### Highlights

- Fastify upgraded to the patched 5.12.x line.
- Swagger UI/static dependency chain upgraded.
- Prisma tooling refreshed with patched `mysql2` and `deepmerge-ts` transitive dependencies.
- Remaining moderate-or-higher npm advisories remediated without `--force`.
- Admin token comparison hardened with fail-closed configuration behavior and constant-time comparison.
- BullMQ workflow logs no longer include arbitrary full job payloads.
- API-key usage timestamp writes are throttled to reduce database write amplification.
- Workflow, execution, and audit-log lists now use bounded cursor pagination.
- Workflow execution analytics are aggregated in PostgreSQL instead of repeatedly filtering fully materialized execution sets in Node.js.
- Composite indexes were added for tenant/time and execution-status query paths.
- Telegram requests have a 10-second deadline and the Resend client is reused.
- Workflow condition validation now matches the documented single-condition and array forms.
- Permanent Node.js 22 CI now verifies dependency audit, PostgreSQL, Redis, Prisma, build, lint, and tests before release.

### Pagination Compatibility

Workspace list endpoints still return arrays. The default page size is 50 and the maximum is 100. When more results exist, use the `x-next-cursor` response header for the next request.

### Production

- API: https://inflowforge-api.onrender.com
- Health: https://inflowforge-api.onrender.com/health
- Swagger: https://inflowforge-api.onrender.com/docs

The v1.0.1 tag and Render deployment both point to release commit `fc67daff7c70618f03146abb922f351ca696d1b8`.
