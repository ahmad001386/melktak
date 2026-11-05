// Readable workflow helpers for the existing, prebuilt React interface.
export function usePropertyPage(React, api, { page, setPage, tab, search, filters, branchId, refreshKey }) {
  const [state, setState] = React.useState({ data: [], total: 0, loading: true, error: "" });
  const query = new URLSearchParams({
    page: String(page), limit: "10", status: tab.toLowerCase(), search,
    property_status: filters.status, visibility: filters.visibility || "ALL",
    listing_type: filters.listingType, property_type: filters.propertyType,
    district: filters.neighborhood,
    min_price: String(filters.minPrice), max_price: String(filters.maxPrice),
    min_area: String(filters.minArea), max_area: String(filters.maxArea),
    has_parking: String(filters.hasParking), has_elevator: String(filters.hasElevator),
    has_storage: String(filters.hasStorage), has_balcony: String(filters.hasBalcony)
  });
  if (filters.bedrooms !== "ALL") query.set("bedrooms", String(filters.bedrooms));
  if (branchId && branchId !== "ALL") query.set("branch_id", branchId);
  const queryString = query.toString();
  React.useEffect(() => {
    let current = true;
    setState(previous => ({ ...previous, data: [], loading: true, error: "" }));
    api.get(`/api/v1/properties?${queryString}`).then(response => {
      if (!current) return;
      if (!response.success) throw new Error(response.error?.message || "خطا در دریافت املاک");
      const total = response.meta?.total ?? response.data.length;
      const lastPage = Math.max(1, Math.ceil(total / 10));
      if (page > lastPage) { setPage(lastPage); return; }
      setState({ data: response.data, total, loading: false, error: "" });
    }).catch(error => {
      if (current) setState({ data: [], total: 0, loading: false, error: error.message || "ارتباط با سرور برقرار نشد." });
    });
    return () => { current = false; };
  }, [queryString, refreshKey]);
  return state;
}

export function taskIsOverdue(task, now = new Date()) {
  return !["COMPLETED", "CANCELLED"].includes(task.status) && new Date(task.due_at) < now;
}

export function useInstallPrompt(React) {
  const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const [installed, setInstalled] = React.useState(() => standalone() || window.melktakAppInstalled === true);
  const [promptEvent, setPromptEvent] = React.useState(() => window.melktakInstallPrompt || null);
  React.useEffect(() => {
    const ready = () => setPromptEvent(window.melktakInstallPrompt || null);
    const done = () => { setInstalled(true); setPromptEvent(null); };
    const media = window.matchMedia("(display-mode: standalone)");
    const changed = () => setInstalled(standalone());
    window.addEventListener("melktak:installprompt", ready);
    window.addEventListener("appinstalled", done);
    media.addEventListener("change", changed);
    ready();
    return () => {
      window.removeEventListener("melktak:installprompt", ready);
      window.removeEventListener("appinstalled", done);
      media.removeEventListener("change", changed);
    };
  }, []);
  return {
    isInstalled: installed, isInstallable: !!promptEvent,
    isIOS: /iphone|ipad|ipod/i.test(navigator.userAgent),
    install: async () => {
      const event = window.melktakInstallPrompt;
      if (!event) return false;
      // Both installation buttons share one event, which can only be used once.
      window.melktakInstallPrompt = null;
      window.dispatchEvent(new Event("melktak:installprompt"));
      try {
        await event.prompt();
        return (await event.userChoice).outcome === "accepted";
      } catch { return false; }
    }
  };
}

export function createPWAInstallCard(React) {
  const h = React.createElement;
  return function PWAInstallCard() {
    const { isInstalled: installed, isInstallable, isIOS, install: requestInstall } = useInstallPrompt(React);
    const [message, setMessage] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    if (installed) return null;
    const install = async () => {
      if (busy) return;
      if (!isInstallable) {
        setMessage(isIOS
          ? "در سافاری، دکمه Share و سپس Add to Home Screen را انتخاب کنید."
          : "در Chrome و با اتصال امن، از منوی مرورگر گزینه «نصب برنامه» یا «افزودن به صفحه اصلی» را انتخاب کنید.");
        return;
      }
      setBusy(true);
      const accepted = await requestInstall();
      setMessage(accepted ? "در حال نصب برنامه…" : "نصب برنامه انجام نشد. می‌توانید دوباره از منوی مرورگر اقدام کنید.");
      setBusy(false);
    };
    return h("section", { className: "bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-4", "aria-label": "نصب اپلیکیشن" },
      h("div", { className: "flex items-center justify-between gap-3" },
        h("div", null,
          h("h4", { className: "text-xs font-extrabold", style: { color: "#000" } }, "نصب اپلیکیشن ملک تک"),
          h("p", { className: "text-[11px] text-slate-500 mt-0.5" }, "دسترسی سریع از صفحه اصلی موبایل")),
        h("button", { type: "button", onClick: install, disabled: busy,
          className: "bg-white border border-blue-200 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs hover:bg-blue-50 transition shrink-0 disabled:opacity-50",
          style: { color: "#000" }, "aria-label": "نصب اپلیکیشن ملک تک" }, busy ? "در حال نصب…" : "نصب اپلیکیشن")),
      message && h("p", { role: "status", className: "text-[11px] text-slate-600 mt-2" }, message));
  };
}

export async function getPropertyChoices(api) {
  const data = [];
  for (let page = 1; ; page++) {
    const response = await api.get(`/api/v1/properties?status=all&limit=200&page=${page}`);
    if (!response.success) return response;
    data.push(...response.data);
    if (page >= (response.meta?.total_pages || 1)) return { success: true, data };
  }
}
