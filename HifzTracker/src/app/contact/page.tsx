import type { Metadata } from "next";
import { ContactForm } from "@/components/Contact";

export const metadata: Metadata = { title: "Contact · Hifz Tracker" };

export default function ContactPage() {
  return <ContactForm />;
}
