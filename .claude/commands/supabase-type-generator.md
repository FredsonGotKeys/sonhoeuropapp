---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [table-name] | --all-tables | --check-drift
description: Generate or check TypeScript types against the live Supabase schema, catching drift from hand-written interfaces
---

# Supabase Type Generator

Generate/verify TypeScript types from the live Supabase schema: **$ARGUMENTS**

## Current Type Context

This project currently hand-writes interfaces (e.g. `Usuario`, `Ciclo`, `Deposito`, `ContratoRow`) inline in the page files that use them, rather than generating a single `database.types.ts` from the schema. That's a real drift risk: a column renamed or added in Supabase silently stops matching the hand-written type.

- Existing hand-written types: !`grep -rn "^interface \|^type .* = {" app --include="*.tsx" | grep -iE "usuario|ciclo|deposito|contrato|pagamento" | head -20`

## Task

**Scope**: Use $ARGUMENTS to target one table, all tables, or just a drift check against existing hand-written interfaces.

1. Use `mcp__Supabase__generate_typescript_types` (or `list_tables` + manual mapping) to get the authoritative shape of each relevant table.
2. Compare against the hand-written interfaces found above — flag any field that's missing, renamed, or has a mismatched nullability/type.
3. Do **not** silently replace the hand-written types with a generated `database.types.ts` file across the whole codebase — that's a larger refactor the user should explicitly opt into. Instead, report the drift found and propose the smallest fix per file.
4. If asked to actually generate a shared types file, place it at `lib/supabase/database.types.ts` and show how existing interfaces would import from it (e.g. `type Usuario = Database['public']['Tables']['usuarios']['Row']`) rather than duplicating fields.

**Output**: A drift report (table → field → mismatch) plus, only if requested, the generated type file.
