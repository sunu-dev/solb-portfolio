import { LEARNING_LINKS, LEARNING_TERMS } from "@/config/stockLearningGraph";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  compareDiscovery,
  emptyDiscovery,
  evidenceRevision,
  newsKey,
  parseDiscovery,
  publicQuestionNews,
  recentDiscoveryNews,
  updateDiscovery,
  DISCOVERY_PREFIX,
} from "@/lib/stockDiscovery";
import {
  discoveryTags,
  rankQuestions,
  STOCK_QUESTIONS,
  stockQuestion,
} from "@/config/stockQuestions";
import { STOCK_LESSONS } from "@/config/stockLearning";
import { USER_STORAGE_KEY_PREFIXES } from "@/lib/userStorage";
import type { NewsItem } from "@/config/constants";
const now = Date.parse("2026-10-15T09:00:00Z");
const article = (title = "실적 발표", time = now - 3600000): NewsItem => ({
  title,
  pubDate: new Date(time).toISOString(),
  link: "https://example.com/public",
  source: "공개 출처",
  description: "",
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("return visit evidence", () => {
  it("filters duplicate, stale, future and undated news without manufacturing freshness", () => {
    const news = recentDiscoveryNews(
      [
        article(),
        article(),
        article("old", now - 8 * 86400000),
        article("future", now + 3600000),
        { ...article("bad"), pubDate: "" },
      ],
      now,
    );
    expect(news).toHaveLength(1);
    expect(news[0].title).toBe("실적 발표");
  });
  it("only labels articles published after the acknowledged visit as new", () => {
    const previous = {
      viewedAt: now - 7200000,
      news: [newsKey(article("seen"))],
      price: 100,
      quoteAt: now - 7200000,
      currency: "USD",
    };
    const current = {
      viewedAt: now,
      news: [],
      price: 90,
      quoteAt: now - 1000,
      currency: "USD",
    };
    const result = compareDiscovery(previous, current, [
      article("new"),
      article("seen"),
      article("new to feed but older", now - 3 * 3600000),
    ]);
    expect(result.newItems.map((n) => n.title)).toEqual(["new"]);
    expect(result.priceChange).toBeCloseTo(-10);
    expect(
      compareDiscovery(previous, { ...current, quoteAt: previous.quoteAt }, [])
        .priceChange,
    ).toBeNull();
    expect(
      compareDiscovery(previous, { ...current, currency: "KRW" }, [])
        .priceChange,
    ).toBeNull();
    expect(
      compareDiscovery(previous, { ...current, price: undefined }, [])
        .priceChange,
    ).toBeNull();
  });
  it("passes dated public headlines only and revises caches when evidence changes", () => {
    const safe = publicQuestionNews(
      [article(), article("old", now - 8 * 86400000)],
      now,
    );
    expect(safe).toContain("공개 출처");
    expect(safe).toContain(article().pubDate);
    expect(safe).not.toContain("old");
    vi.spyOn(Date, "now").mockReturnValue(now);
    expect(evidenceRevision([article()], now, 10)).not.toBe(
      evidenceRevision([article("changed")], now, 10),
    );
    expect(evidenceRevision([], now, 10, 20)).not.toBe(
      evidenceRevision([], now, 10, 21),
    );
    vi.restoreAllMocks();
  });
  it("validates and bounds browser history, rejecting corrupt and future values", () => {
    expect(parseDiscovery("bad", now)).toEqual(emptyDiscovery());
    expect(parseDiscovery(JSON.stringify({ version: 2 }), now)).toEqual(
      emptyDiscovery(),
    );
    const parsed = parseDiscovery(
      JSON.stringify({
        version: 1,
        lessons: { cash: now, debt: now + 86400000 },
        stocks: {
          AAPL: {
            viewedAt: now,
            news: ["abc", "https://private"],
            price: -5,
            quoteAt: now,
          },
        },
        resume: "cash",
      }),
      now,
    );
    expect(parsed.lessons).toEqual({ cash: now });
    expect(parsed.stocks.AAPL.news).toEqual(["abc"]);
    expect(parsed.stocks.AAPL.price).toBeUndefined();
    expect(USER_STORAGE_KEY_PREFIXES).toContain(DISCOVERY_PREFIX);
  });
  it("separates accounts, merges existing lessons and handles storage failure", () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const values = new Map<string, string>();
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
    });
    expect(
      updateDiscovery("alice", (h) => {
        h.lessons.cash = now;
      }),
    ).toBe(true);
    updateDiscovery("alice", (h) => {
      h.lessons.debt = now;
    });
    updateDiscovery("bob", (h) => {
      h.lessons.fx = now;
    });
    expect(
      parseDiscovery(values.get(DISCOVERY_PREFIX + "alice")!, now).lessons,
    ).toEqual({ cash: now, debt: now });
    expect(
      parseDiscovery(values.get(DISCOVERY_PREFIX + "bob")!, now).lessons,
    ).toEqual({ fx: now });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("blocked");
      },
    });
    expect(updateDiscovery("alice", () => {})).toBe(false);
  });
});
describe("varied source-backed explanations", () => {
  it("ranks actual headline topics and offers unopened alternatives", () => {
    const tags = discoveryTags("회사가 신규 수주 계약을 발표했다");
    expect(tags).toContain("backlog");
    expect(rankQuestions(tags)[0].id).toBe("backlog");
    expect(rankQuestions([], ["safe", "value", "growth"])[0].id).toBe(
      "balance",
    );
    expect(stockQuestion("__proto__")).toBeUndefined();
    expect(stockQuestion({})).toBeUndefined();
    expect(new Set(STOCK_QUESTIONS.map((x) => x.id)).size).toBe(
      STOCK_QUESTIONS.length,
    );
  });
  it("supplies diverse explanations with explicit hypothetical examples and sources, without quiz gates", () => {
    expect(STOCK_LESSONS.length).toBeGreaterThanOrEqual(20);
    for (const lesson of STOCK_LESSONS) {
      expect(lesson.example).toMatch(/가상|예시/);
      expect(lesson.source).toMatch(
        /^https:\/\/(www\.)?(sec.gov|investor.gov|federalreserve.gov|bls.gov)\//,
      );
      expect(lesson.observation.length).toBeGreaterThan(40);
      expect(lesson).not.toHaveProperty("correct");
    }
  });
});

it("every explanation has meaningful valid onward links and the graph is connected", () => {
  const ids = new Set(STOCK_LESSONS.map((item) => String(item.id)));
  for (const id of ids) {
    expect(LEARNING_LINKS[id]?.length).toBeGreaterThanOrEqual(3);
    for (const [target, reason] of LEARNING_LINKS[id]) {
      expect(ids.has(target)).toBe(true);
      expect(target).not.toBe(id);
      expect(reason.length).toBeGreaterThan(8);
    }
  }
  for (const [, id] of LEARNING_TERMS) expect(ids.has(id)).toBe(true);
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    LEARNING_LINKS[id].forEach(([next]) => visit(next));
  };
  visit("earnings");
  expect(visited.size).toBe(ids.size);
});
