import type { Metadata } from "next";
import { Privacy } from "@/components/Privacy";

export const metadata: Metadata = { title: "Privacy · Hifz Tracker" };

export default function PrivacyPage() {
  return <Privacy />;
}
