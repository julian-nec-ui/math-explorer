import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Math Explorer",
  description: "Step-by-step column arithmetic, animated.",
};

// On a phone the on-screen keyboard shrinks the page (Julian: in the test, the answer box, Check and Cancel test stay
// above the keyboard instead of under it): the panel is the screen's height (dvh), which then is the part left visible
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
