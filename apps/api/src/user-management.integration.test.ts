import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@fuel/database";
import { AppModule } from "./app.module.js";

type UserResult = { id: string; displayName: string; email: string; role: "OWNER" | "OFFICE_EMPLOYEE"; isActive: boolean };

describe("User management CRUD", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let base = "";
  let ownerCookie = "";
  let ownerId = "";
  const suffix = randomUUID().slice(0, 8);
  const ownerEmail = `crud-owner-${suffix}@test.invalid`;
  const ownerPassword = `Owner-${randomUUID()}!`;
  const initialPassword = `Office-${randomUUID()}!`;
  const changedPassword = `Changed-${randomUUID()}!`;

  async function login(email: string, password: string) {
    return fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
  }

  async function ownerRequest(path: string, options: RequestInit = {}) {
    return fetch(`${base}/api/v1${path}`, {
      ...options,
      headers: { "content-type": "application/json", cookie: ownerCookie, ...(options.headers ?? {}) }
    });
  }

  beforeAll(async () => {
    prisma = new PrismaClient();
    const owner = await prisma.user.create({
      data: { displayName: "CRUD Owner", email: ownerEmail, passwordHash: await argon2.hash(ownerPassword), role: "OWNER" }
    });
    ownerId = owner.id;
    app = await NestFactory.create(AppModule, { logger: ["error"] });
    app.use(cookieParser());
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as { port: number };
    base = `http://127.0.0.1:${address.port}`;
    const response = await login(ownerEmail, ownerPassword);
    expect(response.status).toBe(201);
    ownerCookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it("creates, reads, updates, deactivates and reactivates a user", async () => {
    const email = `crud-office-${suffix}@test.invalid`;
    const create = await ownerRequest("/users", {
      method: "POST",
      body: JSON.stringify({ displayName: "CRUD Office", email, password: initialPassword, role: "OFFICE_EMPLOYEE" })
    });
    expect(create.status).toBe(201);
    const created = ((await create.json()) as { data: UserResult }).data;
    expect(created).toMatchObject({ displayName: "CRUD Office", email, role: "OFFICE_EMPLOYEE", isActive: true });

    const list = await ownerRequest("/users");
    expect(list.status).toBe(200);
    const users = ((await list.json()) as { data: UserResult[] }).data;
    expect(users.some((user) => user.id === created.id)).toBe(true);

    const updatedEmail = `crud-office-edited-${suffix}@test.invalid`;
    const update = await ownerRequest(`/users/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Edited Office", email: updatedEmail, role: "OFFICE_EMPLOYEE", password: changedPassword })
    });
    expect(update.status).toBe(200);
    expect(((await update.json()) as { data: UserResult }).data).toMatchObject({ displayName: "Edited Office", email: updatedEmail });
    expect((await login(updatedEmail, initialPassword)).status).toBe(403);
    const targetLogin = await login(updatedEmail, changedPassword);
    expect(targetLogin.status).toBe(201);
    const targetCookie = targetLogin.headers.get("set-cookie")?.split(";")[0] ?? "";

    const officeDenied = await fetch(`${base}/api/v1/users`, { headers: { cookie: targetCookie } });
    expect(officeDenied.status).toBe(403);

    const deactivate = await ownerRequest(`/users/${created.id}`, { method: "DELETE" });
    expect(deactivate.status).toBe(200);
    expect(((await deactivate.json()) as { data: UserResult }).data.isActive).toBe(false);
    const revokedSession = await fetch(`${base}/api/v1/auth/me`, { headers: { cookie: targetCookie } });
    expect(revokedSession.status).toBe(401);
    expect((await login(updatedEmail, changedPassword)).status).toBe(403);

    const reactivate = await ownerRequest(`/users/${created.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) });
    expect(reactivate.status).toBe(200);
    expect(((await reactivate.json()) as { data: UserResult }).data.isActive).toBe(true);
    expect((await login(updatedEmail, changedPassword)).status).toBe(201);
  });

  it("rejects duplicate email and self-deactivation", async () => {
    const duplicate = await ownerRequest("/users", {
      method: "POST",
      body: JSON.stringify({ displayName: "Duplicate", email: ownerEmail, password: initialPassword, role: "OFFICE_EMPLOYEE" })
    });
    expect(duplicate.status).toBe(409);

    const selfDeactivate = await ownerRequest(`/users/${ownerId}`, { method: "DELETE" });
    expect(selfDeactivate.status).toBe(400);
  });
});
