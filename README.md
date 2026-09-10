# inFlowForge API

A production-style workflow automation platform built with Fastify, TypeScript, PostgreSQL, Redis, BullMQ, and Prisma.

inFlowForge allows developers to build automated workflows using triggers, conditions, actions, webhooks, background processing, and external integrations such as email and Telegram notifications.

The project demonstrates modern backend engineering practices including API design, authentication, queue processing, workflow automation, event-driven architecture, webhook integrations, background workers, and production deployment.

---

## Current Release

**Version:** `1.0.1`  
**Tag:** `inFlowForge_API_v1.0.1`  
**Release:** [inFlowForge API v1.0.1 — Security, Reliability & Performance Hardening](https://github.com/wbizmo/inflowforge-api/releases/tag/inFlowForge_API_v1.0.1)

Release documentation:

- [Changelog](./CHANGELOG.md)
- [Release notes](./RELEASE_NOTES.md)

v1.0.1 hardens the production API with patched dependencies, constant-time admin-token comparison, safer worker logging, bounded cursor pagination, lower API-key write amplification, database-side analytics aggregation, targeted query indexes, bounded external action I/O, validation parity, and a permanent PostgreSQL/Redis release-verification CI gate.

---

# Live Deployment

## API

https://inflowforge-api.onrender.com

## Health Check

https://inflowforge-api.onrender.com/health

## Swagger Documentation

https://inflowforge-api.onrender.com/docs

## GitHub Repository

https://github.com/wbizmo/inflowforge-api

---

# Public Testing Credentials

The live deployment includes demo credentials that can be used to explore and test the API.

## Demo Admin Token

```txt
dev_admin_secret_12345
```

Example:

```bash
curl https://inflowforge-api.onrender.com/admin/analytics/overview \
  -H "x-admin-token: dev_admin_secret_12345"
```

---

## Demo Workspace API Key

```txt
iff_dev_test_key_123456789
```

Example:

```bash
curl https://inflowforge-api.onrender.com/workflows \
  -H "x-api-key: iff_dev_test_key_123456789"
```

---

## Demo Workflow

```txt
cmpuudajr00001se3b6c0jsxp
```

Trigger the live workflow:

```bash
curl -X POST https://inflowforge-api.onrender.com/webhooks/cmpuudajr00001se3b6c0jsxp \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo User",
    "email": "demo@example.com",
    "plan": "premium"
  }'
```

This workflow demonstrates:

* Workflow Execution
* Conditional Processing
* Queue-Based Background Jobs
* Email Actions
* Telegram Notifications
* Execution Logging
* Analytics Tracking
* Webhook Processing

---

# Render Free Tier Notice

This project is hosted on Render's free tier.

If the API has been inactive for a period of time, Render may place the service into a sleep state.

If requests appear unavailable:

1. Visit:

   https://inflowforge-api.onrender.com

2. Wait for the service to wake up.

3. Refresh the page.

4. Retry your request.

Once awake, the API, Swagger documentation, and webhook endpoints will function normally.

---

# Features

## Workflow Engine

Create workflows consisting of:

* Triggers
* Conditions
* Actions

Workflows can be executed manually or automatically through webhooks.

---

## Multi-Tenant Architecture

Each workspace is isolated from every other workspace.

Every API key belongs to a specific workspace.

All workflows, executions, analytics, and audit logs are scoped to the owning workspace.

---

## API Key Authentication

Workspace endpoints are protected using API keys.

Example:

```http
x-api-key: YOUR_API_KEY
```

---

## Admin Authentication

Administrative endpoints are protected using an admin token.

Example:

```http
x-admin-token: YOUR_ADMIN_TOKEN
```

---

## Webhook Automation

Trigger workflows from external applications.

Example:

```http
POST /webhooks/:workflowId
```

This allows integrations with:

* Websites
* Forms
* SaaS products
* Internal systems
* Third-party applications

---

## Condition Engine

Workflows can execute conditionally.

Example:

```json
{
  "field": "plan",
  "operator": "equals",
  "value": "premium"
}
```

Only users matching the condition proceed through the workflow.

---

## Action Engine

Supported actions:

### Email

Send transactional emails using Resend.

### Telegram

Send Telegram bot notifications.

### HTTP Requests

Trigger external APIs.

### Delay

Pause execution before continuing.

### Logging

Create execution logs.

---

## Queue Processing

Workflow execution is asynchronous.

Powered by:

* Redis
* BullMQ

Benefits:

* Fast API responses
* Background processing
* Scalable architecture
* Reliable workflow execution

---

## Audit Logging

All critical actions are recorded:

* Workflow creation
* Workflow updates
* Workflow deletion
* Execution requests
* Webhook triggers

---

## Analytics

Administrative analytics include:

* Workspace counts
* API key counts
* Workflow counts
* Execution counts
* Success rates
* Failure rates
* Audit log totals

---

## Pagination

Workflow, execution, and audit-log list endpoints use bounded cursor pagination in v1.0.1.

- Default page size: 50
- Maximum page size: 100
- Next page cursor: `x-next-cursor` response header
- Effective page limit: `x-page-limit` response header

The response body remains an array for compatibility.

---

# Technology Stack

| Category              | Technology        |
| --------------------- | ----------------- |
| Runtime               | Node.js           |
| Language              | TypeScript        |
| Framework             | Fastify           |
| Database              | PostgreSQL        |
| ORM                   | Prisma            |
| Queue System          | BullMQ            |
| Cache / Queue Backend | Redis             |
| Database Hosting      | Neon              |
| Redis Hosting         | Upstash           |
| Email                 | Resend            |
| Notifications         | Telegram Bot API  |
| Documentation         | Swagger / OpenAPI |
| Deployment            | Render            |
| Testing               | Node Test Runner  |

---

# Architecture

```text
Client
   │
   ▼
Fastify API
   │
   ▼
Authentication Layer
   │
   ▼
Workflow Engine
   │
   ▼
BullMQ Queue
   │
   ▼
Redis
   │
   ▼
Worker
   │
   ▼
Action Engine
   │
   ├── Email (Resend)
   ├── Telegram
   ├── HTTP Requests
   ├── Delay
   └── Logging
   │
   ▼
PostgreSQL
```

---

# Example Workflow

Premium Signup Workflow

Trigger:

```json
{
  "type": "webhook"
}
```

Condition:

```json
{
  "field": "plan",
  "operator": "equals",
  "value": "premium"
}
```

Actions:

```json
[
  {
    "type": "email",
    "to": "{{input.email}}",
    "subject": "Welcome {{input.name}}"
  },
  {
    "type": "telegram",
    "message": "New premium signup: {{input.name}}"
  },
  {
    "type": "log",
    "message": "Premium signup completed"
  }
]
```

---

# API Documentation

Interactive Swagger documentation is available at:

https://inflowforge-api.onrender.com/docs

The Swagger UI contains:

* Request schemas
* Response schemas
* Endpoint descriptions
* Authentication requirements
* Example payloads

---

# Authentication Examples

## Workspace Request

```bash
curl https://inflowforge-api.onrender.com/workflows \
  -H "x-api-key: iff_dev_test_key_123456789"
```

---

## Admin Request

```bash
curl https://inflowforge-api.onrender.com/admin/analytics/overview \
  -H "x-admin-token: dev_admin_secret_12345"
```

---

# Example Requests

## Health Check

```bash
curl https://inflowforge-api.onrender.com/health
```

---

## List Workflows

```bash
curl https://inflowforge-api.onrender.com/workflows \
  -H "x-api-key: iff_dev_test_key_123456789"
```

---

## Create Workflow

```bash
curl -X POST https://inflowforge-api.onrender.com/workflows \
  -H "Content-Type: application/json" \
  -H "x-api-key: iff_dev_test_key_123456789"
```

---

## Execute Workflow

```bash
curl -X POST https://inflowforge-api.onrender.com/workflows/:id/execute \
  -H "Content-Type: application/json" \
  -H "x-api-key: iff_dev_test_key_123456789"
```

---

## Trigger Webhook

```bash
curl -X POST https://inflowforge-api.onrender.com/webhooks/cmpuudajr00001se3b6c0jsxp \
  -H "Content-Type: application/json"
```

---

# Local Development

## Clone Repository

```bash
git clone https://github.com/wbizmo/inflowforge-api.git
cd inflowforge-api
```

## Install Dependencies

```bash
npm install
```

## Create Environment File

Create a `.env` file using the values from `.env.example`.

## Generate Prisma Client

```bash
npx prisma generate
```

## Push Database Schema

```bash
npx prisma db push
```

## Seed Development Data

```bash
npx tsx prisma/seed/dev.ts
```

## Start Development Server

```bash
npm run dev
```

---

# .env.example

```env
PORT=4000
NODE_ENV=development

DATABASE_URL=your_postgresql_connection_string

REDIS_HOST=your_redis_host
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

ADMIN_TOKEN=your_admin_token

RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=your_verified_sender_email

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

# Telegram Setup

To use Telegram actions, create a Telegram bot using BotFather.

## Step 1: Create a Bot

Open Telegram and search for:

```txt
@BotFather
```

Run:

```txt
/newbot
```

Follow the prompts and BotFather will provide a bot token.

Example:

```txt
TELEGRAM_BOT_TOKEN=123456789:AAExampleTokenHere
```

---

## Step 2: Start a Chat With the Bot

Open your bot in Telegram and send any message such as:

```txt
/start
```

---

## Step 3: Retrieve Your Chat ID

Open the following URL in your browser:

```txt
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
```

Example:

```txt
https://api.telegram.org/bot123456789:AAExampleTokenHere/getUpdates
```

You should receive a JSON response similar to:

```json
{
  "ok": true,
  "result": [
    {
      "message": {
        "chat": {
          "id": 1455925018,
          "type": "private"
        }
      }
    }
  ]
}
```

The value of:

```txt
chat.id
```

is your Telegram Chat ID.

Example:

```txt
TELEGRAM_CHAT_ID=1455925018
```

---

## Step 4: Add to Environment Variables

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

Once configured, Telegram workflow actions can send notifications directly to your Telegram account.

---

# Testing

Run all tests:

```bash
npm test
```

Build project:

```bash
npm run build
```

CI verifies the dependency audit, PostgreSQL, Redis, Prisma initialization, build, lint, and complete test suite on pull requests and `main`.

---

# Deployment

Production deployment uses:

* Render
* Neon PostgreSQL
* Upstash Redis
* Resend
* Telegram Bot API

The live deployment automatically builds from the authoritative `main` branch.

---

# Author

**Williams**

GitHub:

https://github.com/wbizmo

Project Repository:

https://github.com/wbizmo/inflowforge-api
