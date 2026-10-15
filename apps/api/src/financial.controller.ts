import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, requireActor, SessionGuard } from "./auth.js";
import { FinancialWorkflowsService } from "./financial-workflows.service.js";

@Controller("api/v1")
@UseGuards(SessionGuard)
export class FinancialController {
  constructor(@Inject(FinancialWorkflowsService) private readonly service: FinancialWorkflowsService) {}

  @Get("financial-accounts/selectable") async selectable(@Req() request: AuthenticatedRequest) { return { data: await this.service.selectableAccounts(requireActor(request)) }; }
  @Get("financial-accounts") async accounts(@Req() request: AuthenticatedRequest) { return { data: await this.service.accounts(requireActor(request)) }; }
  @Post("financial-accounts") async createAccount(@Req() request: AuthenticatedRequest, @Headers("idempotency-key") key: string | undefined, @Body() body: Parameters<FinancialWorkflowsService["createAccount"]>[2]) { return { data: await this.service.createAccount(requireActor(request), key, body) }; }
  @Get("financial-accounts/:id") async account(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return { data: await this.service.accountDetail(requireActor(request), id) }; }
  @Patch("financial-accounts/:id") async updateAccount(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: Parameters<FinancialWorkflowsService["updateAccount"]>[2]) { return { data: await this.service.updateAccount(requireActor(request), id, body) }; }
  @Post("financial-accounts/transfers") async transfer(@Req() request: AuthenticatedRequest, @Headers("idempotency-key") key: string | undefined, @Body() body: Parameters<FinancialWorkflowsService["transfer"]>[2]) { return { data: await this.service.transfer(requireActor(request), key, body) }; }

  @Get("suppliers") async suppliers(@Req() request: AuthenticatedRequest) { return { data: await this.service.suppliers(requireActor(request)) }; }
  @Post("suppliers") async createSupplier(@Req() request: AuthenticatedRequest, @Body() body: Parameters<FinancialWorkflowsService["createSupplier"]>[1]) { return { data: await this.service.createSupplier(requireActor(request), body) }; }
  @Get("suppliers/:id") async supplier(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return { data: await this.service.supplierDetail(requireActor(request), id) }; }
  @Patch("suppliers/:id") async updateSupplier(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: Parameters<FinancialWorkflowsService["updateSupplier"]>[2]) { return { data: await this.service.updateSupplier(requireActor(request), id, body) }; }
  @Post("suppliers/:id/payments") async supplierPayment(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Headers("idempotency-key") key: string | undefined, @Body() body: Parameters<FinancialWorkflowsService["supplierPayment"]>[3]) { return { data: await this.service.supplierPayment(requireActor(request), key, id, body) }; }
  @Post("supplier-payments/:id/reverse") async reverseSupplierPayment(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Headers("idempotency-key") key: string | undefined, @Body() body: { reason?: string }) { return { data: await this.service.reverseSupplierPayment(requireActor(request), key, id, body.reason) }; }

  @Get("expenses") async expenses(@Req() request: AuthenticatedRequest) { return { data: await this.service.expenses(requireActor(request)) }; }
  @Post("expenses") async createExpense(@Req() request: AuthenticatedRequest, @Headers("idempotency-key") key: string | undefined, @Body() body: Parameters<FinancialWorkflowsService["createExpense"]>[2]) { return { data: await this.service.createExpense(requireActor(request), key, body) }; }
  @Post("expenses/:id/reverse") async reverseExpense(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Headers("idempotency-key") key: string | undefined, @Body() body: { reason?: string }) { return { data: await this.service.reverseExpense(requireActor(request), key, id, body.reason) }; }
}
