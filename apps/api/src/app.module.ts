import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { PrismaService } from "./prisma.service.js";
import { SessionGuard } from "./auth.js";

@Module({ controllers: [AppController], providers: [PrismaService, SessionGuard] })
export class AppModule {}
