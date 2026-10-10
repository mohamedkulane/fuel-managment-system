"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { api, type PaginatedResponse } from "../../../lib/api";
import { formatFuel } from "../../../lib/format";
import { Card, CardHead, ErrorState, PageHeader, SubmitButton } from "../../../components/ui";
type Customer = { id:string; name:string; addresses:Array<{addressText:string}> };
type Fuel = { id:string; displayName:string }; type Unit = { id:string; name:string };
export default function NewOrderPage() {
  const router = useRouter();
  const client = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [fuelId, setFuelId] = useState("");
  const [salesUnitId, setSalesUnitId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [discount, setDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");

  const customers = useQuery({ queryKey: ["customers", "order-options"], queryFn: () => api<Customer[] | PaginatedResponse<Customer>>("/customers") });
  const fuels = useQuery({ queryKey: ["fuels"], queryFn: () => api<Fuel[]>("/fuels") });
  const units = useQuery({ queryKey: ["sales-units"], queryFn: () => api<Unit[]>("/sales-units") });

  const create = useMutation({
    mutationFn: (body: object) => api<{ id: string }>("/orders", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async (row) => {
      await client.invalidateQueries({ queryKey: ["orders"] });
      router.push(`/orders/${row.id}`);
    }
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    create.mutate({
      customerId: d.get("customerId"),
      addressSnapshot: d.get("addressSnapshot"),
      requestedDeliveryDate: d.get("deliveryDate") || undefined,
      fixedDiscountAmount: d.get("fixedDiscountAmount") || "0",
      discountReason: d.get("discountReason") || undefined,
      notes: d.get("notes"),
      lines: [{ fuelId: d.get("fuelId"), salesUnitId: d.get("salesUnitId"), requestedUnits: d.get("requestedUnits") }]
    });
  }

  const raw = customers.data;
  const customerList = Array.isArray(raw) ? raw : raw?.items ?? [];

  return (
    <main className="page">
      <PageHeader
        eyebrow="Dalabyada / cusub"
        title="Diiwaangeli dalab cusub"
        description="Qabo codsiga oo kaydi. Qiimaha, lacag-dhimista, iyo kuleetarka litarada waxay ku xirnadaan xaqiijinta."
        actions={
          <Link className="btn" href="/orders">
            <ArrowLeft size={14} /> Dib u laab dalabyada
          </Link>
        }
      />
      <ol className="workflow-steps">
        <li className="active">Faahfaahinta dalabka</li>
        <li>Eegista & xaqiijinta</li>
        <li>Dirista</li>
      </ol>

      {(customers.isError || fuels.isError || units.isError) && (
        <ErrorState
          message={(customers.error || fuels.error || units.error)?.message ?? "Ma kleen in la raro xogta dalabka"}
          retry={() => {
            void customers.refetch();
            void fuels.refetch();
            void units.refetch();
          }}
        />
      )}

      <form onSubmit={submit}>
        <div className="two-col">
          <Card>
            <CardHead title="Macmiilka & shidaalka" description="Geli xogta macmiilka, tirada la codsaday, iyo lacag-dhimista tooska ah ee lagu heshiiyay." />
            <div className="card-body">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="customerId">Macmiilka *</label>
                  <select id="customerId" className="select" name="customerId" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">Dooro macmiilka</option>
                    {customerList.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="fuelId">Nooca shidaalka *</label>
                  <select id="fuelId" className="select" name="fuelId" required value={fuelId} onChange={(e) => setFuelId(e.target.value)}>
                    <option value="">Dooro shidaalka</option>
                    {fuels.data?.map((x) => (
                      <option key={x.id} value={x.id}>
                        {formatFuel(x.displayName)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="requestedUnits">Tirada la codsaday *</label>
                  <input id="requestedUnits" className="input" name="requestedUnits" required inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Geli tirada fuustooyinka" />
                </div>
                <div className="field">
                  <label htmlFor="salesUnitId">Halbeegka iibka *</label>
                  <select id="salesUnitId" className="select" name="salesUnitId" required value={salesUnitId} onChange={(e) => setSalesUnitId(e.target.value)}>
                    <option value="">Dooro halbeegka</option>
                    {units.data?.map((x) => (
                      <option key={x.id} value={x.id}>
                        Fuusto
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="fixedDiscountAmount">Lacag-dhimista Tooska ah ee Order-ka ($)</label>
                  <input id="fixedDiscountAmount" className="input" name="fixedDiscountAmount" inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" />
                  <span className="text-muted text-xs">Lacag-dhimis go'an oo doolar ah oo lagu sameeyay wadarta dalabka.</span>
                </div>
                <div className="field">
                  <label htmlFor="discountReason">Sababta Ogolaanshaha Lacag-dhimista</label>
                  <input id="discountReason" className="input" name="discountReason" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="tusaale: Milkiilaha ayaa ogolaaday heshiiska iibka weyn" />
                </div>
                <div className="field full">
                  <label htmlFor="addressSnapshot">Ciwaanka gaarsiinta *</label>
                  <input key={customerId} id="addressSnapshot" className="input" name="addressSnapshot" required defaultValue={customerList.find((c) => c.id === customerId)?.addresses[0]?.addressText ?? ""} placeholder="Geli goobta gaarsiinta" />
                </div>
                <div className="field">
                  <label htmlFor="deliveryDate">Taariikhda la rabo in lagu gaarsiiyo</label>
                  <input id="deliveryDate" className="input" name="deliveryDate" type="date" />
                </div>
                <div className="field full">
                  <label htmlFor="notes">Fariimo dheeraad ah</label>
                  <textarea id="notes" className="textarea" name="notes" placeholder="Xusuus-qoor hawgalka xafiiska" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Hor-u-eegista dalabka" description="Dalabyada qabyada ah ma abuuraan deyn ilaa la xaqiijiyo." />
            <div className="card-body">
              <div className="info-pair">
                <span>Macmiilka</span>
                <b>{customerList.find((c) => c.id === customerId)?.name ?? "Aan la dooran"}</b>
              </div>
              <div className="info-pair">
                <span>Shidaalka</span>
                <b>{formatFuel(fuels.data?.find((f) => f.id === fuelId)?.displayName) || "Aan la dooran"}</b>
              </div>
              <div className="info-pair">
                <span>Tirada</span>
                <b>
                  {quantity || "—"} Fuusto
                </b>
              </div>
              <div className="info-pair">
                <span>Lacag-dhimista Tooska ah</span>
                <b className="text-emerald-400">-${discount ? parseFloat(discount || "0").toFixed(2) : "0.00"}</b>
              </div>
              <div className="notice" style={{ marginTop: 20 }}>
                <ShieldCheck size={16} />
                Qiimaha iibka ee lagu heshiiyay, lacag-dhimista tooska ah, iyo kuleetarka litarada waxay noqon doonaan kuwa aan ka noqosho lahayn marka dalabka la xaqiijiyo.
              </div>
              {create.isError && <ErrorState message={create.error.message} />}
              <div className="form-actions">
                <SubmitButton busy={create.isPending}>Kaydi dalabka qabyada ah</SubmitButton>
              </div>
            </div>
          </Card>
        </div>
      </form>
    </main>
  );
}

