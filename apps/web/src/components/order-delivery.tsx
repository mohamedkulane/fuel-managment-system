"use client";
import { useState, type FormEvent } from "react";
import Decimal from "decimal.js";
import { useWorkflow } from "./simple-forms";
import { ActionButton, FormLabel } from "./controls";
import { ErrorState, Modal, SubmitButton } from "./ui";
import { fuustoQuantity, formatFuel } from "../lib/format";

type Line = {
  id: string;
  requestedUnits: string;
  amendedUnits?: string;
  cancelledUnits?: string;
  fuel: { displayName: string };
  dispatchLines: { confirmations: { acceptedUnits: string }[] }[];
};

export function OrderDelivery({ orderId, lines }: { orderId: string; lines: Line[] }) {
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [closeRemainder, setCloseRemainder] = useState<Record<string, boolean>>({});

  const lineStats = (line: Line) => {
    const requested = new Decimal(line.requestedUnits).add(line.amendedUnits ?? 0).sub(line.cancelledUnits ?? 0);
    const delivered = line.dispatchLines.flatMap((dl) => dl.confirmations).reduce((sum, c) => sum.add(c.acceptedUnits), new Decimal(0));
    const remaining = Decimal.max(0, requested.sub(delivered));
    return { requested, delivered, remaining };
  };

  const eligible = lines.filter((line) => lineStats(line).remaining.gt(0));

  const save = useWorkflow<{
    orderId: string;
    lines: {
      orderLineId: string;
      acceptedUnits: string;
      remaining?: string;
      reason?: string;
      closeRemainder?: boolean;
      amendmentReason?: string;
    }[];
  }>(
    "/simple/deliveries",
    () => {
      setOpen(false);
      setQuantities({});
      setCloseRemainder({});
    },
    { success: "Gaarsiinta shidaalka si guul leh ayaa loo xaqiijiyay", error: "Gaarsiinta lama xaqiijin karin" }
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    save.mutate({
      orderId,
      lines: eligible.map((line) => {
        const stats = lineStats(line);
        const value = quantities[line.id] ?? stats.remaining.toString();
        const accepted = /^\d+$/.test(value) ? new Decimal(value) : new Decimal(0);
        const isClosing = Boolean(closeRemainder[line.id]);
        return {
          orderLineId: line.id,
          acceptedUnits: value,
          remaining: accepted.lt(stats.remaining) ? (String(data.get("remaining-" + line.id) || "") as ("RETURNED" | "IN_TRANSIT")) || undefined : undefined,
          reason: String(data.get("reason-" + line.id) || "") || undefined,
          closeRemainder: isClosing,
          amendmentReason: accepted.gt(stats.remaining) ? String(data.get("amendmentReason-" + line.id) || "") || undefined : undefined
        };
      })
    });
  }

  return (
    <>
      <ActionButton className="btn primary" onClick={() => setOpen(true)}>
        Xaqiiji Gaarsiinta
      </ActionButton>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Xaqiiji Gaarsiinta Shidaalka">
        <form onSubmit={submit} className="space-y-4">
          {eligible.map((line) => {
            const stats = lineStats(line);
            const value = quantities[line.id] ?? stats.remaining.toString();
            const accepted = /^\d+$/.test(value) ? new Decimal(value) : new Decimal(0);
            const isExcess = accepted.gt(stats.remaining);
            const isLess = accepted.lt(stats.remaining);
            const excessAmount = isExcess ? accepted.sub(stats.remaining) : new Decimal(0);
            const remainderAmount = isLess ? stats.remaining.sub(accepted) : new Decimal(0);
            const isClosing = Boolean(closeRemainder[line.id]);

            return (
              <div className="card-body border rounded-lg p-4 bg-card space-y-3" key={line.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                  <h3 className="font-semibold text-base">
                    {formatFuel(line.fuel.displayName)}
                  </h3>
                  <div className="text-xs text-muted-foreground flex gap-3">
                    <span>Dalabkii: <strong>{fuustoQuantity(line.requestedUnits)}</strong></span>
                    <span>Hore loo geeyey: <strong>{fuustoQuantity(stats.delivered.toString())}</strong></span>
                    <span>Harsan: <strong className="text-primary">{fuustoQuantity(stats.remaining.toString())} Fuusto</strong></span>
                  </div>
                </div>

                <div className="field">
                  <FormLabel htmlFor={"accepted-" + line.id}>Tirada uu qaatay macmiilku (Fuusto)</FormLabel>
                  <input
                    id={"accepted-" + line.id}
                    type="number"
                    min="0"
                    step="1"
                    className="input w-full"
                    value={value}
                    onChange={(e) => setQuantities({ ...quantities, [line.id]: e.target.value })}
                    inputMode="numeric"
                    pattern="[0-9]+"
                    required
                  />
                </div>

                {isExcess && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-amber-700 dark:text-amber-400 space-y-2">
                    <p className="font-medium text-sm flex items-center gap-1.5">
                      ⚠️ <strong>Fuusto Dheeraad ah (+{excessAmount.toString()} Fuusto)</strong>
                    </p>
                    <p className="text-xs">
                      Tiradani way ka badan tahay intii dalabka ku hartay. Kordhinta dalabka waxay u baahan tahay oggolaanshaha Milkiilaha.
                    </p>
                    <div className="field">
                      <FormLabel htmlFor={"amendmentReason-" + line.id}>Sababta kordhinta dheeraadka ah</FormLabel>
                      <input
                        id={"amendmentReason-" + line.id}
                        name={"amendmentReason-" + line.id}
                        className="input w-full text-sm"
                        placeholder="Tusaale: Macmiilku wuxuu codsaday in haanta loo buuxiyo"
                        required
                      />
                    </div>
                  </div>
                )}

                {isLess && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Waxaa dhiman <strong>{fuustoQuantity(remainderAmount.toString())} Fuusto</strong>.
                    </p>

                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isClosing}
                        onChange={(e) => setCloseRemainder({ ...closeRemainder, [line.id]: e.target.checked })}
                        className="rounded"
                      />
                      <span>Dhammaystir intan oo jooji inta harsan</span>
                    </label>

                    <div className="space-y-2 pt-1 border-t border-border/50">
                      <FormLabel htmlFor={"remaining-" + line.id}>Halkee ku jiraa shidaalka haray ee gaariga ku jiray? *</FormLabel>
                      <select
                        id={"remaining-" + line.id}
                        name={"remaining-" + line.id}
                        className="select w-full text-sm"
                        required
                        defaultValue=""
                      >
                        <option value="">Dooro xaaladda shidaalka</option>
                        <option value="RETURNED">Bakhaarka ayay ku soo noqdeen</option>
                        <option value="IN_TRANSIT">Weli gaariga/jidka ayay ku jiraan</option>
                      </select>
                    </div>

                    <div className="field">
                      <FormLabel htmlFor={"reason-" + line.id}>Sababta dhimista ama joojinta</FormLabel>
                      <input
                        id={"reason-" + line.id}
                        name={"reason-" + line.id}
                        className="input w-full text-sm"
                        placeholder="Tusaale: Macmiilka haantiisa ayaa buuxsantay"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <p className="notice warn text-xs">
            Xaqiiji tirada dhabta ah. Kaydka shidaalka iyo xisaabta macmiilka ayaa isla markiiba la cusboonaysiinayaa.
          </p>

          {save.isError && <ErrorState message={save.error.message} />}

          <div className="form-actions flex justify-end gap-2 pt-2">
            <ActionButton className="btn" type="button" onClick={() => setOpen(false)}>
              Ka noqo
            </ActionButton>
            <SubmitButton busy={save.isPending}>
              Xaqiiji Gaarsiinta
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
