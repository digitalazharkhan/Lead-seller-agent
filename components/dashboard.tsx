"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Command,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sun,
  Target,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  dashboardStats,
  revenueSeries,
  sampleProjects,
  sampleTransactions,
  trafficSources,
  weeklySales,
} from "@/lib/data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Prospect = {
  id: number;
  name: string;
  category: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  hasWebsite: boolean | null;
  score: number;
  status: "new" | "contacted" | "replied" | "opted-out" | "client";
  reviews: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

const statusLabels: Record<Prospect["status"], string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  "opted-out": "Opted out",
  client: "Client",
};

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "prospects", label: "Prospects", icon: UsersRound },
  { id: "analytics", label: "Analytics", icon: Activity },
  { id: "workflows", label: "Workflows", icon: Target },
];

const currencyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 72, damping: 20, mass: 0.8 });
  const displayed = useTransform(spring, (latest) => format(latest));

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  return <motion.span>{displayed}</motion.span>;
}

function Sparkline({ data, color }: { data: { value: number }[]; color: string }) {
  return (
    <div className="h-10 w-[88px]" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.8} fill={`url(#spark-${color.replace("#", "")})`} isAnimationActive animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ stat, index }: { stat: (typeof dashboardStats)[number]; index: number }) {
  const reduceMotion = useReducedMotion();
  const icons = [Wallet, UsersRound, Target, Activity];
  const Icon = icons[index];

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: reduceMotion ? 0 : 16 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.42, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] } },
      }}
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.015, transition: { type: "spring", stiffness: 280, damping: 22 } }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      className="h-full"
    >
      <Card className="group relative h-full overflow-hidden transition-shadow duration-300 hover:shadow-[0_20px_60px_rgba(0,0,0,.24)]">
        <div className="pointer-events-none absolute -right-7 -top-8 size-28 rounded-full border border-white/[0.035] transition-transform duration-500 group-hover:scale-125" />
        <CardContent className="relative flex min-h-[154px] flex-col justify-between p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="grid size-8 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.035]" style={{ color: stat.color }}>
                <Icon size={15} strokeWidth={1.8} />
              </span>
              {stat.label}
            </div>
            <Badge className="border-violet-400/20 bg-violet-400/[0.08] text-violet-300">DEMO</Badge>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[26px] font-semibold tracking-[-0.045em] text-foreground tabular-nums">
                <CountUp value={stat.value} format={stat.display} />
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px]">
                {stat.direction === "up" ? <ArrowUpRight size={13} className="text-emerald-400" /> : <ArrowDownRight size={13} className="text-rose-400" />}
                <span className={stat.direction === "up" ? "text-emerald-400" : "text-rose-400"}>{stat.change}</span>
                <span className="text-muted-foreground">vs. prior period</span>
              </div>
            </div>
            <Sparkline data={stat.spark} color={stat.color} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ThemeControl() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => setMounted(true), []);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={mounted && resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={mounted && resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="size-9 rounded-xl border border-border/80 bg-card/70"
      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
    >
      {mounted && resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );
}

function Sidebar({
  activeSection,
  onNavigate,
  onClose,
  mobileOpen,
  collapsed,
  onCollapsedChange,
}: {
  activeSection: string;
  onNavigate: (section: string) => void;
  onClose: () => void;
  mobileOpen: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const itemVariants = {
    hidden: { opacity: 0, x: reduceMotion ? 0 : -8 },
    visible: (index: number) => ({ opacity: 1, x: 0, transition: { delay: reduceMotion ? 0 : 0.06 * index, duration: 0.24 } }),
  };

  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <motion.button
            aria-label="Close navigation menu"
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      <motion.aside
        animate={{ width: collapsed ? 82 : 256 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 250, damping: 28 }}
        className={`sidebar-shell fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/80 bg-card/90 px-3 py-4 backdrop-blur-2xl md:translate-x-0 ${mobileOpen ? "sidebar-mobile-open" : ""}`}
      >
        <Button variant="ghost" size="icon" className="absolute right-3 top-5 size-8 md:hidden" aria-label="Close navigation" onClick={onClose}><X size={16} /></Button>
        <div className={`flex h-12 items-center ${collapsed ? "justify-center" : "justify-between"} px-2`}>
          <a href="#overview" className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="AI Khan dashboard home" onClick={() => onNavigate("overview")}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-blue-500 text-white shadow-lg shadow-violet-500/20">
              <Command size={19} strokeWidth={2.2} />
            </span>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span className="overflow-hidden whitespace-nowrap" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}>
                  <span className="block text-sm font-semibold tracking-tight">AI Khan</span>
                  <span className="block text-[9px] font-semibold tracking-[.17em] text-muted-foreground">LEAD WORKSPACE</span>
                </motion.span>
              )}
            </AnimatePresence>
          </a>
          {!collapsed && (
            <Button variant="ghost" size="icon" className="hidden size-8 md:inline-flex" aria-label="Collapse sidebar" onClick={() => onCollapsedChange(true)}>
              <ChevronRight className="rotate-180" size={16} />
            </Button>
          )}
        </div>

        <div className={`mt-9 px-3 text-[9px] font-semibold tracking-[.16em] text-muted-foreground/70 ${collapsed ? "sr-only" : ""}`}>WORKSPACE</div>
        <motion.nav initial="hidden" animate="visible" className="mt-2 grid gap-1.5" aria-label="Dashboard sections">
          {navigation.map((item, index) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <motion.a
                key={item.id}
                custom={index}
                variants={itemVariants}
                href={`#${item.id}`}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`nav-item relative flex h-10 items-center gap-3 overflow-hidden rounded-xl px-3 text-[12px] font-medium outline-none transition-colors hover:bg-accent/55 focus-visible:ring-2 focus-visible:ring-ring ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"} ${collapsed ? "justify-center px-0" : ""}`}
              >
                {active && <motion.span layoutId="active-nav-highlight" className="absolute inset-0 rounded-xl border border-violet-400/15 bg-gradient-to-r from-violet-500/[0.15] to-blue-500/[0.06]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                <Icon className={`relative z-10 shrink-0 transition-transform duration-200 ${active ? "text-violet-300" : ""}`} size={17} />
                {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
                {active && <span className="absolute bottom-2 left-0 top-2 w-[2px] rounded-r bg-violet-300" />}
              </motion.a>
            );
          })}
        </motion.nav>

        <div className="mt-8 border-t border-border/70 pt-5">
          {!collapsed && <div className="px-3 text-[9px] font-semibold tracking-[.16em] text-muted-foreground/70">SIMULATED</div>}
          <div className="mt-2 rounded-xl border border-border/70 bg-background/55 p-3">
            <div className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-amber-400/10 text-amber-300"><Target size={14} /></span>
              {!collapsed && <div className="min-w-0"><p className="truncate text-[10px] font-medium">Lead workflows</p><p className="mt-0.5 truncate text-[9px] text-muted-foreground">Discovery & outreach off</p></div>}
            </div>
          </div>
        </div>

        <div className="mt-auto border-t border-border/70 pt-3">
          {!collapsed && <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar className="size-9 border border-violet-300/20"><AvatarFallback className="bg-gradient-to-br from-violet-500/25 to-blue-500/20 text-violet-200">AK</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">Workspace owner</p><p className="truncate text-[10px] text-muted-foreground">Local account</p></div>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label="Open profile menu"><MoreHorizontal size={16} /></Button></DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" side="top" sideOffset={8} className="dropdown-content z-[70] min-w-48 rounded-xl border border-border bg-card p-1.5 shadow-2xl">
                  <DropdownMenu.Label className="px-2 py-2 text-[10px] text-muted-foreground">Local workspace</DropdownMenu.Label>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  <DropdownMenu.Item className="dropdown-item"><Settings2 size={14} /> Workspace settings</DropdownMenu.Item>
                  <DropdownMenu.Item className="dropdown-item"><CircleHelp size={14} /> Help & shortcuts</DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  <DropdownMenu.Item className="dropdown-item text-rose-300"><LogOut size={14} /> Sign out unavailable</DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>}
          {collapsed && <Button variant="ghost" size="icon" className="mx-auto flex size-9" aria-label="Expand sidebar" onClick={() => onCollapsedChange(false)}><ChevronRight size={16} /></Button>}
          {collapsed && <div className="mt-2 flex justify-center"><DropdownMenu.Root><DropdownMenu.Trigger asChild><Button variant="ghost" size="icon" className="size-9" aria-label="Open profile menu"><Avatar className="size-8"><AvatarFallback className="bg-violet-500/20 text-[10px] text-violet-200">AK</AvatarFallback></Avatar></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" side="right" sideOffset={8} className="dropdown-content z-[70] min-w-48 rounded-xl border border-border bg-card p-1.5 shadow-2xl"><DropdownMenu.Label className="px-2 py-2 text-[10px] text-muted-foreground">Local workspace</DropdownMenu.Label><DropdownMenu.Separator className="my-1 h-px bg-border" /><DropdownMenu.Item className="dropdown-item"><Settings2 size={14} /> Workspace settings</DropdownMenu.Item><DropdownMenu.Item className="dropdown-item"><CircleHelp size={14} /> Help & shortcuts</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div>}
          {!collapsed && <p className="px-2 text-[9px] leading-4 text-muted-foreground/70">SQLite connected · integrations disabled</p>}
        </div>
        <button className="sr-only" onClick={onClose}>Close sidebar</button>
      </motion.aside>
    </>
  );
}

