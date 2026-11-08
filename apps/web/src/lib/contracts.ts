export interface CFISlice {
  timestamp_sec: number;
  cfi_score: number;
  visual_motion: number;
  acoustic_flux: number;
  semantic_density: number;
  boredom_penalty: number;
  zone: "FLOW" | "BOREDOM_VALLEY" | "OVERLOAD";
  recommendation: string | null;
  stage: "HOOK" | "BODY";
  stimulus_load: number;
}

export interface CFISummary {
  overall_grade: string;
  grade_basis: string;
  predicted_completion_rate: number | null;
  prediction_status: string;
  pacing_score: number;
  hook_strength_3s: number | null;
  boredom_valleys_count: number;
  low_stimulus_fraction: number;
  critical_drop_points: number[];
  review_points: number[];
  overload_fraction: number;
  limitations: string;
}

export interface CFIResponse {
  mode: string;
  summary: CFISummary;
  timeline_slices: CFISlice[];
}

export interface TrendPoint {
  day: number;
  active_virality: number;
  audience_fatigue: number;
  trend_phase: "INACTIVE" | "SURGING" | "PLATEAU" | "DECLINING";
  actionable_advice: string;
  active_spreaders: number;
  growth_rate: number;
}

export interface TrendFitDiagnostics {
  observations: number;
  transmission_rate: number;
  initial_exposed: number;
  training_mae: number;
  training_log_rmse: number;
  fixed_priors: {
    population: number;
    exposure_rate: number;
    recovery_rate: number;
    fatigue_impact: number;
    fatigue_decay: number;
  };
  initial_state_assumptions: {
    recovered: number;
    fatigue: number;
    infected: string;
    exposed: string;
  };
  at_parameter_boundary: boolean;
}

export interface TrendForecastResponse {
  trend_keyword?: string;
  forecast_days?: number;
  mode: string;
  trajectory: TrendPoint[];
  fit?: TrendFitDiagnostics;
  uncertainty_status: string;
  limitations?: string;
}

export interface ContentWhitespace {
  whitespace_id: string;
  bounding_clusters: string[];
  void_center_coordinates: number[];
  market_opportunity_score: number;
  audience_demand_signal: string;
  suggested_content_angle: string;
  query: string;
  demand_count: number;
  nearest_content_similarity: number;
  supporting_sources: string[];
  evidence_status: string;
  score_basis: string;
}

export interface GapDiscoveryResponse {
  mode: string;
  embedding_model: string;
  evidence_status: string;
  corpus_size: number;
  discovered_whitespaces: ContentWhitespace[];
  limitations: string;
}

export interface DemandQueryInput {
  query: string;
  embedding: number[];
  demand_count: number;
  source_urls: string[];
}

export interface ChannelReportSample {
  id: string;
  brand_name: string;
  platform: "tiktok" | "facebook" | "instagram" | "youtube";
  brand_url: string;
  analyzed_window: string;
  posts_count: number;
  active_ads_count: number;
  quantitative: {
    followers: number;
    total_views: number;
    total_reactions: number;
    total_comments: number;
    total_shares: number;
    avg_views: number;
    avg_reactions: number;
    avg_comments: number;
    avg_shares: number;
    er_percent: number;
    posting_per_week: number;
    format_mix: { label: string; count: number; share_pct: number }[];
    cta_mix: { label: string; count: number; share_pct: number }[];
    weekday_activity: { day: string; posts: number; avg_er: number; flagged?: boolean }[];
  };
  modules_01_to_08: {
    index: string;
    key: string;
    title: string;
    meta: string;
    summary: string;
    details: { label: string; text: string }[];
  }[];
  evaluations: {
    key: string;
    label: string;
    strengths: string[];
    weaknesses: string[];
    actions: string[];
  }[];
  video_ideas: {
    title: string;
    target_pillar: string;
    hook_0_3s: string;
    pacing_note: string;
    reason: string;
  }[];
}

