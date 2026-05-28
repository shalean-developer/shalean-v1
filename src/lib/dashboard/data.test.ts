import { describe, expect, it } from "vitest";
import { partitionCleanerDashboardJobs, type CleanerDashboardJob } from "./data";

describe("partitionCleanerDashboardJobs", () => {
  it("keeps Home focused on offers and today's accepted or in-progress jobs", () => {
    const partitioned = partitionCleanerDashboardJobs(
      [
        job("offer", "offered", "2026-05-29"),
        job("declined", "declined", "2026-05-29"),
        job("today-accepted", "accepted", "2026-05-28"),
        job("future-accepted", "accepted", "2026-05-29"),
        job("today-in-progress", "in_progress", "2026-05-28"),
        job("today-completed", "completed", "2026-05-28"),
      ],
      "2026-05-28",
    );

    expect(ids(partitioned.offers)).toEqual(["offer"]);
    expect(ids(partitioned.todayJobs)).toEqual(["today-accepted", "today-in-progress"]);
    expect(ids(partitioned.upcomingJobs)).toEqual(["future-accepted"]);
    expect(ids(partitioned.completedJobs)).toEqual(["today-completed"]);
    expect(ids(partitioned.activeJobs)).toEqual(["today-accepted", "future-accepted", "today-in-progress"]);
  });
});

function job(id: string, status: string, bookingDate: string): CleanerDashboardJob {
  return {
    booking: {
      id: `booking-${id}`,
      booking_date: bookingDate,
      booking_time: "09:00-12:00",
      service_slug: "regular-cleaning",
      suburb: "Sea Point",
    },
    offer: {
      id,
      status,
    },
    cleaner: null,
    safeAddress: ["accepted", "in_progress", "completed"].includes(status) ? "Hidden in Home" : null,
    safeNotes: null,
  } as unknown as CleanerDashboardJob;
}

function ids(jobs: CleanerDashboardJob[]) {
  return jobs.map((item) => item.offer.id);
}
