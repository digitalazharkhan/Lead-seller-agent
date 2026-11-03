export type SparkPoint = { value: number };

export type DashboardStat = {
  label: string;
  value: number;
  display: (value: number) => string;
  change: string;
  direction: "up" | "down";
  note: string;
  color: string;
  spark: SparkPoint[];
};

export const dashboardStats: DashboardStat[] = [
  {
    label: "Revenue",
    value: 48250,
    display: (value) => `$${Math.round(value).toLocaleString()}`,
    change: "+12.8%",
    direction: "up",
    note: "Illustrative sample",
    color: "#a78bfa",
    spark: [{ value: 18 }, { value: 25 }, { value: 20 }, { value: 38 }, { value: 32 }, { value: 45 }, { value: 58 }],
  },
  {
    label: "Users",
    value: 2846,
    display: (value) => Math.round(value).toLocaleString(),
    change: "+8.2%",
    direction: "up",
    note: "Illustrative sample",
    color: "#60a5fa",
    spark: [{ value: 20 }, { value: 18 }, { value: 28 }, { value: 30 }, { value: 42 }, { value: 37 }, { value: 55 }],
  },
  {
    label: "Orders",
    value: 1240,
    display: (value) => Math.round(value).toLocaleString(),
    change: "+4.6%",
    direction: "up",
    note: "Illustrative sample",
    color: "#34d399",
    spark: [{ value: 22 }, { value: 29 }, { value: 24 }, { value: 34 }, { value: 31 }, { value: 48 }, { value: 52 }],
  },
  {
    label: "Growth",
    value: 18.6,
    display: (value) => `${value.toFixed(1)}%`,
    change: "+2.4%",
    direction: "up",
    note: "Illustrative sample",
    color: "#fbbf24",
    spark: [{ value: 16 }, { value: 22 }, { value: 20 }, { value: 31 }, { value: 35 }, { value: 40 }, { value: 57 }],
  },
];

export const revenueSeries = [
  { month: "Jan", current: 21500, previous: 17200 },
  { month: "Feb", current: 23800, previous: 19400 },
  { month: "Mar", current: 22100, previous: 18300 },
  { month: "Apr", current: 28700, previous: 20900 },
  { month: "May", current: 30200, previous: 23600 },
  { month: "Jun", current: 27800, previous: 22100 },
  { month: "Jul", current: 35400, previous: 25900 },
  { month: "Aug", current: 33100, previous: 27400 },
  { month: "Sep", current: 38900, previous: 30100 },
  { month: "Oct", current: 36800, previous: 28500 },
  { month: "Nov", current: 43100, previous: 33800 },
  { month: "Dec", current: 48250, previous: 37200 },
];

export const trafficSources = [
  { name: "Direct", value: 38, color: "#a78bfa" },
  { name: "Social", value: 27, color: "#60a5fa" },
  { name: "Referral", value: 21, color: "#34d399" },
  { name: "Search", value: 14, color: "#fbbf24" },
];

export const weeklySales = [
  { day: "Mon", value: 32 },
  { day: "Tue", value: 46 },
  { day: "Wed", value: 38 },
  { day: "Thu", value: 65 },
  { day: "Fri", value: 54 },
  { day: "Sat", value: 78 },
  { day: "Sun", value: 59 },
];

export const sampleTransactions = [
  { id: "TX-8092", customer: "Avery Chen", email: "avery@example.test", item: "Studio plan", date: "Oct 12, 2026", amount: 249, status: "Completed", initials: "AC", color: "violet" },
  { id: "TX-8091", customer: "Jordan Taylor", email: "jordan@example.test", item: "Growth plan", date: "Oct 12, 2026", amount: 129, status: "Pending", initials: "JT", color: "blue" },
  { id: "TX-8090", customer: "Morgan Lee", email: "morgan@example.test", item: "Starter plan", date: "Oct 11, 2026", amount: 79, status: "Completed", initials: "ML", color: "green" },
  { id: "TX-8089", customer: "Riley Patel", email: "riley@example.test", item: "Studio plan", date: "Oct 11, 2026", amount: 249, status: "Refunded", initials: "RP", color: "amber" },
];

export const sampleProjects = [
  { name: "Q4 acquisition", detail: "Campaign concept · sample", progress: 78, initials: "QA", color: "violet" },
  { name: "Local reach study", detail: "Analytics preview · sample", progress: 52, initials: "LR", color: "blue" },
  { name: "Partner directory", detail: "Workspace concept · sample", progress: 34, initials: "PD", color: "green" },
];
