import { expect, test } from "bun:test";
import { relativeTime } from "../src/lib/relative-time";

test("相对时间始终使用简体中文", () => {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60_000).toISOString();

  expect(relativeTime(twoMinutesAgo)).toBe("2分钟前");
});