export interface SingleVideoReportSample {
  post_id: string;
  owner: string;
  platform: string;
  url: string;
  create_time: string;
  caption: string;
  transcript: string;
  metrics: {
    view: number;
    like: number;
    comment: number;
    share: number;
    save: number;
    download: number;
  };
  calculated: {
    er_percent: number;
    pacing_score: number;
    hook_3s_score: number;
  };
  structure: {
    core_message: string;
    target_audience: string;
    hook: { mechanics: string; psychology: string };
    body: { structure: string; triggers: string };
    cta: { mechanics: string; psychology: string };
    audience_reaction: { sentiment: string; key_topics: string };
  };
  top_comments: { author: string; text: string; likes: number; replies: number }[];
}

export const DEFAULT_CFI_PRESETS: Record<
  string,
  {
    label: string;
    description: string;
    time_step: number;
    visual_motion: number[];
    acoustic_flux: number[];
    semantic_density: number[];
  }
> = {
  paced_reel: {
    label: "Mẫu 1: Video review có 1 thung lũng nhịp dựng (5.5s - 7.0s)",
    description: "Mở đầu Hook 3s giàu chuyển động, chùng xuống ở giây 5.5 - 7.0, sau đó tăng tốc ở phần demo kết quả.",
    time_step: 0.5,
    visual_motion: [
      0.78, 0.82, 0.74, 0.68, 0.71, 0.64, 0.52, 0.48, 0.42, 0.35,
      0.24, 0.08, 0.07, 0.09, 0.11, 0.55, 0.68, 0.72, 0.64, 0.59,
      0.66, 0.74, 0.70, 0.62,
    ],
    acoustic_flux: [
      0.72, 0.76, 0.69, 0.65, 0.68, 0.60, 0.50, 0.45, 0.40, 0.32,
      0.22, 0.06, 0.05, 0.07, 0.09, 0.52, 0.65, 0.70, 0.61, 0.58,
      0.63, 0.71, 0.67, 0.60,
    ],
    semantic_density: [
      0.80, 0.84, 0.78, 0.75, 0.72, 0.68, 0.62, 0.58, 0.54, 0.48,
      0.30, 0.10, 0.08, 0.10, 0.12, 0.66, 0.74, 0.78, 0.72, 0.70,
      0.75, 0.80, 0.76, 0.72,
    ],
  },
  talking_head: {
    label: "Mẫu 2: Chuyên gia nói chuyện (Camera tĩnh, mật độ ngữ nghĩa cao)",
    description: "Minh họa cơ chế bảo vệ của CFI v0.2.0: khung hình ít chuyển động nhưng thông tin dày đặc không bị phạt nhầm là nhàm chán.",
    time_step: 0.5,
    visual_motion: [
      0.16, 0.18, 0.15, 0.17, 0.16, 0.14, 0.15, 0.17, 0.16, 0.15,
      0.14, 0.16, 0.15, 0.17, 0.16, 0.15, 0.14, 0.16, 0.15, 0.17,
    ],
    acoustic_flux: [
      0.54, 0.58, 0.52, 0.60, 0.56, 0.50, 0.55, 0.62, 0.57, 0.53,
      0.51, 0.59, 0.54, 0.61, 0.55, 0.52, 0.56, 0.60, 0.54, 0.58,
    ],
    semantic_density: [
      0.88, 0.90, 0.86, 0.92, 0.89, 0.85, 0.88, 0.91, 0.87, 0.86,
      0.84, 0.90, 0.88, 0.92, 0.89, 0.86, 0.87, 0.91, 0.88, 0.90,
    ],
  },
  sensory_overload: {
    label: "Mẫu 3: Quá tải hiệu ứng ngay trong Hook (Overload > 0.85)",
    description: "Kiểm chứng việc tách stage HOOK độc lập với zone OVERLOAD: cảnh báo khi nhồi quá nhiều chuyển động và âm thanh cùng lúc.",
    time_step: 0.5,
    visual_motion: [
      0.95, 0.96, 0.94, 0.92, 0.91, 0.89, 0.64, 0.60, 0.58, 0.55,
      0.52, 0.54, 0.56, 0.58, 0.60, 0.62,
    ],
    acoustic_flux: [
      0.92, 0.94, 0.91, 0.90, 0.88, 0.87, 0.60, 0.58, 0.55, 0.53,
      0.50, 0.52, 0.54, 0.56, 0.58, 0.60,
    ],
    semantic_density: [
      0.90, 0.92, 0.89, 0.88, 0.87, 0.86, 0.65, 0.62, 0.60, 0.58,
      0.56, 0.58, 0.60, 0.62, 0.64, 0.66,
    ],
  },
};

