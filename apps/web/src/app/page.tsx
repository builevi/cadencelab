"use client";

import React, { useEffect, useState } from "react";
import { DesktopSettings } from "../components/DesktopSettings";
import { LandingWorkspace } from "../components/LandingWorkspace";
import { SourceReportWorkspace } from "../components/SourceReportWorkspace";
import { DossierWorkspace } from "../components/DossierWorkspace";
import { CFIWorkspace } from "../components/CFIWorkspace";
import { TrendWorkspace } from "../components/TrendWorkspace";
import { GapsWorkspace } from "../components/GapsWorkspace";
import { GoogleAuthModal, UserProfile } from "../components/GoogleAuthModal";
import { DownloadModal } from "../components/DownloadModal";

const isDesktop = process.env.NEXT_PUBLIC_DESKTOP_BUILD === "1";

type WorkspaceTab = "landing" | "reports" | "cfi" | "trend" | "gaps";
type ReportMode = "channel" | "single" | "competitor" | "merge";

export default function HomePage() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceRequestKey, setSourceRequestKey] = useState("");
  const [sourceJobId, setSourceJobId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("landing");
  const [reportMode, setReportMode] = useState<ReportMode>("channel");
  const [cfiPresetKey, setCfiPresetKey] = useState<string>("paced_reel");
  const [apiOnline, setApiOnline] = useState<"checking" | "online" | "offline">(
    "checking"
  );

  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);
  const [authContextMsg, setAuthContextMsg] = useState<string | undefined>();

  const canUseWorkspace = isDesktop || Boolean(user);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("cadencelab_user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch {}

    const params = new URLSearchParams(window.location.search);
    const savedSource = params.get("source");
    if (savedSource) {
      setSourceUrl(savedSource);
      setSourceRequestKey(params.get("request") || crypto.randomUUID());
      setSourceJobId(params.get("job") || undefined);
    }
    const tabParam = params.get("tab");
    if (
      tabParam === "landing" ||
      tabParam === "reports" ||
      tabParam === "cfi" ||
      tabParam === "trend" ||
      tabParam === "gaps"
    ) {
      setActiveTab(tabParam);
    }
    const repParam = params.get("report");
    if (
      repParam === "channel" ||
      repParam === "single" ||
      repParam === "competitor" ||
      repParam === "merge"
    ) {
      setReportMode(repParam);
    }

    fetch("/api/v1/cfi/simulate?video_seconds=2", { method: "POST" })
      .then((res) => {
        setApiOnline(res.ok ? "online" : "offline");
      })
      .catch(() => {
        setApiOnline("offline");
      });
  }, []);

  function handleLoginSuccess(profile: UserProfile) {
    setUser(profile);
    try {
      localStorage.setItem("cadencelab_user", JSON.stringify(profile));
    } catch {}
  }

  function handleLogout() {
    setUser(null);
    try {
      localStorage.removeItem("cadencelab_user");
    } catch {}
    setActiveTab("landing");
    syncUrl("landing", reportMode);
  }

  function syncUrl(tab: WorkspaceTab, rep: ReportMode) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.set("report", rep);
    window.history.replaceState({}, "", url.toString());
  }

  function handleAnalyzeSource(raw: string) {
    if (!canUseWorkspace) {
      setAuthContextMsg(
        "Vui lòng đăng nhập Google để phân tích đường link trên bản Web."
      );
      setIsAuthModalOpen(true);
      return;
    }
    const source = raw.trim();
    if (!source) return;
    const key = crypto.randomUUID();
    setSourceUrl(source);
    setSourceRequestKey(key);
    setSourceJobId(undefined);
    setActiveTab("reports");
    setReportMode("channel");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "reports");
    url.searchParams.set("report", "channel");
    url.searchParams.set("source", source);
    url.searchParams.set("request", key);
    url.searchParams.delete("job");
    window.history.replaceState({}, "", url.toString());
  }

  function handleViewDemo() {
    if (!canUseWorkspace) {
      setAuthContextMsg(
        "Vui lòng đăng nhập Google để xem báo cáo mẫu trên bản Web."
      );
      setIsAuthModalOpen(true);
      return;
    }
    setSourceUrl("");
    setSourceRequestKey("");
    setSourceJobId(undefined);
    setActiveTab("reports");
    setReportMode("channel");
    const url = new URL(window.location.href);
    ["source", "request", "job"].forEach((key) => url.searchParams.delete(key));
    url.searchParams.set("tab", "reports");
    url.searchParams.set("report", "channel");
    window.history.replaceState({}, "", url.toString());
  }

  function handleSourceJobCreated(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("job", id);
    window.history.replaceState({}, "", url.toString());
  }

  function handleSelectTab(tab: WorkspaceTab, mode?: ReportMode) {
    if (!canUseWorkspace && tab !== "landing") {
      setAuthContextMsg(
        "Vui lòng đăng nhập Google để truy cập mục " +
          (tab === "reports"
            ? "Hồ sơ 8 học phần"
            : tab === "cfi"
            ? "Chẩn đoán CFI"
            : tab === "trend"
            ? "Dự báo SEIR-F"
            : "Khoảng trống nhu cầu") +
          " trên bản Web."
      );
      setIsAuthModalOpen(true);
      return;
    }
    if (tab === "reports" && mode) {
      handleViewDemo();
      setReportMode(mode);
      return;
    }
    const nextMode = mode ?? reportMode;
    if (mode) {
      setReportMode(mode);
    }
    setActiveTab(tab);
    syncUrl(tab, nextMode);
  }

  function handleSelectReportMode(mode: ReportMode) {
    setReportMode(mode);
    syncUrl(activeTab, mode);
  }

  function handleOpenCFIWithPreset(presetKey: string) {
    if (!canUseWorkspace) {
      setAuthContextMsg(
        "Vui lòng đăng nhập Google để xem chẩn đoán sóng CFI trên bản Web."
      );
      setIsAuthModalOpen(true);
      return;
    }
    setCfiPresetKey(presetKey);
    setActiveTab("cfi");
    syncUrl("cfi", reportMode);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-cluster">
            <a
              href="?tab=landing"
              className="brand-name"
              style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-xs)" }}
              onClick={(e) => {
                e.preventDefault();
                handleSelectTab("landing");
              }}
            >
              <img
                src="/icon.svg"
                width={22}
                height={22}
                alt=""
                style={{ borderRadius: "6px", display: "inline-block" }}
              />
              <span>CadenceLab</span>
            </a>
            <span className="brand-sub">
              Phòng thí nghiệm nhịp dựng và giải mã chiến lược nội dung (v0.2.0)
            </span>
          </div>

          <nav className="ruled-tabs" role="tablist" aria-label="Điều hướng không gian làm việc">
            <button
              type="button"
              role="tab"
              className="ruled-tab"
              aria-selected={activeTab === "landing"}
              onClick={() => handleSelectTab("landing")}
            >
              <span>Trang chủ</span>
            </button>

            {/* ONLY reveal workspace tabs when user is authenticated! */}
            {canUseWorkspace && (
              <>
                <button
                  type="button"
                  role="tab"
                  className="ruled-tab"
                  aria-selected={activeTab === "reports"}
                  onClick={() => handleSelectTab("reports")}
                >
                  <span>Hồ sơ 8 học phần</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  className="ruled-tab"
                  aria-selected={activeTab === "cfi"}
                  onClick={() => handleSelectTab("cfi")}
                >
                  <span>Chẩn đoán CFI</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  className="ruled-tab"
                  aria-selected={activeTab === "trend"}
                  onClick={() => handleSelectTab("trend")}
                >
                  <span>Dự báo SEIR-F</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  className="ruled-tab"
                  aria-selected={activeTab === "gaps"}
                  onClick={() => handleSelectTab("gaps")}
                >
                  <span>Khoảng trống nhu cầu</span>
                </button>
              </>
            )}
          </nav>

          <DesktopSettings />
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
            {!isDesktop && <button
              type="button"
              className="btn-ghost"
              style={{
                fontSize: "var(--text-xs)",
                padding: "4px 10px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                border: "var(--rule-hair) solid var(--color-rule)",
                whiteSpace: "nowrap",
              }}
              onClick={() => setIsDownloadModalOpen(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span style={{ whiteSpace: "nowrap" }}>Tải về máy</span>
            </button>}

            {isDesktop ? <span className="tag">Bản desktop · dữ liệu trên máy</span> : user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                <div
                  className="tag tag--periwinkle"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 8px" }}
                  title={user.email}
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt=""
                      width={18}
                      height={18}
                      style={{ borderRadius: "50%" }}
                    />
                  ) : (
                    <span className="signal-dot signal-dot--periwinkle" />
                  )}
                  <span style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.name.split(" ")[0]}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: "var(--text-xs)", padding: "4px 8px", whiteSpace: "nowrap" }}
                  onClick={handleLogout}
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-pill"
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "5px 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
                onClick={() => {
                  setAuthContextMsg(undefined);
                  setIsAuthModalOpen(true);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
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
                <span style={{ whiteSpace: "nowrap" }}>Đăng nhập Google</span>
              </button>
            )}

            <span
              className={
                apiOnline === "online"
                  ? "tag tag--periwinkle"
                  : "tag tag--apricot"
              }
            >
              <span
                className={
                  apiOnline === "online"
                    ? "signal-dot signal-dot--periwinkle"
                    : "signal-dot signal-dot--apricot"
                }
              />
              <span>
                {apiOnline === "online"
                  ? "FastAPI Engine v0.2.0 trực tuyến"
                  : apiOnline === "checking"
                  ? "Đang kiểm tra kết nối API..."
                  : isDesktop ? "Backend chưa sẵn sàng · mở lại app" : "FastAPI ngoại tuyến (Cần chạy cổng 8000)"}
              </span>
            </span>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: "var(--space-xl)" }}>
        {activeTab !== "landing" && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "var(--space-md)",
              marginBottom: "var(--space-lg)",
            }}
          >
            <div>
              <h1>
                {activeTab === "reports" &&
                  "Giải mã chiến lược kênh và kịch bản đối trọng"}
                {activeTab === "cfi" &&
                  "Tìm những đoạn video nên chỉnh nhịp"}
                {activeTab === "trend" &&
                  "Mô hình dịch tễ học chuỗi lan truyền SEIR-F"}
                {activeTab === "gaps" &&
                  "Truy xuất khoảng trống nội dung có dẫn chứng"}
              </h1>
            </div>
            <p className="brand-sub num">
              Giao diện Dusk (Slate và Bone Wells), Hallmark v2.0.0
            </p>
          </div>
        )}

        {activeTab === "landing" ? (
          <LandingWorkspace
            onNavigateTab={handleSelectTab}
            onAnalyzeSource={handleAnalyzeSource}
            onOpenCFIWithPreset={handleOpenCFIWithPreset}
            isLoggedIn={canUseWorkspace}
            isDesktop={isDesktop}
            onOpenAuthModal={(msg) => {
              setAuthContextMsg(msg);
              setIsAuthModalOpen(true);
            }}
            onOpenDownloadModal={() => setIsDownloadModalOpen(true)}
          />
        ) : !canUseWorkspace ? (
          <div style={{ textAlign: "center", padding: "var(--space-2xl) 0" }}>
            <h2>Yêu cầu đăng nhập tài khoản Google</h2>
            <p className="brand-sub" style={{ marginTop: "var(--space-xs)", marginBottom: "var(--space-md)" }}>
              Vui lòng đăng nhập Google để mở khóa không gian làm việc trên bản Web hoặc tải bản về máy.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-xs)" }}>
              <button
                type="button"
                className="btn-pill"
                onClick={() => setIsAuthModalOpen(true)}
              >
                Đăng nhập Google
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setIsDownloadModalOpen(true)}
              >
                Tải bản về máy
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "reports" && sourceUrl && sourceRequestKey && (
              <SourceReportWorkspace
                key={sourceRequestKey}
                sourceUrl={sourceUrl}
                requestKey={sourceRequestKey}
                initialJobId={sourceJobId}
                onJobCreated={handleSourceJobCreated}
                onResubmit={handleAnalyzeSource}
                onViewDemo={handleViewDemo}
              />
            )}
            {activeTab === "reports" && !sourceUrl && (
              <DossierWorkspace
                reportMode={reportMode}
                onChangeReportMode={handleSelectReportMode}
                onOpenCFIWithPreset={handleOpenCFIWithPreset}
              />
            )}

            {activeTab === "cfi" && <CFIWorkspace initialPresetKey={cfiPresetKey} />}

            {activeTab === "trend" && <TrendWorkspace />}

            {activeTab === "gaps" && <GapsWorkspace />}
          </>
        )}
      </main>

      {!isDesktop && <GoogleAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onOpenDownloadModal={() => setIsDownloadModalOpen(true)}
        contextMessage={authContextMsg}
      />}

      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />
    </div>
  );
}
