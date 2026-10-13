import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { PrismaService } from "./prisma.service.js";
import { SessionGuard } from "./auth.js";
import { SimpleWorkflowsController } from "./simple-workflows.controller.js";
import { SimpleWorkflowsService } from "./simple-workflows.service.js";

@Module({ controllers: [AppController, SimpleWorkflowsController], providers: [PrismaService, SessionGuard, SimpleWorkflowsService] })
export class AppModule {}
