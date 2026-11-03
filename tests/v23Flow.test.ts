import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { SurveyRoute } from "../src/features/surveyV23/SurveyPage";
import {
  BACKGROUND,
  CHECKS,
  COMMON_PREMISES,
} from "../src/features/surveyV23/content";
import {
  createSurvey,
  saveSurvey,
  restoreSurvey,
  type SurveyV23,
} from "../src/features/surveyV23/model";

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
});
function mount(type: "elder" | "caregiver", d?: SurveyV23) {
  if (d) saveSurvey(d);
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      createElement(
        MemoryRouter,
        { initialEntries: [`/survey/${type}?channel=test`] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/survey/:respondent",
            element: createElement(SurveyRoute),
          }),
        ),
      ),
    ),
  );
}
function button(text: string): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}
function click(text: string) {
  act(() => button(text).click());
}
function radio(name: string, index: number) {
  const input = Array.from(
    document.querySelectorAll<HTMLInputElement>("input[type=radio]"),
  ).filter((i) => i.name === name)[index];
  if (!input) throw new Error(`Missing radio ${name}:${index}`);
  act(() => input.click());
}
function inputValue(
  input: HTMLInputElement | HTMLSelectElement,
  value: string,
) {
  act(() => {
    const proto =
      input instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
    input.dispatchEvent(
      new Event(input instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
function prelude(type: "elder" | "caregiver") {
  act(() =>
    document.querySelector<HTMLInputElement>("input[type=checkbox]")!.click(),
  );
  radio("consent", 0);
  for (const q of BACKGROUND[type]) radio(q.id, 0);
  click("继续下一步");
  radio(CHECKS[type][0]!.id, 1);
  expect(document.querySelector("[role=status]")?.textContent).toContain(
    "重新选择",
  );
  for (const q of CHECKS[type]) radio(q.id, q.correct);
  click("继续下一步");
}
function rateAndAllocate(type: "elder" | "caregiver") {
  click("继续下一步");
  expect(document.querySelectorAll("section[hidden]")).toHaveLength(1);
  expect(document.querySelector(".survey-rating-scale")?.textContent).toContain(
    "完全不同意",
  );
  const names = new Set(
    Array.from(
      document.querySelectorAll<HTMLInputElement>(
        "section:not([hidden]) input[type=radio]",
      ),
    ).map((i) => i.name),
  );
  expect(names.size).toBe(8);
  for (const name of names) radio(name, 3);
  click("评价第二个方案");
  const secondNames = new Set(
    Array.from(
      document.querySelectorAll<HTMLInputElement>(
        "section:not([hidden]) input[type=radio]",
      ),
    ).map((i) => i.name),
  );
  expect(secondNames.size).toBe(8);
  for (const name of secondNames) radio(name, 3);
  click("继续下一步");
  const p = type === "elder" ? "a" : "b";
  radio(`${p}9`, 3);
  const concerns = document.querySelectorAll<HTMLInputElement>(
    "input[type=checkbox]",
  );
  act(() => {
    concerns[0]!.click();
    concerns[1]!.click();
  });
  expect(concerns[2]!.disabled).toBe(true);
  if (type === "elder") {
    expect(document.querySelectorAll("select")).toHaveLength(0);
  }
  const inputs =
    document.querySelectorAll<HTMLInputElement>("input[type=number]");
  ["49", "30", "20"].forEach((v, i) => inputValue(inputs[i]!, v));
  radio(`${p}-check`, 1);
  click("继续下一步");
  expect(document.querySelector("[role=alert]")?.textContent).toContain("100");
  inputValue(inputs[0]!, "50");
  click("继续下一步");
  expect(document.querySelector("h1")?.textContent).toBe("提交前检查");
  expect(document.querySelector("progress")).toBeNull();
}

describe("V2.3 从入口到本地提交的完整交互", () => {
  it("偶尔帮忙年限紧跟b3、位于b4之前，并保留必填校验", () => {
    mount("caregiver");
    radio("b0", 0);
    radio("b3", 3);
    const years = document.querySelector<HTMLInputElement>(
      'input[aria-label="照护年限"]',
    )!;
    const b3 = document.querySelector('input[name="b3"]')!.closest("fieldset")!;
    const b4 = document.querySelector('input[name="b4"]')!.closest("fieldset")!;
    expect(b3.parentElement!.contains(years)).toBe(true);
    expect(
      years.compareDocumentPosition(b4) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    inputValue(years, "2.5");
    expect(restoreSurvey("caregiver", "test")?.care_years).toBe(2.5);
    radio("b3", 0);
    expect(document.querySelector('input[aria-label="照护年限"]')).toBeNull();
  });
  it.each(["elder", "caregiver"] as const)(
    "%s只显示对应的四条共同前提，不混入X3解释",
    (type) => {
      const d = createSurvey(type, "test");
      d.step = 1;
      mount(type, d);
      const section = document.querySelector(
        '[aria-label="所有方案的共同前提"]',
      )!;
      expect(section.querySelectorAll("li")).toHaveLength(4);
      expect(section.textContent).toContain(COMMON_PREMISES[type].title);
      COMMON_PREMISES[type].items.forEach((item) =>
        expect(section.textContent).toContain(item),
      );
      for (const extra of [
        "平时：基础识别",
        "发现异常：按方案记录与通知",
        "全天记录：仅限相应设置",
        "紧急情况下同时通知社区与急救",
      ])
        expect(document.body.textContent).not.toContain(extra);
    },
  );
  it("老人版：三档、六授权、两配置评分、100分校验与提交", async () => {
    mount("elder");
    prelude("elder");
    expect(document.querySelector("h1")?.textContent).toBe("您的希望");
    for (const name of ["能看到的信息", "信息发给谁", "监测方式"])
      radio(name, 1);
    click("继续下一步");
    expect(document.querySelector("h1")?.textContent).toBe("自主授权情景");
    expect(document.querySelector("progress")?.getAttribute("value")).toBe("4");
    for (let i = 0; i < 6; i++) {
      expect(
        Array.from(
          document.querySelectorAll(".survey-configuration [data-level]"),
        ).map((el) => Number(el.getAttribute("data-level"))),
      ).toEqual(i < 2 ? [1, 0, 0] : i < 4 ? [1, 1, 0] : [1, 1, 1]);
      radio(`autonomy-${i}`, 2);
      click(i === 5 ? "确认本题" : "确认并进入下一题");
    }
    rateAndAllocate("elder");
    await act(async () => button("确认并提交问卷").click());
    expect(document.body.textContent).toContain("本地演示已完成校验");
    const d = restoreSurvey("elder", "test")!;
    expect(d.elder_preferences).toEqual({ X1: 50, X2: 50, X3: 50 });
    expect(d.autonomy_choices).toHaveLength(6);
    expect(
      d.comprehension.find((c) => c.question_id === "a7")?.first_correct,
    ).toBe(false);
  });
  it.each(["A", "B"] as const)(
    "照护者%s卷：4道正确任务、两配置与提交",
    async (split) => {
      let d = createSurvey("caregiver", "test");
      while (d.split_version !== split) d = createSurvey("caregiver", "test");
      mount("caregiver", d);
      prelude("caregiver");
      for (let i = 0; i < 4; i++) {
        radio("dce-choice", 0);
        click(i === 3 ? "确认本题" : "确认并进入下一题");
      }
      rateAndAllocate("caregiver");
      await act(async () => button("确认并提交问卷").click());
      expect(document.body.textContent).toContain("本地演示已完成校验");
      const saved = restoreSurvey("caregiver", "test")!;
      expect(saved.split_version).toBe(split);
      expect(saved.dce_choices).toHaveLength(4);
      expect(saved.dce_choices.map((c) => c.task_id).sort()).toEqual(
        split === "A"
          ? ["T01", "T02", "T07", "T08"]
          : ["T04", "T05", "T06", "T10"],
      );
    },
  );
  it("无实际照护经历者终止，不能通过资格筛选", () => {
    mount("caregiver");
    radio("b0", 1);
    expect(button("继续下一步").disabled).toBe(true);
    expect(document.body.textContent).toContain("不会提交调查数据");
  });
  it("老人a11默认分数框；切换仅排序后只显示排序，切回不残留排序", () => {
    const d = createSurvey("elder", "test");
    d.step = 5;
    mount("elder", d);
    expect(document.querySelectorAll("input[type=number]")).toHaveLength(3);
    expect(document.querySelectorAll("select")).toHaveLength(0);
    radio("allocation-mode", 1);
    expect(document.querySelectorAll("input[type=number]")).toHaveLength(0);
    expect(document.querySelectorAll("select")).toHaveLength(3);
    inputValue(document.querySelector("select")!, "security");
    radio("allocation-mode", 0);
    expect(document.querySelectorAll("select")).toHaveLength(0);
    expect(restoreSurvey("elder", "test")?.weight_allocation.ranking).toEqual(
      [],
    );
  });
});
