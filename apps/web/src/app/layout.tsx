import type { Metadata } from "next";
import "../styles/app.css";

export const metadata: Metadata = {
  title: "CadenceLab: Chẩn đoán Nhịp dựng, Dự báo SEIR-F và Hồ sơ Chiến lược",
  description:
    "Phòng thí nghiệm nhịp độ và giải mã chiến lược nội dung với CFI 0.5s pacing diagnostics, mô hình dịch tễ học SEIR-F và truy xuất khoảng trống nhu cầu.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="overflow-x-clip">
      <head>
        {process.env.CADENCELAB_DESKTOP_EXPORT !== "1" && <>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Wix+Madefor+Display:wght@400;500;600&family=Wix+Madefor+Text:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        </>}
      </head>
      <body className="overflow-x-clip">{children}</body>
    </html>
  );
}
