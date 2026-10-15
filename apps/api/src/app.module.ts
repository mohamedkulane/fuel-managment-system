import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { PrismaService } from "./prisma.service.js";
import { SessionGuard } from "./auth.js";
import { SimpleWorkflowsController } from "./simple-workflows.controller.js";
import { SimpleWorkflowsService } from "./simple-workflows.service.js";
import { CustomerAccountService } from "./customer-account.service.js";
import { FinancialController } from "./financial.controller.js";
import { FinancialWorkflowsService } from "./financial-workflows.service.js";

@Module({ controllers: [AppController, SimpleWorkflowsController, FinancialController], providers: [PrismaService, SessionGuard, SimpleWorkflowsService, CustomerAccountService, FinancialWorkflowsService] })
export class AppModule {}
