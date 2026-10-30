import type { Metadata } from "next";
import { PlacementQuiz } from "@/components/placement/PlacementQuiz";

export const metadata: Metadata = { title: "Placement quiz" };

export default function PlacementPage() {
  return <PlacementQuiz />;
}
