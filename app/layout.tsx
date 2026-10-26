import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CheckGram",
  description: "Real-time writing feedback powered by AI."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
