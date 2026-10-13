import { Body, Controller, Get, Headers, Inject, Post, Query, Req, Res, UseGuards, BadRequestException } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "./prisma.service.js";
import { AuthenticatedRequest, requireActor, SessionGuard } from "./auth.js";
import { SimpleWorkflowsService, SimpleOrderInput, SimpleReceiptInput, SimplePaymentInput, SimpleDeliveryInput } from "./simple-workflows.service.js";
import { buildDeliveryList, deliveryListDateBounds, deliveryListOrderWhere } from "./delivery-list.js";
import { createDeliveryListPdf } from "./delivery-list.pdf.js";
import { resolveDocumentBranding } from "./document-branding.js";
@Controller("api/v1/simple")
@UseGuards(SessionGuard)
export class SimpleWorkflowsController {
  constructor(@Inject(SimpleWorkflowsService) private readonly service: SimpleWorkflowsService, @Inject(PrismaService) private readonly db: PrismaService) {}
  private async deliveryList(date: string) {
    const bounds = deliveryListDateBounds(date);
    const [sheets, orders] = await Promise.all([
      this.db.deliverySheet.findMany({
        where: { serviceDate: bounds.requestedDateStart },
        orderBy: [{ createdAt: "asc" }, { sheetNo: "asc" }],
        select: {
          lines: {
            orderBy: { orderLineId: "asc" },
            select: {
              orderLineId: true,
              scheduledUnits: true,
              displayCustomerNameSnapshot: true,
              phoneSnapshot: true,
              addressSnapshot: true,
              orderLine: { select: { fuel: { select: { code: true } } } }
            }
          }
        }
      }),
      this.db.salesOrder.findMany({
        where: deliveryListOrderWhere(bounds),
        orderBy: { orderNo: "asc" },
        select: {
          id: true,
          requestedDeliveryDate: true,
          orderDate: true,
          addressSnapshot: true,
          customer: { select: { name: true, primaryPhone: true } },
          lines: {
            orderBy: { id: "asc" },
            select: {
              id: true,
              requestedUnits: true,
              fuel: { select: { code: true } }
            }
          }
        }
      })
    ]);

    return buildDeliveryList(date, sheets.flatMap((sheet) => sheet.lines), orders);
  }
  @Get("delivery-list")
  async manifest(@Query("date") date: string) {
    return { data: await this.deliveryList(date) };
  }
  @Get("delivery-list/pdf")
  async manifestPdf(@Query("date") date: string, @Res() response: Response) {
    const list = await this.deliveryList(date);
    const settings = await this.db.documentBranding.findUnique({ where: { id: "global" } });
    const pdf = await createDeliveryListPdf(list, await resolveDocumentBranding(settings));
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `inline; filename="delivery-list-${date}.pdf"`);
    response.send(pdf);
  }
  @Post("orders") async order(@Req() req:AuthenticatedRequest,@Headers("idempotency-key") key:string|undefined,@Body() input:SimpleOrderInput) { return {data:await this.service.order(requireActor(req),key,input)}; }
  @Post("receipts") async receipt(@Req() req:AuthenticatedRequest,@Headers("idempotency-key") key:string|undefined,@Body() input:SimpleReceiptInput) { return {data:await this.service.receipt(requireActor(req),key,input)}; }
  @Post("payments") async payment(@Req() req:AuthenticatedRequest,@Headers("idempotency-key") key:string|undefined,@Body() input:SimplePaymentInput) { return {data:await this.service.payment(requireActor(req),key,input)}; }
  @Post("deliveries") async delivery(@Req() req:AuthenticatedRequest,@Headers("idempotency-key") key:string|undefined,@Body() input:SimpleDeliveryInput) { return {data:await this.service.delivery(requireActor(req),key,input)}; }
}
