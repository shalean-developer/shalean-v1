import { describe, expect, it } from "vitest";
import { weekdayFromDate, weekdayList } from "./utils";

describe("admin weekday utils", () => {
  it("maps ISO date values to business weekdays", () => {
    expect(weekdayFromDate("2026-06-01")).toEqual([1]);
    expect(weekdayFromDate("2026-06-07")).toEqual([7]);
  });

  it("normalizes recurring weekday form values", () => {
    const formData = new FormData();
    formData.append("recurrenceWeekdays", "5");
    formData.append("recurrenceWeekdays", "3");
    formData.append("recurrenceWeekdays", "3");
    formData.append("recurrenceWeekdays", "9");
    formData.append("recurrenceWeekdays", "bad");

    expect(weekdayList(formData, "recurrenceWeekdays")).toEqual([3, 5]);
  });
});