export const DEFAULT_TREND_PRESETS: Record<
  string,
  {
    keyword: string;
    description: string;
    daily_active_spreaders: number[];
    days: number;
    population_size: number;
  }
> = {
  surging_format: {
    keyword: "Biến hình Lookbook Công sở 15s ( Mẫu dữ liệu giai đoạn tăng trưởng )",
    description: "Chuỗi 14 ngày số lượng tài khoản đang tích cực đăng bài theo format, đang ở pha tăng trưởng nhanh (SURGING).",
    daily_active_spreaders: [
      120, 148, 185, 232, 290, 365, 455, 568, 705, 872, 1075, 1320, 1615, 1968,
    ],
    days: 10,
    population_size: 1_000_000,
  },
  saturating_meme: {
    keyword: "Nhạc nền CapCut Giật Nhịp Cũ ( Mẫu dữ liệu đã qua đỉnh )",
    description: "Chuỗi 16 ngày cho thấy tốc độ lây truyền đã chững lại và bắt đầu suy giảm do tích lũy mệt mỏi (DECLINING).",
    daily_active_spreaders: [
      1850, 2120, 2340, 2490, 2560, 2540, 2460, 2320, 2150, 1960, 1770, 1580,
      1405, 1240, 1090, 955,
    ],
    days: 10,
    population_size: 1_000_000,
  },
};

export const DEFAULT_GAP_PAYLOAD = {
  embedding_model: "text-embedding-3-small-4d-sample",
  cluster_labels: [
    "Review thành phần B5",
    "Review thành phần B5",
    "So sánh giá kem chống nắng",
    "So sánh giá kem chống nắng",
    "Vlog skincare buổi tối",
    "Vlog skincare buổi tối",
  ],
  embeddings: [
    [0.92, 0.18, 0.05, 0.02],
    [0.89, 0.22, 0.08, 0.04],
    [0.14, 0.91, 0.12, 0.05],
    [0.18, 0.88, 0.15, 0.06],
    [0.10, 0.15, 0.93, 0.08],
    [0.12, 0.19, 0.90, 0.11],
  ],
  unanswered_queries: [
    {
      query: "Cách phân biệt serum B5 thật và giả khi mua qua phiên livestream giá rẻ?",
      embedding: [0.15, 0.08, 0.12, 0.96],
      demand_count: 48,
      source_urls: [
        "https://example.com/comments/livestream-b5-thread-101",
        "https://example.com/comments/livestream-b5-thread-102",
      ],
    },
    {
      query: "Da dầu đang kích ứng thời tiết nồm ẩm có nên bôi chồng B5 lên trên kem chống nắng vật lý không?",
      embedding: [0.28, 0.24, 0.18, 0.89],
      demand_count: 31,
      source_urls: [
        "https://example.com/comments/humid-weather-routine-204",
      ],
    },
    {
      query: "Bầu 3 tháng đầu dùng được dòng kem chống nắng thuần vật lý nào không nâng tông trắng bệch?",
      embedding: [0.06, 0.32, 0.14, 0.91],
      demand_count: 19,
      source_urls: [
        "https://example.com/comments/pregnancy-sunscreen-qa-88",
      ],
    },
    {
      query: "Review chi tiết thành phần serum B5 phục hồi da (Câu hỏi đã được đối thủ phủ kín >= 0.8)",
      embedding: [0.91, 0.20, 0.06, 0.03],
      demand_count: 65,
      source_urls: [
        "https://example.com/comments/covered-b5-review",
      ],
    },
  ] satisfies DemandQueryInput[],
};

