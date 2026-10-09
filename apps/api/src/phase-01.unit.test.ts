import { describe, expect, it } from "vitest";
import { createCustomerSchema, updateCustomerSchema, paginationQuerySchema } from "@fuel/shared";

describe("Phase 1 Backend & Schema Invariants", () => {
  it("validates customer creation DTO requirements", () => {
    const valid = createCustomerSchema.parse({
      name: "Ahmed Trading",
      primaryPhone: "+252615000000",
      address: "Maka al Mukarama",
      district: "Hodan",
      city: "Mogadishu"
    });
    expect(valid.name).toBe("Ahmed Trading");
    expect(valid.district).toBe("Hodan");

    expect(() => createCustomerSchema.parse({ name: "" })).toThrow();
  });

  it("validates customer pagination query default parameters", () => {
    const defaultParams = paginationQuerySchema.parse({});
    expect(defaultParams.page).toBe(1);
    expect(defaultParams.limit).toBe(20);

    const customParams = paginationQuerySchema.parse({ page: "3", limit: "50", search: "Hassan" });
    expect(customParams.page).toBe(3);
    expect(customParams.limit).toBe(50);
    expect(customParams.search).toBe("Hassan");
  });

  it("validates customer update DTO fields", () => {
    const update = updateCustomerSchema.parse({
      status: "HOLD",
      notes: "Account put on hold by office manager"
    });
    expect(update.status).toBe("HOLD");
    expect(update.notes).toBe("Account put on hold by office manager");
  });
});
