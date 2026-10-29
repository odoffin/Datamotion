import type { Metadata } from "next";
import { ChapterMap } from "@/components/chapters/ChapterMap";

export const metadata: Metadata = { title: "Chapters" };

export default function ChaptersPage() {
  return <ChapterMap />;
}
