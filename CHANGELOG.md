# Changelog

All notable changes to inFlowForge API are documented here. This project follows Semantic Versioning.

## [1.0.1] - 2026-09-10

### Security
- Upgraded Fastify to the patched 5.12.x line.
- Upgraded the Swagger UI/static dependency chain.
- Refreshed Prisma tooling and patched vulnerable `mysql2` and `deepmerge-ts` transitive dependencies.
- Applied non-breaking npm audit remediation for remaining utility advisories.
- Added fail-closed admin-token configuration handling and constant-time token comparison.
- Removed full workflow job payloads from routine BullMQ worker logs.

### Performance
- Throttled API-key `lastUsedAt` writes to roughly once per key per five-minute freshness window.
- Added bounded cursor pagination to workflow, execution, and audit-log list endpoints: 50 rows by default, 100 maximum.
- Moved per-workflow execution analytics aggregation into PostgreSQL.
- Added focused composite indexes for tenant/time and execution-status query paths.

### Reliability and Validation
- Added a 10-second deadline to Telegram requests.
- Reused the Resend client rather than constructing a new client for every email action.
- Aligned workflow condition validation with the documented single-condition and condition-array forms.
- Preserved existing SSRF protections, destination pinning, redirect blocking, response-size limits, and timeout behavior for custom HTTP actions.

### CI
- Added permanent Node.js 22 CI with PostgreSQL 16 and Redis 7.
- CI now runs `npm ci`, `npm audit --audit-level=moderate`, Prisma generation/schema initialization/seed, TypeScript build, ESLint, and the complete test suite.

### Compatibility
- No response-envelope breaking changes are intended.
- Workspace list endpoints continue to return arrays. Pagination is exposed through `x-next-cursor` and `x-page-limit` response headers.

## [1.0.0] - 2026-06-18

### Added
- Initial production release of the workflow automation API.
- Fastify/TypeScript API, PostgreSQL/Prisma persistence, Redis/BullMQ queues, workflow engine, conditions, actions, webhooks, workspace isolation, API-key authentication, admin analytics, audit logging, Swagger/OpenAPI documentation, and Render deployment.

[1.0.1]: https://github.com/wbizmo/inflowforge-api/releases/tag/inFlowForge_API_v1.0.1
[1.0.0]: https://github.com/wbizmo/inflowforge-api/releases/tag/inFlowForge_API_v1.0.0