function TopBar({
  activeSection,
  onSearch,
  onOpenMenu,
}: {
  activeSection: string;
  onSearch: (value: string) => void;
  onOpenMenu: () => void;
}) {
  const [searchValue, setSearchValue] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const breadcrumb = navigation.find((item) => item.id === activeSection)?.label ?? "Overview";

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function updateSearch(value: string) {
    setSearchValue(value);
    onSearch(value);
    if (value) document.getElementById("prospects")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[70px] max-w-[1600px] items-center gap-3">
        <Button variant="outline" size="icon" className="size-9 shrink-0 md:hidden" aria-label="Open navigation" onClick={onOpenMenu}><Menu size={17} /></Button>
        <div className="hidden min-w-0 items-center gap-2 text-xs sm:flex">
          <span className="text-muted-foreground">Workspace</span><ChevronRight size={13} className="text-muted-foreground/50" />
          <AnimatePresence mode="wait" initial={false}><motion.span key={breadcrumb} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="font-medium text-foreground">{breadcrumb}</motion.span></AnimatePresence>
        </div>
        <div className="flex-1" />
        <motion.label
          layout
          animate={{ width: searchFocused ? "min(360px, 48vw)" : "min(280px, 34vw)" }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 30 }}
          className="search-box flex h-9 min-w-0 max-w-[360px] flex-1 items-center gap-2 rounded-xl border border-border/80 bg-card/75 px-3 text-muted-foreground transition-colors focus-within:border-violet-400/50 focus-within:bg-card sm:flex-none"
        >
          <Search size={15} className="shrink-0" />
          <input
            ref={searchInputRef}
            value={searchValue}
            onChange={(event) => updateSearch(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search prospects…"
            aria-label="Search prospects"
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="hidden rounded border border-border px-1 py-0.5 text-[9px] sm:inline">⌘ K</kbd>
        </motion.label>
        <Popover.Root open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <Popover.Trigger asChild>
            <Button variant="outline" size="icon" className="relative size-9 shrink-0 rounded-xl" aria-label="Notifications, 2 updates">
              <Bell size={16} /><span className="absolute right-[7px] top-[7px] size-1.5 rounded-full bg-violet-400 ring-2 ring-card" />
            </Button>
          </Popover.Trigger>
          <Popover.Portal forceMount>
            <AnimatePresence>
              {notificationsOpen && (
                <Popover.Content forceMount asChild align="end" sideOffset={10} onOpenAutoFocus={(event) => event.preventDefault()}>
                  <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5, scale: 0.97 }} transition={{ type: "spring", stiffness: 380, damping: 28 }} className="z-[70] w-[min(340px,calc(100vw-24px))] rounded-2xl border border-border bg-card p-4 shadow-2xl">
                    <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Notifications</p><p className="mt-1 text-[10px] text-muted-foreground">Local workspace updates</p></div><Badge className="border-violet-400/20 bg-violet-400/10 text-violet-300">2 new</Badge></div>
                    <div className="mt-3 grid gap-2">
                      <div className="flex gap-3 rounded-xl bg-muted/50 p-3"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300"><Check size={14} /></span><div><p className="text-xs font-medium">SQLite workspace ready</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Saved prospects are loaded from the local API.</p></div></div>
                      <div className="flex gap-3 rounded-xl bg-muted/50 p-3"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-amber-400/10 text-amber-300"><Target size={14} /></span><div><p className="text-xs font-medium">Automations are simulated</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">No discovery, campaigns, email, or hosting is connected.</p></div></div>
                    </div>
                    <Popover.Arrow className="fill-border" />
                  </motion.div>
                </Popover.Content>
              )}
            </AnimatePresence>
          </Popover.Portal>
        </Popover.Root>
        <ThemeControl />
      </div>
    </header>
  );
}

function DashboardChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 px-3 py-2.5 shadow-xl backdrop-blur-xl">
      <p className="mb-2 text-[10px] text-muted-foreground">{label}</p>
      {payload.map((item) => <p key={item.name} className="flex items-center gap-2 text-xs font-medium"><span className="size-1.5 rounded-full" style={{ background: item.color }} />{item.name}: {currencyFormat.format(item.value)}</p>)}
    </div>
  );
}

function ProspectsTable({
  prospects,
  loading,
  error,
  search,
  statusFilter,
  onStatusFilter,
  onStatusChange,
  updatingId,
  onExport,
}: {
  prospects: Prospect[];
  loading: boolean;
  error: string;
  search: string;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  onStatusChange: (id: number, status: Prospect["status"]) => void;
  updatingId: number | null;
  onExport: () => void;
}) {
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return prospects.filter((prospect) => {
      const matchesQuery = !query || [prospect.name, prospect.category, prospect.city, prospect.email, prospect.phone].join(" ").toLocaleLowerCase().includes(query);
      return matchesQuery && (statusFilter === "all" || prospect.status === statusFilter);
    });
  }, [prospects, search, statusFilter]);

  return (
    <Card id="prospects" className="scroll-mt-24 overflow-hidden">
      <CardHeader className="pb-4">
        <div><div className="flex items-center gap-2"><CardTitle>Saved prospects</CardTitle><Badge className="border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">LIVE · SQLITE</Badge></div><CardDescription className="mt-1.5">Your local records and current pipeline status.</CardDescription></div>
        <Button variant="outline" size="sm" onClick={onExport} disabled={loading || Boolean(error)} aria-label={`Export ${filtered.length} visible prospects as CSV`}><Download size={14} /> Export CSV</Button>
      </CardHeader>
      <div className="flex flex-col gap-2 px-5 pb-4 sm:flex-row">
        <div className="relative flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background/70 px-3 text-xs text-muted-foreground"><Search size={14} className="shrink-0" />{search || "Search prospects from the top bar"}</div>
        <label className="sr-only" htmlFor="dashboard-status-filter">Filter by status</label>
        <select id="dashboard-status-filter" value={statusFilter} onChange={(event) => onStatusFilter(event.target.value)} className="h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="all">All statuses</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {error && <div role="alert" className="mx-5 mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-3 py-2.5 text-xs text-rose-300">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead><tr className="border-y border-border/80 bg-muted/25 text-[9px] font-semibold uppercase tracking-[.12em] text-muted-foreground"><th className="px-5 py-3">Business</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Updated</th></tr></thead>
          <tbody>
            {loading && Array.from({ length: 4 }, (_, index) => <tr key={`skeleton-${index}`} className="border-b border-border/60"><td className="px-5 py-4"><div className="flex items-center gap-3"><Skeleton className="size-8 rounded-full" /><Skeleton className="h-3 w-32" /></div></td><td className="px-4 py-4"><Skeleton className="h-3 w-20" /></td><td className="px-4 py-4"><Skeleton className="h-3 w-24" /></td><td className="px-4 py-4"><Skeleton className="h-3 w-10" /></td><td className="px-4 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td><td className="px-4 py-4"><Skeleton className="ml-auto h-3 w-16" /></td></tr>)}
            {!loading && !error && filtered.map((prospect) => (
              <tr key={prospect.id} className="group border-b border-border/60 transition-colors hover:bg-muted/35 last:border-0">
                <td className="px-5 py-3.5"><div className="flex items-center gap-3"><Avatar className="size-8 rounded-xl"><AvatarFallback className="rounded-xl bg-violet-400/10 text-[10px] text-violet-200">{prospect.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><div className="flex items-center gap-1.5"><span className="max-w-[190px] truncate text-xs font-medium">{prospect.name}</span>{prospect.isDemo && <Badge className="border-amber-400/20 bg-amber-400/[0.08] px-1.5 py-0.5 text-[8px] text-amber-300">DEMO</Badge>}</div><span className="block max-w-[190px] truncate text-[10px] text-muted-foreground">{prospect.email || prospect.phone || "No contact details"}</span></div></div></td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{prospect.category}</td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{prospect.city}</td>
                <td className="px-4 py-3.5"><div className="flex items-center gap-2"><div className="h-1 w-14 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${prospect.score}%` }} transition={{ duration: 0.7 }} className="h-full rounded-full bg-gradient-to-r from-violet-400 to-blue-400" /></div><span className="text-[10px] tabular-nums text-muted-foreground">{prospect.score}</span></div></td>
                <td className="px-4 py-3.5"><label className="sr-only" htmlFor={`status-${prospect.id}`}>Status for {prospect.name}</label><select id={`status-${prospect.id}`} value={prospect.status} disabled={updatingId === prospect.id} onChange={(event) => onStatusChange(prospect.id, event.target.value as Prospect["status"])} className={`status-select status-${prospect.status} h-7 max-w-[130px] rounded-full border border-current/20 px-2 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50`}><option value="new">New</option><option value="contacted">Contacted</option><option value="replied">Replied</option><option value="opted-out">Opted out</option><option value="client">Client</option></select></td>
                <td className="px-4 py-3.5 text-right text-[10px] text-muted-foreground">{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(prospect.updatedAt))}</td>
              </tr>
            ))}
            {!loading && !error && filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center"><div className="text-sm font-medium">No matching prospects</div><p className="mt-1 text-xs text-muted-foreground">Try another search or change the status filter.</p></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border/70 px-5 py-3 text-[10px] text-muted-foreground"><span aria-live="polite">Showing {filtered.length} of {prospects.length} prospects</span><span>Changes save to SQLite</span></div>
    </Card>
  );
}

export function Dashboard() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [statusError, setStatusError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const controller = new AbortController();
    async function loadProspects() {
      try {
        const response = await fetch("/api/prospects", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(`The local prospects API returned ${response.status}.`);
        const records = await response.json() as Prospect[];
        if (!Array.isArray(records)) throw new Error("The local prospects API returned an invalid record list.");
        setProspects(records);
        setError("");
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load prospects from the local API.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadProspects();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const sections = navigation.map((item) => document.getElementById(item.id)).filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.2, 0.5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  async function updateStatus(id: number, status: Prospect["status"]) {
    setUpdatingId(id);
    setStatusError("");
    try {
      const response = await fetch(`/api/prospects/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Could not update status (${response.status}).`);
      setProspects((current) => current.map((prospect) => prospect.id === id ? payload as Prospect : prospect));
    } catch (updateError) {
      setStatusError(updateError instanceof Error ? updateError.message : "Could not update prospect status.");
    } finally {
      setUpdatingId(null);
    }
  }

  function exportCsv() {
    const query = search.trim().toLocaleLowerCase();
    const rows = prospects.filter((prospect) => {
      const matchesSearch = !query || [prospect.name, prospect.category, prospect.city, prospect.email, prospect.phone].join(" ").toLocaleLowerCase().includes(query);
      return matchesSearch && (statusFilter === "all" || prospect.status === statusFilter);
    });
    const columns: [keyof Prospect, string][] = [
      ["id", "ID"], ["name", "Business name"], ["category", "Category"], ["city", "City"],
      ["phone", "Phone"], ["email", "Email"], ["website", "Website URL"], ["hasWebsite", "Has website"],
      ["score", "Lead score"], ["status", "Status"], ["reviews", "Review count"], ["isDemo", "Demo record"],
      ["createdAt", "Created at"], ["updatedAt", "Updated at"],
    ];
    const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [columns.map(([, label]) => cell(label)).join(","), ...rows.map((row) => columns.map(([key]) => cell(row[key])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    const today = new Date();
    const localDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
    link.download = `prospects-export-${localDate}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatusError(`Exported ${rows.length} ${rows.length === 1 ? "prospect" : "prospects"} to CSV.`);
  }

  const sectionTitle = navigation.find((item) => item.id === activeSection)?.label ?? "Overview";
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.08, delayChildren: reduceMotion ? 0 : 0.05 } },
  };
  const sectionVariants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
  };

  return (
    <div className="min-h-screen">
      <Sidebar activeSection={activeSection} onNavigate={setActiveSection} onClose={() => setMobileOpen(false)} mobileOpen={mobileOpen} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      <div className={`min-h-screen transition-[padding] duration-300 ${sidebarCollapsed ? "md:pl-[82px]" : "md:pl-64"}`}>
        <TopBar activeSection={activeSection} onSearch={setSearch} onOpenMenu={() => setMobileOpen(true)} />
        <motion.main id="overview" variants={containerVariants} initial="hidden" animate="visible" className="mx-auto w-full max-w-[1600px] space-y-6 px-4 pb-12 pt-7 sm:px-6 lg:px-8">
          <motion.section variants={sectionVariants} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[.14em] text-violet-300"><span className="size-1.5 rotate-45 rounded-[1px] bg-violet-300" /> AI KHAN <span className="text-muted-foreground/60">/</span> LOCAL WORKSPACE</div>
              <AnimatePresence mode="wait" initial={false}><motion.h1 key={sectionTitle} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-[26px] font-semibold tracking-[-.045em] sm:text-[30px]">{sectionTitle === "Overview" ? "Good morning, welcome back" : sectionTitle}</motion.h1></AnimatePresence>
              <p className="mt-1.5 max-w-xl text-xs leading-5 text-muted-foreground">A calm view of your local lead workspace. Prospect records are live; commerce analytics below are illustrative samples.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border-amber-400/20 bg-amber-400/[0.08] py-1.5 text-amber-200"><span className="mr-1.5 size-1.5 rounded-full bg-amber-300" /> SAMPLE ANALYTICS</Badge>
              <Button className="h-9 rounded-xl text-xs" onClick={() => document.getElementById("prospects")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" })} whileTap={reduceMotion ? undefined : { scale: 0.97 }}><Plus size={15} /> View prospects</Button>
            </div>
          </motion.section>

          <motion.div variants={sectionVariants} className="flex flex-col gap-3 rounded-2xl border border-violet-400/15 bg-gradient-to-r from-violet-500/[0.08] via-blue-500/[0.035] to-transparent px-4 py-3.5 sm:flex-row sm:items-center">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-violet-300/15 bg-violet-400/[0.08] text-violet-200"><Activity size={15} /></span>
            <p className="flex-1 text-[11px] leading-5 text-muted-foreground"><strong className="font-medium text-foreground">Data clarity.</strong> Your prospect list comes from SQLite. Revenue, users, orders, charts, transactions, and projects in this dashboard are sample-only—not your business results.</p>
            <Badge className="w-fit border-border bg-background/50 text-muted-foreground">NO AUTOMATIONS CONNECTED</Badge>
          </motion.div>

          <motion.section id="analytics" variants={sectionVariants} className="scroll-mt-24">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Business overview</h2><p className="mt-1 text-[10px] text-muted-foreground">Illustrative dashboard data · updated for preview</p></div><Badge className="border-border bg-card/70 text-muted-foreground"><span className="mr-1.5 size-1.5 rounded-full bg-violet-300" />Last 12 months</Badge></div>
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {dashboardStats.map((stat, index) => <StatCard key={stat.label} stat={stat} index={index} />)}
            </motion.div>
          </motion.section>

          <motion.section variants={sectionVariants} className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.85fr)]">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader><div><div className="flex items-center gap-2"><CardTitle>Revenue overview</CardTitle><Badge className="border-amber-400/20 bg-amber-400/[0.08] text-amber-200">SAMPLE</Badge></div><CardDescription className="mt-1.5">Illustrative monthly totals · not connected to transactions</CardDescription></div><DropdownMenu.Root><DropdownMenu.Trigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label="Revenue chart options"><MoreHorizontal size={16} /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" className="dropdown-content z-50 min-w-40 rounded-xl border border-border bg-card p-1.5 shadow-xl"><DropdownMenu.Item className="dropdown-item">Sample data only</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></CardHeader>
              <div className="px-5 pt-5"><div className="flex items-end gap-3"><span className="text-[28px] font-semibold tracking-[-.05em]">{currencyFormat.format(48250)}</span><span className="mb-1 inline-flex items-center gap-1 text-[10px] text-emerald-400"><ArrowUpRight size={13} />12.8%</span></div></div>
              <CardContent className="h-[250px] px-2 pb-2 pt-3 sm:h-[292px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueSeries} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.28} /><stop offset="95%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(value: number) => `$${Math.round(value / 1000)}k`} width={40} />
                    <Tooltip content={<DashboardChartTooltip />} />
                    <Area type="monotone" dataKey="previous" name="Prior sample" stroke="#667085" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="4 5" fill="transparent" isAnimationActive animationDuration={1200} />
                    <Area type="monotone" dataKey="current" name="Sample revenue" stroke="#a78bfa" strokeWidth={2.4} fill="url(#revenueFill)" activeDot={{ r: 4, fill: "#c4b5fd", stroke: "#171328", strokeWidth: 2 }} isAnimationActive animationDuration={1500} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Card className="min-w-0">
                <CardHeader><div><div className="flex items-center gap-2"><CardTitle>Traffic sources</CardTitle><Badge className="border-amber-400/20 bg-amber-400/[0.08] text-amber-200">SAMPLE</Badge></div><CardDescription className="mt-1.5">Illustrative mix · no analytics connected</CardDescription></div></CardHeader>
                <CardContent className="flex items-center gap-3 pt-2">
                  <div className="relative h-[150px] w-1/2 min-w-[130px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={trafficSources} dataKey="value" nameKey="name" innerRadius={43} outerRadius={64} paddingAngle={4} stroke="none" isAnimationActive animationDuration={1100}>{trafficSources.map((source) => <Cell key={source.name} fill={source.color} />)}</Pie><Tooltip formatter={(value) => [`${value}%`, "Sample share"]} contentStyle={{ borderRadius: 12, borderColor: "hsl(var(--border))", background: "hsl(var(--card))", fontSize: 11 }} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-content-center text-center"><span className="text-lg font-semibold">100%</span><span className="text-[9px] text-muted-foreground">sample</span></div></div>
                  <div className="grid flex-1 gap-3">{trafficSources.map((source) => <div key={source.name} className="flex items-center justify-between gap-2 text-[10px]"><span className="flex items-center gap-2 text-muted-foreground"><i className="size-2 rounded-full" style={{ backgroundColor: source.color }} />{source.name}</span><span className="font-medium tabular-nums">{source.value}%</span></div>)}</div>
                </CardContent>
              </Card>
              <Card className="min-w-0">
                <CardHeader><div><div className="flex items-center gap-2"><CardTitle>Weekly sales</CardTitle><Badge className="border-amber-400/20 bg-amber-400/[0.08] text-amber-200">SAMPLE</Badge></div><CardDescription className="mt-1.5">Illustrative activity by day</CardDescription></div></CardHeader>
                <CardContent className="h-[174px] px-3 pb-4 pt-2">
                  <ResponsiveContainer width="100%" height="100%"><BarChart data={weeklySales} margin={{ top: 8, right: 2, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} dy={7} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} /><Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }} contentStyle={{ borderRadius: 12, borderColor: "hsl(var(--border))", background: "hsl(var(--card))", fontSize: 11 }} /><Bar dataKey="value" name="Sample sales" radius={[5, 5, 1, 1]} isAnimationActive animationDuration={950}>{weeklySales.map((item, index) => <Cell key={item.day} fill={index === 5 ? "#a78bfa" : "#6474a6"} fillOpacity={index === 5 ? 1 : 0.62} />)}</Bar></BarChart></ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </motion.section>

          {statusError && <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} role="status" className={`fixed bottom-4 right-4 z-[80] max-w-sm rounded-xl border px-4 py-3 text-xs shadow-xl ${statusError.startsWith("Exported") ? "border-emerald-400/20 bg-card text-emerald-300" : "border-rose-400/20 bg-card text-rose-300"}`}>{statusError}<button className="ml-3 underline" onClick={() => setStatusError("")}>Dismiss</button></motion.div>}

          <motion.section variants={sectionVariants} className="scroll-mt-24 space-y-4">
            <ProspectsTable prospects={prospects} loading={loading} error={error} search={search} statusFilter={statusFilter} onStatusFilter={setStatusFilter} onStatusChange={updateStatus} updatingId={updatingId} onExport={exportCsv} />
          </motion.section>

          <motion.section id="workflows" variants={sectionVariants} className="grid scroll-mt-24 grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><div><div className="flex items-center gap-2"><CardTitle>Latest projects</CardTitle><Badge className="border-amber-400/20 bg-amber-400/[0.08] text-amber-200">ILLUSTRATIVE</Badge></div><CardDescription className="mt-1.5">Sample progress concepts, not active work</CardDescription></div><Button variant="ghost" size="icon" className="size-8" aria-label="More project options"><MoreHorizontal size={16} /></Button></CardHeader>
              <CardContent className="grid gap-5">{sampleProjects.map((project, index) => <div key={project.name} className="flex items-center gap-3"><Avatar className="size-9 rounded-xl"><AvatarFallback className={`rounded-xl project-${project.color}`}>{project.initials}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-medium">{project.name}</p><span className="text-[10px] tabular-nums text-muted-foreground">{project.progress}%</span></div><p className="mt-1 text-[10px] text-muted-foreground">{project.detail}</p><div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${project.progress}%` }} transition={{ duration: 0.8, delay: index * 0.1 }} className={`h-full rounded-full project-progress-${project.color}`} /></div></div></div>)}</CardContent>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader><div><div className="flex items-center gap-2"><CardTitle>Recent transactions</CardTitle><Badge className="border-amber-400/20 bg-amber-400/[0.08] text-amber-200">SAMPLE DATA</Badge></div><CardDescription className="mt-1.5">Placeholder rows only · no orders are connected</CardDescription></div><Button variant="ghost" size="icon" className="size-8" aria-label="Transaction list options"><MoreHorizontal size={16} /></Button></CardHeader>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left">
                  <thead><tr className="border-y border-border/70 bg-muted/20 text-[9px] uppercase tracking-[.1em] text-muted-foreground"><th className="px-5 py-3 font-medium">Customer</th><th className="px-3 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Amount</th><th className="px-5 py-3 text-right font-medium">Status</th></tr></thead>
                  <tbody>{sampleTransactions.map((transaction) => <tr key={transaction.id} className="border-b border-border/50 transition-colors hover:bg-muted/30 last:border-0"><td className="px-5 py-3"><div className="flex items-center gap-2.5"><Avatar className="size-7"><AvatarFallback className={`text-[9px] avatar-${transaction.color}`}>{transaction.initials}</AvatarFallback></Avatar><div><p className="text-[10px] font-medium">{transaction.customer}</p><p className="text-[9px] text-muted-foreground">{transaction.item}</p></div></div></td><td className="px-3 py-3 text-[10px] text-muted-foreground">{transaction.date}</td><td className="px-3 py-3 text-[10px] font-medium tabular-nums">{currencyFormat.format(transaction.amount)}</td><td className="px-5 py-3 text-right"><Badge className={`transaction-${transaction.status.toLowerCase()} border-current/20`}>{transaction.status}</Badge></td></tr>)}</tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-border/70 px-5 py-3 text-[9px] text-muted-foreground"><span>All values are illustrative</span><span>Fictional placeholder records</span></div>
            </Card>
          </motion.section>
          <motion.footer variants={sectionVariants} className="flex flex-col gap-1 border-t border-border/70 pt-4 text-[9px] text-muted-foreground sm:flex-row sm:justify-between"><span>AI Khan · Local prospect workspace</span><span>Prospects are stored in SQLite · No external integrations are enabled</span></motion.footer>
        </motion.main>
      </div>
    </div>
  );
}
