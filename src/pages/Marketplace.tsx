
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { supabase } from "@/lib/supabase";
import { useInfiniteQuery } from "@tanstack/react-query";
import { MarketplaceStats } from "@/components/marketplace/MarketplaceStats";
import { MarketplaceSearch } from "@/components/marketplace/MarketplaceSearch";
import { NFTGrid } from "@/components/marketplace/NFTGrid";

interface NFT {
  id: string;
  name: string;
  image: string;
  price: string;
  creator: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 8;

const fetchNFTs = async ({ pageParam = 0 }) => {
  const from = pageParam * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from('nfts')
    .select('*', { count: 'exact' })
    .range(from, to)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return { data, count, nextPage: to < (count || 0) ? pageParam + 1 : undefined };
};

const Marketplace = () => {
  useEffect(() => {
    document.title = "PureNFT - Marketplace";
    return () => {
      document.title = "PureNFT";
    };
  }, []);

  const { ref, inView } = useInView();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['nfts'],
    queryFn: fetchNFTs,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 300000,
    gcTime: 3600000,
  });

  const sortNFTs = (nftsToSort: NFT[]) => {
    switch (sortBy) {
      case "newest":
        return [...nftsToSort].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case "oldest":
        return [...nftsToSort].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case "price-asc":
        return [...nftsToSort].sort((a, b) => 
          parseFloat(a.price) - parseFloat(b.price)
        );
      case "price-desc":
        return [...nftsToSort].sort((a, b) => 
          parseFloat(b.price) - parseFloat(a.price)
        );
      default:
        return nftsToSort;
    }
  };

  const allNFTs = data?.pages.flatMap(page => page.data) || [];
  const filteredNFTs = allNFTs.filter(nft => 
    nft.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    nft.creator.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const sortedAndFilteredNFTs = filteredNFTs ? sortNFTs(filteredNFTs) : [];

  useEffect(() => {
    if (inView && !isLoading && !isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  if (error) {
    return (
      <div className="container mx-auto px-4 pt-24">
        <div className="text-center text-red-500">
          Error loading NFTs. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,hsl(var(--background))_0%,hsl(var(--background))_50%,rgba(123,97,255,0.05)_100%)]">
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="text-center mb-16 space-y-8">
          <div className="space-y-4 opacity-0 animate-[fadeIn_1s_ease-out_forwards] min-h-[120px] flex flex-col items-center justify-center">
            <h1 className="text-7xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 text-transparent bg-clip-text animate-[gradient_8s_linear_infinite] bg-[length:200%_200%] drop-shadow-sm py-6">
              NFT Marketplace
            </h1>
            <p className="text-xl text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed">
              Discover and collect extraordinary NFTs from talented creators around the world
            </p>
          </div>

          <MarketplaceStats />
          
          <MarketplaceSearch
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortBy={sortBy}
            setSortBy={setSortBy}
          />
        </div>

        <NFTGrid
          nfts={sortedAndFilteredNFTs}
          isLoading={isLoading}
          isFetchingNextPage={isFetchingNextPage}
          lastElementRef={ref}
        />
      </div>
    </div>
  );
};

export default Marketplace;
