# 📄 Product Requirements Document (PRD)

# Unified Application & Dependency Monitoring Platform
**Single Pane of Glass for Multi‑Project, Multi‑Provider Systems**

---

## 1. Overview

### 1.1 Product Name (Working)
**OpsGlass** – Unified Monitoring Platform

### 1.2 Purpose
Build a central monitoring platform that provides a real‑time, single‑pane‑of‑glass view of all applications and their dependencies across multiple organisations and technology stacks.

The platform will monitor:
- Custom-built applications
- Hosting platforms
- Databases
- Authentication services
- Payment providers
- DNS providers
- Code repositories and CI/CD

The system must support both **development** and **production** environments and be adaptable to constant changes in technology.

---

## 2. Goals & Success Criteria

### 2.1 Primary Goals
- Centralise visibility of all projects and dependencies
- Detect outages and degradation early
- Enable rapid investigation of incidents
- Provide a simple, status‑first interface
- Allow fast onboarding of new tools and services

### 2.2 Success Metrics
- <60s detection time for critical outages
- All production projects registered and monitored
- Dependency failures visible within one dashboard
- Alert noise reduced through component-level health
- Ability to add a new provider in <30 minutes

---

## 3. Target Users

- Founder / Technical Lead
- Engineers
- DevOps / Platform operators
- Product owners

---

## 4. Key Use Cases

- View global system health across all companies
- Monitor a single product’s full dependency chain
- Detect whether downtime is internal or provider-based
- Receive alerts when a project or dependency fails
- Track incident history and uptime
- Register new projects and technologies quickly

---

## 5. Scope

### In Scope
- Project registry
- Environment separation (dev/staging/prod)
- Component and dependency modelling
- Health checks
- Status engine
- Alerting system
- Incident management
- Provider abstraction layer
- Simple public-style status UI

### Out of Scope (Phase 1)
- Full log ingestion platform
- APM replacement
- On‑call scheduling system
- Auto-remediation

---

## 6. Functional Requirements

### 6.1 Project Management

- Create and manage organisations
- Create projects under organisations
- Assign environments to projects
- Tag projects by company, product, and criticality

Project fields:
- Name
- Organisation
- Environment (dev, staging, prod)
- Public URL
- Owner
- Status (derived)

---

### 6.2 Component & Dependency System

Each project supports multiple components.

Component fields:
- Name
- Type (Application / Dependency)
- Provider (Vercel, Replit, Firebase, Stripe, Supabase, GoDaddy, GitHub, Custom)
- Criticality (Critical, High, Medium, Low)
- Environment
- Health check strategy
- Alert policy
- Status (derived)

Dependency templates must be reusable across projects.

---

### 6.3 Health Checks

Supported check types (MVP):
- HTTP/HTTPS uptime
- API heartbeat
- DNS resolution
- SSL expiration
- Webhook tests
- Provider status polling
- Custom scripted checks

Each check must support:
- Frequency
- Timeout
- Retries
- Thresholds

---

### 6.4 Status Engine

The platform must:
- Continuously evaluate health checks
- Derive component status
- Roll up component status into project status
- Roll up project status into organisation/global status

Standardised states:
- Operational
- Degraded
- Partial outage
- Major outage
- Maintenance

---

### 6.5 Alerting & Notifications

Alert triggers:
- Component outage
- Critical dependency failure
- Performance degradation
- Repeated build/deploy failures

Alert channels:
- Email
- Slack/Discord/Webhook
- SMS (optional)

Alert payload must include:
- Project
- Environment
- Component
- Timestamp
- Last known good state
- Investigation links

---

### 6.6 Incident Management

- Automatic incident creation on major failures
- Manual incident declaration
- Incident timeline
- Status updates
- Resolution logging
- Post‑incident notes

---

### 6.7 UI Requirements

Core views:

1. Global status dashboard
2. Organisation overview
3. Project dashboard
4. Component dependency view
5. Active incidents
6. Historical uptime

UI principles:
- Status-first
- Minimal design
- Fast load
- Clear degradation signals

Inspired by Replit/Vercel/GitHub status pages.

---

### 6.8 Provider Abstraction Layer

The system must expose a generic provider interface:

- Register provider
- Define supported checks
- Map provider APIs
- Poll or subscribe to provider health

This allows rapid onboarding of new tools.

---

## 7. Non-Functional Requirements

- Cloud-native
- Highly available
- Secure by default
- Extensible architecture
- Plugin-friendly
- API-first

Performance:
- <2s dashboard load
- Health checks scalable to 1000+ components

Security:
- Role-based access
- Encrypted secrets
- Audit logs

---

## 8. Data Model (High Level)

Entities:
- Organisation
- Project
- Environment
- Component
- Dependency Template
- HealthCheck
- CheckResult
- Incident
- Alert
- Provider

Relationships:
- Organisation → Projects
- Project → Environments
- Project → Components
- Components → Health checks
- Incidents → Components

---

## 9. Architecture Overview

Suggested architecture:

- Frontend: lightweight dashboard UI
- API layer
- Monitoring engine (workers)
- Provider integration layer
- Alerting service
- Event bus
- Time‑series data store
- Relational metadata store

---

## 10. MVP Feature Set

Phase 1:
- Project & component registry
- HTTP/DNS health checks
- Status rollups
- Alerts via email/webhook
- Global dashboard
- Project dashboards

Phase 2:
- Provider adapters
- Incident timelines
- Public status pages
- Historical uptime

Phase 3:
- Dependency graphs
- SLA reports
- Automated diagnostics
- Predictive alerts

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
Technology sprawl | Provider abstraction layer |
Alert fatigue | Severity tiers + thresholds |
Scaling complexity | Queue-based workers |
Data overload | Retention policies |
Single point of failure | Redundant monitoring |

---

## 12. Launch Criteria

- At least two real projects onboarded
- At least five dependency types supported
- Simulated outage detected and alerted
- Incident created and resolved in system

---

## 13. Long-Term Vision

- Live dependency maps
- Change-impact prediction
- Auto-remediation hooks
- Compliance reports
- Cross-organisation reliability intelligence

---

