// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BANDS } from "~/lib/insanity";
import Distortion from "./distortion";

afterEach(cleanup);

const [lucid, twitchy, feral, gone] = BANDS;

function layers(container: HTMLElement) {
  return container.querySelectorAll("div div").length;
}

describe("Distortion", () => {
  it("draws nothing while the head is clear", () => {
    const { container } = render(<Distortion band={lucid} />);

    expect(container.firstChild).toBeNull();
  });

  it("appears once the meter has been paid into", () => {
    const { container } = render(<Distortion band={twitchy} />);

    expect(container.firstChild).not.toBeNull();
  });

  it("never takes a click", () => {
    // Anything laid over both windows has to be invisible to the mouse. The
    // meter distorts what the player sees, never what they can do.
    const { container } = render(<Distortion band={gone} />);

    expect((container.firstChild as HTMLElement).className).toContain(
      "pointer-events-none",
    );
  });

  it("is hidden from assistive tech", () => {
    const { container } = render(<Distortion band={feral} />);

    expect(
      (container.firstChild as HTMLElement).getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("gets heavier as it gets worse", () => {
    const mild = render(<Distortion band={twitchy} />);
    const mildLayers = layers(mild.container);
    cleanup();

    const bad = render(<Distortion band={gone} />);

    expect(layers(bad.container)).toBeGreaterThan(mildLayers);
  });
});
