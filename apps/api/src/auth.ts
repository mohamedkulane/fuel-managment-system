import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { Request } from "express";
import { PrismaService } from "./prisma.service.js";

export type Actor = { id: string; displayName: string; email: string; role: "OWNER" | "OFFICE_EMPLOYEE" };
export type AuthenticatedRequest = Request & { actor?: Actor };

export function readCookie(request: Request, name: string): string | undefined {
  const raw = request.headers.cookie;
  if (!raw) return undefined;
  const part = raw.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return part?.slice(name.length + 1);
}

export function hashToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function newSessionToken(): string { return randomBytes(32).toString("base64url"); }

@Injectable()
export class SessionGuard implements CanActivate {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request, "fuel_sid");
    if (!token) throw new UnauthorizedException("Authentication required");
    const session = await this.prisma.session.findFirst({ where: { tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
    if (!session?.user.isActive) throw new UnauthorizedException("Session expired");
    request.actor = { id: session.user.id, displayName: session.user.displayName, email: session.user.email, role: session.user.role };
    return true;
  }
}

export function requireActor(request: AuthenticatedRequest): Actor {
  if (!request.actor) throw new UnauthorizedException("Authentication required");
  return request.actor;
}

export function requireOwner(request: AuthenticatedRequest): Actor {
  const actor = requireActor(request);
  if (actor.role !== "OWNER") throw new ForbiddenException("Owner permission required");
  return actor;
}
