import type { Metadata } from "next";
import { Guide } from "@/components/Guide";

export const metadata: Metadata = { title: "Guide · Hifz Tracker" };

export default function GuidePage() {
  return <Guide />;
}
