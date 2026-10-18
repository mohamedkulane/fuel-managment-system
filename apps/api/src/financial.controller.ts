import { Body, Controller, ForbiddenException, Get, Headers, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, hasPermission, requireActor, requirePermission, SessionGuard } from "./auth.js";
import { FinancialWorkflowsService } from "./financial-workflows.service.js";

@Controller("api/v1")
@UseGuards(SessionGuard)
export class FinancialController {
  constructor(@Inject(FinancialWorkflowsService) private readonly service: FinancialWorkflowsService) {}

  @Get("financial-accounts/selectable")
  async selectable(@Req() request: AuthenticatedRequest) {
    const actor = requireActor(request);
    const allowed = actor.role === "OWNER" ||
      hasPermission(actor, "accounts.view") ||
      hasPermission(actor, "payments.record") ||
      hasPermission(actor, "orders.create") ||
      hasPermission(actor, "expenses.create") ||
      hasPermission(actor, "stock.receive") ||
      hasPermission(actor, "suppliers.pay") ||
      hasPermission(actor, "accounts.transfer");
    if (!allowed) throw new ForbiddenException("Ogolaansho uma haysatid inaad aragto akoonnada lacagta");
    return { data: await this.service.selectableAccounts(actor) };
  }
  @Get("financial-accounts") async accounts(@Req() request: AuthenticatedRequest) { return { data: await this.service.accounts(requirePermission(request, "accounts.view")) }; }
  @Post("financial-accounts") async createAccount(@Req() request: AuthenticatedRequest, @Headers("idempotency-key") key: string | undefined, @Body() body: Parameters<FinancialWorkflowsService["createAccount"]>[2]) { return { data: await this.service.createAccount(requirePermission(request, "accounts.create"), key, body) }; }
  @Get("financial-accounts/:id") async account(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string
  ) {
    return { data: await this.service.accountDetail(requirePermission(request, "accounts.view"), id, { page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined, fromDate, toDate }) };
  }
  @Get("financial-accounts/:id/movements") async movements(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string
  ) {
    return { data: await this.service.accountDetail(requirePermission(request, "accounts.view"), id, { page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined, fromDate, toDate }) };
  }
  @Patch("financial-accounts/:id") async updateAccount(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: Parameters<FinancialWorkflowsService["updateAccount"]>[2]) { return { data: await this.service.updateAccount(requirePermission(request, "accounts.create"), id, body) }; }
  @Get("financial-accounts/transfers") async transfers(@Req() request: AuthenticatedRequest) { return { data: await this.service.transfers(requirePermission(request, "accounts.view")) }; }
  @Post("financial-accounts/transfers") async transfer(@Req() request: AuthenticatedRequest, @Headers("idempotency-key") key: string | undefined, @Body() body: Parameters<FinancialWorkflowsService["transfer"]>[2]) { return { data: await this.service.transfer(requirePermission(request, "accounts.transfer"), key, body) }; }
  @Post("financial-accounts/transfers/:id/reverse") async reverseTransfer(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: { reason?: string }
  ) {
    return { data: await this.service.reverseTransfer(requirePermission(request, "accounts.transfer"), key, id, body?.reason) };
  }

  @Get("suppliers") async suppliers(@Req() request: AuthenticatedRequest) { return { data: await this.service.suppliers(requirePermission(request, "suppliers.view")) }; }
  @Post("suppliers") async createSupplier(@Req() request: AuthenticatedRequest, @Body() body: Parameters<FinancialWorkflowsService["createSupplier"]>[1]) { return { data: await this.service.createSupplier(requirePermission(request, "suppliers.create"), body) }; }
  @Get("suppliers/:id") async supplier(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return { data: await this.service.supplierDetail(requirePermission(request, "suppliers.view"), id) }; }
  @Patch("suppliers/:id") async updateSupplier(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: Parameters<FinancialWorkflowsService["updateSupplier"]>[2]) { return { data: await this.service.updateSupplier(requirePermission(request, "suppliers.update"), id, body) }; }
  @Post("suppliers/:id/payments") async supplierPayment(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Headers("idempotency-key") key: string | undefined, @Body() body: Parameters<FinancialWorkflowsService["supplierPayment"]>[3]) { return { data: await this.service.supplierPayment(requirePermission(request, "suppliers.pay"), key, id, body) }; }
  @Post("supplier-payments/:id/reverse") async reverseSupplierPayment(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Headers("idempotency-key") key: string | undefined, @Body() body: { reason?: string }) { return { data: await this.service.reverseSupplierPayment(requirePermission(request, "suppliers.pay"), key, id, body.reason) }; }

  @Get("expenses") async expenses(@Req() request: AuthenticatedRequest) { return { data: await this.service.expenses(requirePermission(request, "expenses.view")) }; }
  @Post("expenses") async createExpense(@Req() request: AuthenticatedRequest, @Headers("idempotency-key") key: string | undefined, @Body() body: Parameters<FinancialWorkflowsService["createExpense"]>[2]) { return { data: await this.service.createExpense(requirePermission(request, "expenses.create"), key, body) }; }
  @Post("expenses/:id/reverse") async reverseExpense(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Headers("idempotency-key") key: string | undefined, @Body() body: { reason?: string }) { return { data: await this.service.reverseExpense(requirePermission(request, "expenses.reverse"), key, id, body.reason) }; }
}

