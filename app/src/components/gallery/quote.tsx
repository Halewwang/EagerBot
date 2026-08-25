import { z } from "zod";
import type { GalleryComponent } from "@/lib/copilot/gallery-registry";
import { GalleryFrame } from "./frame";

export const QuoteCardProps = z.object({
  quote: z
    .string()
    .describe("The quotation itself, without surrounding quote marks"),
  attribution: z
    .string()
    .describe(
      "Who said or wrote it, e.g. 'Grace Hopper' or 'the 2026 annual report'",
    ),
  context: z
    .string()
    .optional()
    .describe(
      "One short line of context: where it is from, or why it matters here",
    ),
});

type QuoteArgs = z.infer<typeof QuoteCardProps>;

export function QuoteCard({ quote, attribution, context }: Partial<QuoteArgs>) {
  if (!quote) {
    return (
      <GalleryFrame title="引述">
        <p className="text-sm text-muted-foreground">没有可引述的内容。</p>
      </GalleryFrame>
    );
  }

  return (
    <GalleryFrame caption={context} title="引述">
      <blockquote className="border-l-2 border-border pl-4">
        <p className="text-sm leading-relaxed">{quote}</p>
        {attribution ? (
          <footer className="mt-2 text-xs text-muted-foreground">
            ——{attribution}
          </footer>
        ) : null}
      </blockquote>
    </GalleryFrame>
  );
}

export const GALLERY: GalleryComponent[] = [
  {
    name: "showQuote",
    title: "引述",
    kind: "card",
    description:
      "显示引述及其出处。适合用于强调原话、某人说过的话或用户提供的文档中的句子。",
    parameters: QuoteCardProps,
    Component: QuoteCard as GalleryComponent["Component"],
    preview: {
      quote:
        "低于 $75 的餐费无需收据。超过 $75 需要收据，超过 $500 则需要在支出前获得经理批准。",
      attribution: "费用政策",
      context: "上次更新于 3 月。",
    },
    confirmation: "引述已显示在用户屏幕上。",
  },
];
