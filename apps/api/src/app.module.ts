import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { PrismaService } from "./prisma.service.js";
import { SessionGuard } from "./auth.js";
import { SimpleWorkflowsController } from "./simple-workflows.controller.js";
import { SimpleWorkflowsService } from "./simple-workflows.service.js";
import { CustomerAccountService } from "./customer-account.service.js";

@Module({ controllers: [AppController, SimpleWorkflowsController], providers: [PrismaService, SessionGuard, SimpleWorkflowsService, CustomerAccountService] })
export class AppModule {}
