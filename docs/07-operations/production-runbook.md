# Production Operations & Deployment Runbook

## 1. Environment & Architecture Overview
The Fuel Wholesale Management System is built as a single-business, high-integrity wholesale distribution system for Diesel (Naafto) and Petrol (Basiin).

### Architecture Components
- **Frontend App**: Next.js App Router (`apps/web`) on port 3000.
- **Backend REST API**: NestJS Service (`apps/api`) on port 4000.
- **Database**: PostgreSQL 16 on port 5436 (`fuel_db`).
- **ORM / Migrations**: Prisma (`packages/database`).
- **Shared Schemas & DTOs**: TypeScript package (`packages/shared`).

---

## 2. Environment Variables & Security Configuration

### Required Backend Environment Variables (`apps/api/.env`)
```ini
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5436/fuel_db?schema=public"
SESSION_SECRET="generate-a-secure-64-character-random-hex-string"
CORS_ORIGIN="http://localhost:3000"
```

### Required Frontend Environment Variables (`apps/web/.env.local`)
```ini
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

---

## 3. Deployment & Startup Sequence (Linux Ubuntu VPS & Windows)

1. **Start PostgreSQL Database**:
   ```bash
   docker compose up -d
   ```
2. **Apply Committed Database Migrations**:
   ```bash
   pnpm --filter @fuel/database prisma migrate deploy
   ```
3. **Build All Monorepo Packages**:
   ```bash
   pnpm build
   ```
4. **Start Backend API**:
   ```bash
   pnpm --filter @fuel/api start
   ```
5. **Start Frontend Web Application**:
   ```bash
   pnpm --filter @fuel/web start
   ```

---

## 4. Operational Invariants & Data Governance

1. **Fuel Container Conversions**:
   - Fuusto capacity is owner-configured per fuel type version.
   - No default 20 L is hardcoded into stock movements or invoicing.

2. **Immutable Price & Conversion Snapshots**:
   - Order confirmation locks the unit price snapshot and liters per unit snapshot.
   - Subsequent price list updates or conversion policy edits NEVER alter historical orders, invoices, or customer subledgers.

3. **Invoicing Rule**:
   - Invoicing is derived strictly from **confirmed accepted delivered physical quantities**, not original sales order quantities.

4. **Non-Financial Delivery Lists**:
   - Printed/PDF delivery manifests strictly exclude prices, purchase costs, customer debt, and payments.

5. **Role Restrictions**:
   - Only two authenticated roles exist: `OWNER` and `OFFICE_EMPLOYEE`.
   - Purchase costs on tanker receipts, profitability reports, user management, and audit log endpoints are strictly OWNER-only.

---

## 5. Database Backup & Disaster Recovery

### Automated Daily Backup

**Linux/Ubuntu VPS Environment**:
```bash
chmod +x ./packages/database/scripts/backup.sh
./packages/database/scripts/backup.sh
```
Configure via Linux `crontab -e`:
```cron
0 2 * * * /bin/bash /path/to/fuel-whole-system/packages/database/scripts/backup.sh >> /var/log/fuel_backup.log 2>&1
```

**Windows PowerShell Environment**:
```powershell
.\packages\database\scripts\backup.ps1
```

### Monthly Restoration Drill

**Linux/Ubuntu VPS Environment**:
```bash
chmod +x ./packages/database/scripts/restore-test.sh
./packages/database/scripts/restore-test.sh
```

**Windows PowerShell Environment**:
```powershell
.\packages\database\scripts\restore-test.ps1
```

---

## 6. Troubleshooting & Incident Response

### Common Symptoms & Resolutions
- **500 Internal Server Error / DB Connection Refused**:
  - Verify PostgreSQL container health: `docker ps`
  - Check database port binding (5436) and connection URL.
- **403 Forbidden on Profitability / Audits**:
  - Verify logged-in user role is `OWNER`. Office employees are blocked by design.
- **Idempotency Key Conflict**:
  - Payment, dispatch confirmation, and order confirmation endpoints enforce server idempotency keys. Retry requests with identical payload and key receive replay responses safely.
