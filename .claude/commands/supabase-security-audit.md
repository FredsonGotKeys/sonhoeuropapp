---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [audit-scope] | --rls | --permissions | --auth | --api-keys | --comprehensive
description: Conduct comprehensive Supabase security audit with RLS analysis and vulnerability assessment
---

# Supabase Security Audit

Conduct comprehensive Supabase security audit with RLS policy analysis and vulnerability assessment: **$ARGUMENTS**

## Current Security Context

- Supabase access: use the `mcp__Supabase__*` MCP tools for schema, RLS policy, and advisor queries
- RLS policies: current Row Level Security implementation and policy effectiveness
- Auth configuration: !`find . -name "*auth*" -o -name "*supabase*" | grep -E "\.(js|ts|json)$" | head -10`
- Admin bypass: this project's `lib/supabase/admin.ts` uses the service-role key to bypass RLS from server actions — verify every such call site actually re-checks the caller's identity/authorization in application code

## Task

Execute comprehensive security audit with vulnerability assessment and policy optimization:

**Audit Scope**: Use $ARGUMENTS to focus on RLS policies, permission analysis, authentication security, API key management, or comprehensive security review

**Security Audit Framework**:
1. **RLS Policy Analysis** — Review Row Level Security policies on every table, test policy effectiveness, identify policy gaps, optimize policy performance
2. **Permission Assessment** — Analyze table permissions, review role-based access, validate permission hierarchies, identify over-privileged access
3. **Authentication Security** — Review Supabase Auth configuration, analyze JWT/session security, validate session management
4. **API Key Management** — Audit where `NEXT_PUBLIC_SUPABASE_ANON_KEY` vs `SUPABASE_SERVICE_ROLE_KEY` is used, confirm the service-role key never reaches client code
5. **Data Protection** — Analyze sensitive data handling (BI numbers, verification photos, deposit records), review storage bucket policies, validate backup security
6. **Vulnerability Scanning** — Identify injection vectors, CORS misconfigurations, rate-limiting effectiveness in `proxy.ts`

Use `mcp__Supabase__get_advisors` for automated lint findings and `mcp__Supabase__execute_sql` (read-only) to inspect `pg_policies` directly.

**Output**: Comprehensive security audit report with vulnerability assessments, policy recommendations, security improvements, and prioritized remediation steps.
