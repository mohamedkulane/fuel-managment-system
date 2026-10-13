import { Body, Controller, Get, Headers, Inject, Post, Query, Req, Res, UseGuards, BadRequestException } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "./prisma.service.js";
import { Prisma } from "@fuel/database";
import { exportToPdf } from "./reports.exporter.js";
import { AuthenticatedRequest, requireActor, SessionGuard } from "./auth.js";
import { SimpleWorkflowsService, SimpleOrderInput, SimpleReceiptInput, SimplePaymentInput, SimpleDeliveryInput } from "./simple-workflows.service.js";
@Controller("api/v1/simple")
@UseGuards(SessionGuard)
export class SimpleWorkflowsController {
  constructor(@Inject(SimpleWorkflowsService) private readonly service: SimpleWorkflowsService, @Inject(PrismaService) private readonly db: PrismaService) {}
  private async deliveryList(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException("Date must be YYYY-MM-DD");
    const start = new Date(`${date}T00:00:00+03:00`);
    const end = new Date(start.getTime() + 86_400_000);
    const rows = await this.db.salesOrder.findMany({
      where: {
        status: { in: ["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "PARTIALLY_FULFILLED"] },
        OR: [
          { requestedDeliveryDate: new Date(`${date}T00:00:00Z`) },
          { requestedDeliveryDate: null, orderDate: { gte: start, lt: end } },
        ],
      },
      select: {
        addressSnapshot: true,
        notes: true,
        customer: { select: { name: true, primaryPhone: true } },
        lines: {
          select: {
            requestedUnits: true,
            fuel: { select: { displayName: true } },
            dispatchLines: { select: { confirmations: { select: { acceptedUnits: true } } } },
          },
        },
      },
    });

    return rows
      .flatMap((order) =>
        order.lines.map((line) => ({
          customer: order.customer.name,
          phone: order.customer.primaryPhone ?? "",
          address: order.addressSnapshot,
          fuel: line.fuel.displayName,
          fuusto: line.requestedUnits
            .sub(
              line.dispatchLines
                .flatMap((dispatch) => dispatch.confirmations)
                .reduce((sum, confirmation) => sum.add(confirmation.acceptedUnits), new Prisma.Decimal(0)),
            )
            .toFixed(3),
          notes: order.notes ?? "",
        })),
      )
      .filter((row) => new Prisma.Decimal(row.fuusto).gt(0));
  }
  @Get("delivery-list") async manifest(@Query("date") date:string) { return {data:await this.deliveryList(date)}; }
  @Get("delivery-list/pdf") async manifestPdf(@Query("date") date:string,@Res() res:Response) {
    const rows=await this.deliveryList(date);
    const pdf=await exportToPdf({title:"Liiska Gaarsiinta",subtitle:date,columns:[{header:"Macmiil",key:"customer"},{header:"Telefoon",key:"phone"},{header:"Goobta",key:"address"},{header:"Shidaalka",key:"fuel"},{header:"Fuusto",key:"fuusto"},{header:"Faahfaahin",key:"notes"}],rows});
    res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`inline; filename="delivery-list-${date}.pdf"`);res.send(pdf);
  }
  @Post("orders") async order(@Req() req:AuthenticatedRequest,@Headers("idempotency-key") key:string|undefined,@Body() input:SimpleOrderInput) { return {data:await this.service.order(requireActor(req),key,input)}; }
  @Post("receipts") async receipt(@Req() req:AuthenticatedRequest,@Headers("idempotency-key") key:string|undefined,@Body() input:SimpleReceiptInput) { return {data:await this.service.receipt(requireActor(req),key,input)}; }
  @Post("payments") async payment(@Req() req:AuthenticatedRequest,@Headers("idempotency-key") key:string|undefined,@Body() input:SimplePaymentInput) { return {data:await this.service.payment(requireActor(req),key,input)}; }
  @Post("deliveries") async delivery(@Req() req:AuthenticatedRequest,@Headers("idempotency-key") key:string|undefined,@Body() input:SimpleDeliveryInput) { return {data:await this.service.delivery(requireActor(req),key,input)}; }
}