export const SAMPLE_CHANNEL_REPORT: ChannelReportSample = {
  id: "sample-channel-lumiderm",
  brand_name: "LumiDerm Vietnam (Dữ liệu mẫu kiểm thử)",
  platform: "tiktok",
  brand_url: "https://example.com/brand/lumiderm-vn",
  analyzed_window: "40 bài đăng gần nhất và 12 mẫu quảng cáo đang hoạt động",
  posts_count: 40,
  active_ads_count: 12,
  quantitative: {
    followers: 148500,
    total_views: 1920000,
    total_reactions: 98400,
    total_comments: 6240,
    total_shares: 4120,
    avg_views: 48000,
    avg_reactions: 2460,
    avg_comments: 156,
    avg_shares: 103,
    er_percent: 5.66,
    posting_per_week: 4.5,
    format_mix: [
      { label: "Video ngắn chuyên gia (Talking-head + B-roll)", count: 22, share_pct: 55 },
      { label: "Video test chất kem cận cảnh (Macro Texture)", count: 12, share_pct: 30 },
      { label: "Carousel ảnh công thức chăm sóc da", count: 6, share_pct: 15 },
    ],
    cta_mix: [
      { label: "Mua ngay tại giỏ hàng góc trái", count: 6, share_pct: 50 },
      { label: "Nhận phác đồ soi da miễn phí", count: 4, share_pct: 33 },
      { label: "Lưu video để đối chiếu bảng thành phần", count: 2, share_pct: 17 },
    ],
    weekday_activity: [
      { day: "Thứ 2", posts: 5, avg_er: 4.8 },
      { day: "Thứ 3", posts: 7, avg_er: 6.2 },
      { day: "Thứ 4", posts: 6, avg_er: 5.4 },
      { day: "Thứ 5", posts: 8, avg_er: 6.9, flagged: true },
      { day: "Thứ 6", posts: 5, avg_er: 5.1 },
      { day: "Thứ 7", posts: 4, avg_er: 4.9 },
      { day: "Chủ nhật", posts: 5, avg_er: 6.1 },
    ],
  },
  modules_01_to_08: [
    {
      index: "01",
      key: "brand_positioning",
      title: "Định vị thương hiệu",
      meta: "Clinical Dermo-Cosmetics",
      summary: "Định vị dược mỹ phẩm giải thích bằng cơ chế da liễu học thực nghiệm, tập trung vào phục hồi hàng rào bảo vệ da cho khí hậu nóng ẩm.",
      details: [
        { label: "Trục giá trị cốt lõi", text: "Minh bạch nồng độ hoạt chất, có bảng đối chiếu độ pH và thử nghiệm độ thấm trên da dầu." },
        { label: "Khoảng cách với thị trường", text: "Tránh ngôn từ hứa hẹn trắng cấp tốc; nhấn mạnh thời gian tái tạo sinh học 28 ngày." },
      ],
    },
    {
      index: "02",
      key: "tone_of_voice",
      title: "Giọng nói thương hiệu",
      meta: "Điềm tĩnh, chuẩn xác, dẫn chứng số liệu",
      summary: "Sử dụng câu ngắn, nêu thẳng tên hoạt chất và phần trăm nồng độ ngay trong 3 giây đầu tiên thay vì mở đầu chào hỏi chung chung.",
      details: [
        { label: "Từ vựng đặc trưng", text: "Màng lipid, mất nước xuyên biểu bì (TEWL), nồng độ Panthenol 5%, kích ứng chéo." },
        { label: "Nhịp điệu lời thoại", text: "Trung bình 145 từ/phút ở 3 giây đầu, giảm xuống 125 từ/phút khi giải thích bảng thành phần." },
      ],
    },
    {
      index: "03",
      key: "target_audience",
      title: "Khách hàng mục tiêu",
      meta: "Nữ 22 - 34 tuổi, dân văn phòng",
      summary: "Nhóm khách hàng đã từng dùng treatment mạnh (Retinol, BHA) bị mỏng đỏ hoặc lên mụn ẩn do chọn sai kem dưỡng khóa ẩm.",
      details: [
        { label: "Nỗi đau lặp lại trong bình luận", text: "Sợ bôi B5 bị bí da, sợ mua phải hàng xách tay pha trộn trên livestream giảm giá sâu." },
        { label: "Hành vi ra quyết định", text: "Đọc kỹ bình luận có ảnh chụp thật và tìm video hướng dẫn thứ tự bôi sáng - tối." },
      ],
    },
    {
      index: "04",
      key: "posting_and_trends",
      title: "Hoạt động và xu hướng",
      meta: "4.5 bài/tuần, khung 20:00 - 21:30",
      summary: "Tập trung đăng vào tối Thứ 3, Thứ 5 và Chủ nhật; hiệu suất tương tác đạt đỉnh khi kết hợp cảnh soi da kính hiển vi.",
      details: [
        { label: "Thói quen vận hành", text: "Duy trì 3 video giáo dục thành phần trước mỗi phiên Mega Livestream cuối tuần." },
        { label: "Tín hiệu SEIR-F", text: "Định dạng soi kẽm oxit dưới đèn UV đang ở pha SURGING, trong khi trend đập hộp ASMR đã sang pha DECLINING." },
      ],
    },
    {
      index: "05",
      key: "content_pillars",
      title: "Tuyến nội dung chủ lực",
      meta: "3 tuyến nội dung",
      summary: "Ba tuyến nội dung chiếm 100% sản lượng bài đăng trong mẫu khảo sát, trong đó tuyến Giải phẫu Thành phần mang lại tỷ lệ lưu cao nhất.",
      details: [
        { label: "Tuyến 1: Giải phẫu bảng thành phần (45% bài đăng)", text: "ER trung bình 6.8%: Đọc vị công thức, chỉ ra chất dễ gây bít tắc lỗ chân lông." },
        { label: "Tuyến 2: Sửa lỗi quy trình skincare (35% bài đăng)", text: "ER trung bình 5.4%: Phản biện các thói quen bôi quá nhiều lớp gây trượt nền." },
        { label: "Tuyến 3: Nhật ký phục hồi 14 ngày (20% bài đăng)", text: "ER trung bình 4.1%: Theo dõi tiến trình giảm đỏ nhưng dễ bị rớt nhịp ở giây thứ 6." },
      ],
    },
    {
      index: "06",
      key: "content_structure_analysis",
      title: "Công thức nội dung văn bản",
      meta: "3 cấu trúc copywriting",
      summary: "Sử dụng công thức Myth-Busting (Bác bỏ hiểu lầm) cho bài kéo tương tác và PAS (Problem - Agitate - Solve) cho bài gắn giỏ hàng.",
      details: [
        { label: "Công thức 1: Bác bỏ sai lầm phổ biến", text: "Mở đầu bằng một thói quen sai (80% người da dầu đang mắc), sau đó đưa cơ chế khoa học." },
        { label: "Công thức 2: Checklist 3 tiêu chí chọn sản phẩm", text: "Tối ưu cho hành vi bấm Lưu (Save) để xem lại khi đi mua hàng." },
      ],
    },
    {
      index: "07",
      key: "reel_and_cfi_diagnostics",
      title: "Công thức video ngắn và chẩn đoán CFI",
      meta: "Tích hợp CFI Pacing 0.5s",
      summary: "Vượt qua phân tích lời thoại đơn thuần: đối chiếu trực tiếp cấu trúc Hook - Story - CTA với chỉ số biến thiên hình ảnh và âm thanh.",
      details: [
        { label: "Kỹ thuật Hook (0.0s - 3.0s)", text: "Điểm CFI trung bình đạt 0.74 nhờ cắt cảnh cận chất kem kèm câu hỏi định danh tình trạng da." },
        { label: "Điểm nghẽn nhịp dựng (5.5s - 7.5s)", text: "Phát hiện thung lũng kích thích (BOREDOM_VALLEY) khi giữ nguyên 1 góc máy giơ lọ sản phẩm quá 2 giây mà không có text minh họa." },
      ],
    },
    {
      index: "08",
      key: "ad_strategy",
      title: "Hoạt động quảng cáo (Ads Library)",
      meta: "12 mẫu quảng cáo đang chạy",
      summary: "Chạy song song 8 video chuyển đổi trực tiếp (Direct Conversion) và 4 video thu phễu tin nhắn tư vấn da liễu.",
      details: [
        { label: "Góc tiếp cận quảng cáo (Ad Angles)", text: "Nhấn mạnh cam kết hoàn tiền nếu kích ứng trong 7 ngày và bộ quà tặng sample du lịch." },
        { label: "Điểm hổng trong phễu quảng cáo", text: "Chưa có video quảng cáo nào giải đáp cách phân biệt hàng chính hãng trên livestream (48 tín hiệu hỏi trong bình luận)." },
      ],
    },
  ],
  evaluations: [
    {
      key: "pillar_eval",
      label: "Đánh giá tuyến nội dung",
      strengths: [
        "Tuyến Giải phẫu thành phần có mật độ ngữ nghĩa cao, giữ điểm CFI ổn định trên 0.62.",
        "Tỷ lệ lượt Lưu (Save) trên lượt Xem đạt 3.4%, tạo tín hiệu phân phối tự nhiên tốt.",
      ],
      weaknesses: [
        "Tuyến Nhật ký 14 ngày thiếu biến thiên hình ảnh ở đoạn giữa (5.5s - 8.0s).",
        "Chưa khai thác chủ đề phân biệt hàng thật giả dù khán giả hỏi lặp lại 48 lần.",
      ],
      actions: [
        "Bổ sung lớp cắt B-roll test độ thấm mỗi 2.5 giây cho tuyến Nhật ký phục hồi.",
        "Sản xuất ngay 2 video giải đáp câu hỏi phân biệt tem chống giả từ bảng Content Gaps.",
      ],
    },
    {
      key: "formula_eval",
      label: "Đánh giá công thức dựng và viết",
      strengths: [
        "Hook 3 giây đầu đi thẳng vào vấn đề, không mất thời gian giới thiệu tên kênh.",
        "Lời thoại súc tích, dễ đọc phụ đề ngay cả khi người xem tắt tiếng.",
      ],
      weaknesses: [
        "Đoạn chuyển từ giải thích cơ chế sang giới thiệu sản phẩm còn rời rạc, dễ tạo cảm giác quảng cáo đột ngột.",
      ],
      actions: [
        "Áp dụng cấu trúc so sánh trực quan trên 2 nửa khuôn mặt hoặc 2 bề mặt thử nghiệm trước khi đọc CTA.",
      ],
    },
    {
      key: "funnel_eval",
      label: "Đánh giá phễu chuyển đổi",
      strengths: [
        "Kết hợp đồng bộ giữa bài đăng tự nhiên (Organic) và bài chạy quảng cáo Spark Ads.",
      ],
      weaknesses: [
        "Thiếu nội dung trung gian xử lý nỗi sợ kích ứng cho nhóm bà bầu và da nhạy cảm thời tiết nồm ẩm.",
      ],
      actions: [
        "Tạo danh sách phát (Playlist) riêng cho từng tình trạng da và ghim bình luận dẫn link kiểm tra mã lô hàng.",
      ],
    },
  ],
  video_ideas: [
    {
      title: "3 dấu hiệu nhận biết ngay serum B5 chính hãng dưới đèn flash điện thoại",
      target_pillar: "Khoảng trống nhu cầu số 1 (48 tín hiệu hỏi)",
      hook_0_3s: "Cận cảnh 2 giọt serum chảy trên mặt kính đen kèm câu hỏi: Đừng bôi lên mặt nếu giọt B5 của bạn tách nước như bên trái.",
      pacing_note: "Giữ nhịp cắt 1.5s/cảnh ở 3s đầu (CFI mục tiêu ~ 0.72), chèn bảng so sánh đáy chai ở giây thứ 6.0 để triệt tiêu thung lũng nhàm chán.",
      reason: "Giải quyết trực tiếp câu hỏi có điểm ưu tiên cao nhất (0.487) mà đối thủ chưa có bài phủ.",
    },
    {
      title: "Quy trình 2 lớp mỏng cho da dầu ngày nồm ẩm: B5 trước hay kem chống nắng vật lý trước?",
      target_pillar: "Khoảng trống nhu cầu số 2 (31 tín hiệu hỏi)",
      hook_0_3s: "Quay cận cảnh lớp kem chống nắng bị vón cục trên vùng cánh mũi: Lý do kem chống nắng của bạn bị trượt ngay khi ra đường.",
      pacing_note: "Sử dụng đồng hồ bấm giờ 60 giây chờ ráo màng trước khi thoa lớp tiếp theo.",
      reason: "Đánh trúng nhu cầu theo mùa với độ phủ hiện tại trong mẫu mới chỉ đạt 0.44.",
    },
  ],
};

