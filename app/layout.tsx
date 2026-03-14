import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "gemini3 hackathon paris - edu",
  description: "Built by Eduardo Gonzalez Ortiz",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
