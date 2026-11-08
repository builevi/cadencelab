"use client";

import React, { useEffect, useState } from "react";

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  provider: "google";
}

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  onOpenDownloadModal: () => void;
  contextMessage?: string;
}

export function GoogleAuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenDownloadModal,
  contextMessage,
}: GoogleAuthModalProps) {
  const [clientId, setClientId] = useState<string>("");
  const [customClientIdInput, setCustomClientIdInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfigBox, setShowConfigBox] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Try env variable first, then localStorage
    const envId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    const savedId = localStorage.getItem("cadencelab_google_client_id") || "";
    const activeId = envId || savedId;

    setClientId(activeId);
    setCustomClientIdInput(activeId);

    // 2. Load Google Identity Services SDK
    const scriptId = "google-gsi-client";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleSaveCustomClientId(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = customClientIdInput.trim();
    if (!trimmed) {
      setErrorMessage("Vui lòng nhập Google OAuth Client ID hợp lệ.");
      return;
    }
    setClientId(trimmed);
    localStorage.setItem("cadencelab_google_client_id", trimmed);
    setShowConfigBox(false);
    setErrorMessage(null);
    // Trigger login immediately with the newly entered client ID
    triggerGoogleAuth(trimmed);
  }

  function triggerGoogleAuth(targetClientId?: string) {
    setErrorMessage(null);
    const activeId = targetClientId || clientId;

    if (!activeId) {
      setShowConfigBox(true);
      setErrorMessage("Chưa có Google Client ID. Vui lòng dán Client ID từ Google Cloud Console vào ô bên dưới để mở cửa sổ Google.");
      return;
    }

    if (typeof window === "undefined" || !(window as any).google?.accounts?.oauth2) {
      setErrorMessage("Đang tải thư viện Google Identity Services. Vui lòng bấm lại sau 2 giây.");
      return;
    }

    try {
      setIsLoading(true);

      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: activeId,
        scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid",
        prompt: "select_account",
        callback: async (tokenResponse: any) => {
          setIsLoading(false);
          if (tokenResponse.error) {
            setErrorMessage("Google OAuth trả về lỗi: " + tokenResponse.error);
            return;
          }

          try {
            // Fetch real user profile from Google API using the accessToken
            const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: {
                Authorization: "Bearer " + tokenResponse.access_token,
              },
            });

            if (!res.ok) {
              throw new Error("Không thể truy xuất thông tin từ Google API");
            }

            const data = await res.json();
            const profile: UserProfile = {
              name: data.name || data.email,
              email: data.email,
              avatar: data.picture || "",
              provider: "google",
            };

            onLoginSuccess(profile);
            onClose();
          } catch (err: any) {
            setErrorMessage(err.message || "Lỗi khi đọc thông tin tài khoản Google.");
          }
        },
      });

      // Opens the REAL Google account chooser dialog popup!
      tokenClient.requestAccessToken({ prompt: "select_account" });
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || "Không thể khởi tạo cửa sổ đăng nhập Google.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-auth-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-modal)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-shade)",
        backdropFilter: "blur(6px)",
        padding: "var(--space-md)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-pane"
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "var(--color-paper)",
          border: "var(--rule-hair) solid var(--color-rule)",
          borderRadius: "var(--radius-card)",
          padding: "var(--space-xl)",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
            <img src="/icon.svg" width={28} height={28} alt="" style={{ borderRadius: "6px" }} />
            <span style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-ink)" }}>
              CadenceLab Web
            </span>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            aria-label="Đóng cửa sổ đăng nhập"
            style={{ padding: "4px 8px", fontSize: "var(--text-sm)" }}
          >
            ✕
          </button>
        </div>

        <div>
          <h2 id="google-auth-title" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-ink)", marginBottom: "6px" }}>
            Xác thực tài khoản Google
          </h2>
          <p className="brand-sub" style={{ fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
            {contextMessage ||
              "Bản web yêu cầu đăng nhập trực tiếp bằng Google để mở khóa 4 trạm phân tích: Chẩn đoán CFI 0.5s, Dự báo SEIR-F, Khoảng trống nhu cầu và Hồ sơ 8 học phần."}
          </p>
        </div>

        {errorMessage && (
          <div
            className="error-banner"
            role="alert"
            style={{
              fontSize: "var(--text-xs)",
              padding: "10px 14px",
              background: "var(--error-tint)",
              borderRadius: "var(--radius-inner)",
              border: "var(--rule-hair) solid var(--color-error)",
              color: "var(--color-ink)",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Primary Real Google OAuth Button */}
        <button
          type="button"
          onClick={() => triggerGoogleAuth()}
          disabled={isLoading}
          className="btn-pill"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "13px 20px",
            background: "var(--color-light)",
            color: "var(--color-shade)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
            whiteSpace: "nowrap",
            cursor: isLoading ? "wait" : "pointer",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span style={{ whiteSpace: "nowrap" }}>
            {isLoading ? "Đang mở cửa sổ Google..." : "Mở cửa sổ Đăng nhập Google"}
          </span>
        </button>

        {/* Client ID Configuration Drawer */}
        {showConfigBox || !clientId ? (
          <form
            onSubmit={handleSaveCustomClientId}
            style={{
              background: "var(--surface-inner)",
              border: "var(--rule-hair) solid var(--color-rule)",
              borderRadius: "var(--radius-inner)",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label htmlFor="google-client-id-input" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-ink)" }}>
                Google OAuth Client ID
              </label>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "var(--text-xs)", color: "var(--color-accent)", textDecoration: "none" }}
              >
                Lấy ID tại đây ↗
              </a>
            </div>
            <input
              id="google-client-id-input"
              type="text"
              value={customClientIdInput}
              onChange={(e) => setCustomClientIdInput(e.target.value)}
              placeholder="Ví dụ: 123456789-abc.apps.googleusercontent.com"
              className="field-input"
              style={{ fontSize: "var(--text-xs)", padding: "8px 10px" }}
              required
            />
            <div style={{ fontSize: "11px", color: "var(--color-muted)", lineHeight: 1.4 }}>
              Cần thêm Authorized JavaScript origin: <code>{typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}</code>
            </div>
            <button
              type="submit"
              className="btn-pill"
              style={{ fontSize: "var(--text-xs)", padding: "7px 12px", alignSelf: "flex-start", whiteSpace: "nowrap" }}
            >
              Lưu và Đăng nhập Google
            </button>
          </form>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "var(--color-muted)" }}>
              ID: {clientId.slice(0, 16)}…
            </span>
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: "11px", padding: "2px 6px", whiteSpace: "nowrap" }}
              onClick={() => setShowConfigBox(true)}
            >
              Đổi Google Client ID
            </button>
          </div>
        )}

        <div
          style={{
            borderTop: "var(--rule-hair) solid var(--color-rule)",
            paddingTop: "var(--space-md)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", textAlign: "center" }}>
            Không muốn đăng nhập tài khoản?
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{ width: "100%", justifyContent: "center", textAlign: "center", whiteSpace: "nowrap" }}
            onClick={() => {
              onClose();
              onOpenDownloadModal();
            }}
          >
            Tải bản về máy
          </button>
        </div>
      </div>
    </div>
  );
}
