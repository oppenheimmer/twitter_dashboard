import { parseAllArchives } from "@/lib/parser";
import LikesList from "@/components/LikesList";
import StatisticsPanel from "@/components/StatisticsPanel";
import InsightsPanel from "@/components/InsightsPanel";
import BookmarksPanel from "@/components/BookmarksPanel";
import { loadWordCloudData } from "@/lib/word-cloud-data";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function AllArchivesPage({ searchParams }: Props) {
  const likes = parseAllArchives();
  const wordCloudData = loadWordCloudData();
  const { tab } = await searchParams;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          All Archives
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {likes.length.toLocaleString()} unique liked tweets (globally
          deduplicated across all archives)
        </p>
      </div>
      {tab === "statistics" ? (
        <StatisticsPanel likes={likes} />
      ) : tab === "insights" ? (
        <InsightsPanel likes={likes} wordCloudData={wordCloudData} />
      ) : tab === "bookmarks" ? (
        <BookmarksPanel likes={likes} />
      ) : (
        <LikesList likes={likes} archive="all" />
      )}
    </div>
  );
}
