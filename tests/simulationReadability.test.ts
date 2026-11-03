import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import SimulationModal from "../src/features/simulation/SimulationModal";
import { Configuration } from "../src/features/surveyV23/Fields";
import { SIMULATION_TIMING } from "../src/features/simulation/simulationScript";
import { BOUNDARY } from "../src/features/surveyV23/content";

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  vi.useRealTimers();
});
function render(element: ReturnType<typeof createElement>) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(element));
}

describe("模拟辅助理解与差异标识", () => {
  it("解释使用日常名称，不向受访者展示研究变量编码", () => {
    expect(BOUNDARY).not.toMatch(/X[123]/);
    for (const label of ["能看到的信息", "信息发给谁", "监测方式"]) {
      expect(BOUNDARY).toContain(label);
    }
  });
  it.each(["C1", "C8"] as const)(
    "%s异常后3秒才出现通知，各配置采用相同演示节奏",
    (profileId) => {
      vi.useFakeTimers();
      render(
        createElement(SimulationModal, {
          profileId,
          taskId: null,
          source: "dce",
          onClose: vi.fn(),
          onEvent: vi.fn(),
        }),
      );
      const notice = () =>
        document.querySelector('aside[aria-label="异常通知"]');
      act(() => vi.advanceTimersByTime(SIMULATION_TIMING.autoEventDelayMs));
      expect(notice()).toBeNull();
      act(() => vi.advanceTimersByTime(2999));
      expect(notice()).toBeNull();
      act(() => vi.advanceTimersByTime(1));
      expect(notice()).not.toBeNull();
      expect(notice()!.className).toContain("bg-champagne-50/80");
    },
  );
  it("两侧差异项均有醒目标识，模拟明确可选且不会代选方案", () => {
    const onSelect = vi.fn(),
      onSimulation = vi.fn();
    render(
      createElement(Configuration, {
        id: "C1",
        other: "C3",
        title: "左侧方案",
        onSelect,
        onSimulation,
      }),
    );
    expect(document.querySelectorAll(".survey-difference-label")).toHaveLength(
      2,
    );
    expect(document.querySelector('[data-attribute="X1"] dt')!.textContent).toContain("能看到的信息");
    expect(
      document.querySelector('[data-attribute="X1"] .survey-difference-label'),
    ).toBeNull();
    const button = document.querySelector("button")!;
    expect(button.textContent).toContain("展开动态模拟帮助理解（可选）");
    act(() => button.click());
    expect(onSimulation).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });
  it("演示视频已作为MP4静态资源放入项目", () => {
    const bytes = readFileSync(
      resolve(process.cwd(), "public/videos/fall-demo.mp4"),
    );
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes.subarray(4, 8).toString()).toBe("ftyp");
  });
});
