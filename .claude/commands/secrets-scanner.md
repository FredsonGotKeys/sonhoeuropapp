---
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [scope] | --api-keys | --passwords | --certificates | --fix
description: Scan codebase for exposed secrets, credentials, and sensitive information
---

# Secrets Scanner

Scan codebase for exposed secrets and sensitive information: **$ARGUMENTS**

## Current Repository State

- Git status: !`git status --porcelain | wc -l` uncommitted files
- Recent commits: !`git log --oneline --grep="password\|key\|secret\|token" -5`
- Environment files: @.env* (if exists)

## Task

Perform comprehensive secrets detection and remediation across the codebase, with particular attention to this project's known secrets: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and any payment-provider keys.

**Scan Scope**: Use $ARGUMENTS to focus on API keys, passwords, certificates, or complete scan

**Detection Categories**:
1. **API Keys & Tokens** — Supabase, Vercel, third-party services
2. **Database Credentials** — connection strings, service-role keys
3. **Certificates & Keys** — private keys, SSH keys, SSL certificates
4. **Authentication Secrets** — JWT secrets, session keys, admin password hashes
5. **Configuration Leaks** — hardcoded URLs, internal endpoints, debug settings

**Remediation Actions**:
- Identify exposed secrets with file locations and line numbers
- Provide secure alternatives (environment variables, Vercel secret management)
- Generate `.gitignore` entries for sensitive files
- Create secure configuration templates
- Implement secrets management best practices

**Output**: Detailed security report with risk levels, immediate actions, and long-term security improvements.
