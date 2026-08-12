import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DownUp — Download Video YouTube, Facebook, Instagram",
  description: "Download video dari YouTube, Facebook, dan Instagram langsung dari browser.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
