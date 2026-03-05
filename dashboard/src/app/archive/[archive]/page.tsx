import { notFound } from "next/navigation";
import { getArchiveNames } from "@/lib/archives";
import { parseLikeJs } from "@/lib/parser";
import LikesList from "@/components/LikesList";
import StatisticsPanel from "@/components/StatisticsPanel";
import InsightsPanel from "@/components/InsightsPanel";
import BookmarksPanel from "@/components/BookmarksPanel";
import { loadWordCloudData } from "@/lib/word-cloud-data";

type Props = {
  params: Promise<{ archive: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export function generateStaticParams() {
  return getArchiveNames().map((archive) => ({ archive }));
}

export default async function ArchivePage({ params, searchParams }: Props) {
  const { archive } = await params;
  const { tab } = await searchParams;

  if (!getArchiveNames().includes(archive)) {
    notFound();
  }

  const likes = parseLikeJs(archive);
  const wordCloudData = loadWordCloudData();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {archive}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {likes.length.toLocaleString()} unique liked tweets
        </p>
      </div>
      {tab === "statistics" ? (
        <StatisticsPanel likes={likes} />
      ) : tab === "insights" ? (
        <InsightsPanel likes={likes} wordCloudData={wordCloudData} />
      ) : tab === "bookmarks" ? (
        <BookmarksPanel likes={likes} />
      ) : (
        <LikesList likes={likes} archive={archive} />
      )}
    </div>
  );
}
