// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BANDS } from "~/lib/insanity";
import InsanityMeter, { formatCost } from "./insanity-meter";

afterEach(cleanup);

const lucid = BANDS[0];
const gone = BANDS[3];

describe("formatCost", () => {
  it("signs a charge and a refund", () => {
    expect(formatCost(2)).toBe("+2");
    expect(formatCost(-1)).toBe("−1");
  });

  it("keeps the decimals the price list actually has", () => {
    expect(formatCost(0.6)).toBe("+0.6");
    expect(formatCost(-0.05)).toBe("−0.05");
  });

  it("does not print a float artifact", () => {
    // What `-0.2 * 0.25` produces in binary. The button must not read
    // "-0.05000000000000001".
    expect(formatCost(-0.2 * 0.25)).toBe("−0.05");
  });

  it("prints a mood that does nothing as nothing", () => {
    expect(formatCost(0)).toBe("0");
  });
});

describe("InsanityMeter", () => {
  it("reports the reading to assistive tech", () => {
    render(<InsanityMeter insanity={42.4} band={lucid} />);

    const meter = screen.getByRole("meter", { name: "Insane-O-Meter" });
    expect(meter.getAttribute("aria-valuenow")).toBe("42");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
  });

  it("names the band it is in", () => {
    render(<InsanityMeter insanity={95} band={gone} />);

    expect(screen.getByText("Gone")).toBeDefined();
  });
});