export const SAMPLE_SINGLE_VIDEO: SingleVideoReportSample = {
  post_id: "7429183049182",
  owner: "lumiderm.official",
  platform: "TikTok",
  url: "https://example.com/tiktok/video/7429183049182",
  create_time: "2026-10-28 20:15",
  caption: "Tại sao bôi serum B5 mà da vẫn đổ dầu và lên mụn ẩn? Xem kỹ 3 giây thử nghiệm độ thấm này trước khi đổi sang lọ mới.",
  transcript:
    "Nếu bạn bôi B5 mà mặt vẫn bóng nhẫy như chảo dầu, nguyên nhân không nằm ở Vitamin B5 mà nằm ở nền dung môi đặc. Hãy nhìn thử nghiệm trên giấy thấm dầu sau 30 giây: bên trái để lại quầng ẩm nặng, còn công thức vi nhũ tương bên phải thấm khô hoàn toàn. Khi chọn B5 cho da dầu mụn, hãy kiểm tra ngay 2 dòng đầu của bảng thành phần và chỉ dùng đúng 3 giọt trên nền da còn ẩm nhẹ.",
  metrics: {
    view: 184200,
    like: 11420,
    comment: 486,
    share: 912,
    save: 3890,
    download: 215,
  },
  calculated: {
    er_percent: 9.07,
    pacing_score: 0.584,
    hook_3s_score: 0.742,
  },
  structure: {
    core_message: "Da dầu bị bí khi dùng B5 là do nền dung môi quá đặc chứ không phải do bản thân hoạt chất Panthenol; cần chọn kết cấu vi nhũ tương.",
    target_audience: "Người có làn da dầu, hỗn hợp thiên dầu đang gặp tình trạng bôi dưỡng ẩm bị lên mụn ẩn.",
    hook: {
      mechanics: "Đặt câu hỏi trực diện vào nghịch lý người xem đang gặp kèm cảnh đối chiếu 2 giọt dung dịch trên giấy thấm.",
      psychology: "Kích hoạt hiệu ứng giải tỏa tội lỗi (không phải do da bạn xấu mà do chọn sai nền dung môi).",
    },
    body: {
      structure: "So sánh thực nghiệm (03s - 08s) tiếp nối bằng quy tắc đọc bảng thành phần và định lượng 3 giọt (08s - 12s).",
      triggers: "Bằng chứng thị giác (Visual Proof) qua độ loang trên giấy thấm giúp người xem tin tưởng ngay lập tức.",
    },
    cta: {
      mechanics: "Kêu gọi lưu video để đối chiếu bảng thành phần và bấm vào giỏ hàng xem bản dung môi nhẹ.",
      psychology: "Hành động chi phí thấp (Lưu lại dùng sau) kết hợp neo giải pháp an toàn.",
    },
    audience_reaction: {
      sentiment: "Tích cực và tò mò cao; nhiều bình luận hỏi cách kiểm tra hàng thật giả và cách kết hợp với kem chống nắng.",
      key_topics: "Phân biệt hàng thật giả trên livestream (48 lượt), thứ tự bôi với kem chống nắng vật lý (31 lượt).",
    },
  },
  top_comments: [
    {
      author: "minhanh.skin",
      text: "Chị ơi làm sao phân biệt bản vi nhũ tương thật giả khi mua trên live vậy ạ?",
      likes: 142,
      replies: 19,
    },
    {
      author: "linh_nguyen99",
      text: "Trời nồm ẩm bôi em này xong đè kem chống nắng vật lý lên có bị vón cục không shop?",
      likes: 87,
      replies: 12,
    },
    {
      author: "hoang_vy24",
      text: "Đoạn giấy thấm nhìn thuyết phục thật sự, trước giờ cứ tưởng da mình không hợp B5.",
      likes: 64,
      replies: 5,
    },
  ],
};
