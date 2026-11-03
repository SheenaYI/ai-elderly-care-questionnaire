import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, it, expect, vi } from "vitest";
import ExperimentStep from "../src/features/surveyV23/ExperimentStep";
import { createSurvey, type SurveyV23 } from "../src/features/surveyV23/model";

let root: Root | null = null,
  host: HTMLDivElement,
  latest: SurveyV23;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  host?.remove();
  vi.useRealTimers();
});
function mount(d = createSurvey("caregiver", "test")) {
  latest = d;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  function Harness() {
    const [draft, setDraft] = useState(d);
    return (
      <ExperimentStep
        draft={draft}
        update={(next) => {
          latest = next;
          setDraft(next);
        }}
        simulate={vi.fn()}
        next={vi.fn()}
        back={vi.fn()}
      />
    );
  }
  act(() => root!.render(<Harness />));
}
function click(label: string) {
  const b = [...host.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
  expect(b).toBeDefined();
  act(() => b!.click());
}
function choose() {
  act(() =>
    host.querySelector<HTMLInputElement>(".survey-card-selector")!.click(),
  );
}
function progress() {
  return host.querySelector<HTMLProgressElement>(".survey-dce-progress")!;
}
describe("DCE清晰指令与完成反馈", () => {
  it("明确共同能力、三个变化维度和单选要求；未确认不增加进度", () => {
    mount();
    expect(host.textContent).toContain("基础异常识别与紧急报警能力相同");
    expect(host.textContent).toContain("每题选择您更愿意长期采用的一套方案");
    expect(progress().value).toBe(0);
    choose();
    expect(progress().value).toBe(0);
    click("确认并进入下一题");
    expect(progress().value).toBe(1);
    expect(latest.dce_choices).toHaveLength(1);
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain(
      "2",
    );
    expect(
      host.querySelector<HTMLInputElement>(".survey-card-selector")!.checked,
    ).toBe(false);
  });
  it("胶囊提示持续3秒后消失，下一题不自动代选", () => {
    vi.useFakeTimers();
    mount();
    choose();
    click("确认并进入下一题");
    const status = () => host.querySelector('[role="status"]')!.textContent;
    expect(status()).toContain("您已完成一道方案选择，已进入第 2 题");
    act(() => vi.advanceTimersByTime(2999));
    expect(status()).not.toBe("");
    act(() => vi.advanceTimersByTime(1));
    expect(status()).toBe("");
  });
  it("四题完成显示4/4，不提示第五题，重复确认不增加记录", () => {
    mount();
    for (let i = 0; i < 4; i++) {
      choose();
      click(i === 3 ? "确认本题" : "确认并进入下一题");
    }
    expect(progress().value).toBe(4);
    expect(latest.dce_choices).toHaveLength(4);
    expect(host.querySelector('[role="status"]')!.textContent).toContain(
      "4 道方案选择已全部完成",
    );
    expect(host.querySelector('[role="status"]')!.textContent).not.toContain(
      "第 5 题",
    );
    const final = [...host.querySelectorAll("button")].find(
      (b) => b.textContent === "确认本题",
    )!;
    expect(final.disabled).toBe(true);
  });
  it("跳到最后一题不会误报全部完成；改答已有题不重复计数", () => {
    mount();
    click("4");
    choose();
    click("确认本题");
    expect(progress().value).toBe(1);
    expect(host.querySelector('[role="status"]')!.textContent).toContain(
      "仍有 3 道方案选择未完成",
    );
    click("1");
    expect(host.querySelector('[role="status"]')!.textContent).toBe("");
    choose();
    click("确认并进入下一题");
    click("1 ✓");
    choose();
    click("确认并进入下一题");
    expect(progress().value).toBe(2);
    expect(latest.dce_choices).toHaveLength(2);
  });
  it("老人授权情景不套用DCE进度条和提示", () => {
    const d = createSurvey("elder", "test");
    d.step = 3;
    mount(d);
    expect(host.querySelector(".survey-dce-progress")).toBeNull();
    expect(host.textContent).toContain("同组两题的设备设置相同");
    expect(host.textContent).not.toContain(
      "每题选择您更愿意长期采用的一套方案",
    );
  });
});
