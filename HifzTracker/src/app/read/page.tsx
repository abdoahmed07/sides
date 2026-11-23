import type { Metadata } from "next";
import { Suspense } from "react";
import { Reader } from "@/components/Reader";

export const metadata: Metadata = { title: "Quran · Hifz Tracker" };

export default function ReadPage() {
  // The reader reads what to show from the link (?surah=18, ?page=604 …), which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <Reader />
    </Suspense>
  );
}
