import { describe, expect, it } from "vitest";
import { markTourInviteSeen, poseForStep, shouldAutoOpenTourInvite, TOUR_COPY, TOUR_FINISH_PATH, TOUR_SEEN_KEY } from "@/lib/mascotTour";

const memoryStorage = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe("mascot guided tour", () => {
  it("opens the invite automatically for a first-time visitor", () => {
    expect(shouldAutoOpenTourInvite(memoryStorage())).toBe(true);
  });

  it("does not auto-open again after the visitor saw or dismissed it", () => {
    const storage = memoryStorage();
    markTourInviteSeen(storage);
    expect(storage.getItem(TOUR_SEEN_KEY)).toBe("1");
    expect(shouldAutoOpenTourInvite(storage)).toBe(false);
  });

  it("ends the tour on account creation, not the paid app", () => {
    expect(TOUR_FINISH_PATH).toBe("/login?mode=register");
  });

  it("has one mascot line for each of the 8 'Como funciona' steps in every language", () => {
    for (const copy of Object.values(TOUR_COPY)) expect(copy.steps).toHaveLength(8);
  });

  it("waves on the first and last step and points at the content in between", () => {
    expect(poseForStep(0, 8)).toBe("wave");
    expect(poseForStep(7, 8)).toBe("wave");
    expect(poseForStep(3, 8)).toBe("point-up");
  });
});
