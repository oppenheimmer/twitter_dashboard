"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function ArchiveSwitcher({
  archiveNames,
}: {
  archiveNames: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segments = pathname.split("/");
  const current = segments[2] ?? "all";
  const currentTab = searchParams.get("tab");

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = currentTab ? `?tab=${currentTab}` : "";
    router.push(`/archive/${e.target.value}${params}`);
  }

  function switchTab(tab: string) {
    if (currentTab === tab) {
      router.push(pathname);
    } else {
      router.push(`${pathname}?tab=${tab}`);
    }
  }

  const inactiveStyle =
    "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";

  return (
    <div className="flex items-center gap-2">
      <select
        value={current}
        onChange={handleChange}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      >
        <option value="all">All Archives</option>
        {archiveNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <button
        onClick={() => switchTab("statistics")}
        className={`rounded-md border px-3 py-1.5 text-sm shadow-sm transition-colors ${
          currentTab === "statistics"
            ? "border-green-600 bg-green-600 text-white"
            : inactiveStyle
        }`}
      >
        Statistics
      </button>
      <button
        onClick={() => switchTab("insights")}
        className={`rounded-md border px-3 py-1.5 text-sm shadow-sm transition-colors ${
          currentTab === "insights"
            ? "border-blue-600 bg-blue-600 text-white"
            : inactiveStyle
        }`}
      >
        Insights
      </button>
      <button
        onClick={() => switchTab("bookmarks")}
        className={`rounded-md border px-3 py-1.5 text-sm shadow-sm transition-colors ${
          currentTab === "bookmarks"
            ? "border-yellow-500 bg-yellow-500 text-white"
            : inactiveStyle
        }`}
      >
        Bookmarks
      </button>
    </div>
  );
}
