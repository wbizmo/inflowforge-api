## Release Notes

inFlowForge API v1.0.1 is a security, reliability, and performance hardening release for the production workflow automation API.

### Security

- Upgraded Fastify to the patched 5.12.x line.
- Upgraded the Swagger UI/static dependency chain.
- Refreshed Prisma tooling and patched vulnerable `mysql2` and `deepmerge-ts` transitives.
- Applied non-breaking npm audit remediation for remaining utility advisories; the moderate-severity audit gate is clean.
- Hardened admin authentication with fail-closed configuration handling and constant-time token comparison.
- Removed full workflow job payloads from routine BullMQ worker logs.

### Performance

- Throttled API-key `lastUsedAt` persistence to at most roughly once per key per five-minute freshness window instead of one database write per authenticated request.
- Added bounded cursor pagination for workflow, execution, and audit-log lists: 50 records by default and a maximum of 100 per page.
- Moved per-workflow execution analytics aggregation into PostgreSQL instead of materializing and repeatedly filtering all execution rows in Node.js.
- Added focused composite indexes for tenant/time and execution-status query paths.

### Reliability and Validation

- Added a 10-second deadline to Telegram requests.
- Reuses the Resend client instead of constructing a client for each email action.
- Aligned workflow condition validation with the documented and engine-supported single-condition and condition-array forms.
- Preserved the existing SSRF protections, resolved-destination pinning, redirect blocking, response-size cap, and timeout behavior for custom HTTP actions.

### CI and Release Verification

- Added permanent Node 22 CI with PostgreSQL 16 and Redis 7.
- Pull requests are verified with `npm ci`, `npm audit --audit-level=moderate`, Prisma generation and schema initialization, deterministic seed data, TypeScript build, ESLint, and the complete test suite.
- The final v1.0.1 release head passed this full gate before merge.

### Compatibility

No response-envelope breaking changes are intended. Workspace list endpoints still return arrays. List endpoints are now bounded; use the `x-next-cursor` response header to request additional pages.

### Deployment

Production API: https://inflowforge-api.onrender.com

Documentation: https://inflowforge-api.onrender.com/docs

Health check: https://inflowforge-api.onrender.com/health
