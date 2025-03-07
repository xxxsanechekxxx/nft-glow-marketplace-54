import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Loader2, Clock, Award, CheckCircle2, XCircle, ShieldCheck, ShieldAlert } from "lucide-react";
import { NFTBid, NFT } from "@/types/nft";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const ActiveBids = () => {
  const [selectedBid, setSelectedBid] = useState<(NFTBid & { nft?: NFT })| null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"accept" | "decline" | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch NFTs owned by the user
  const { data: userNFTs, isLoading: isLoadingNFTs } = useQuery({
    queryKey: ['user-nfts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('nfts')
        .select('*')
        .eq('owner_id', user.id)
        .eq('for_sale', true);
      
      if (error) throw error;
      return data as NFT[];
    },
    enabled: !!user?.id
  });

  // Fetch bids for user's NFTs
  const { data: bids = [], isLoading: isLoadingBids } = useQuery({
    queryKey: ['nft-bids', userNFTs?.map(nft => nft.id)],
    queryFn: async () => {
      if (!userNFTs?.length) return [];
      
      const { data, error } = await supabase
        .from('nft_bids')
        .select(`
          *,
          nft:nfts(*)
        `)
        .in('nft_id', userNFTs.map(nft => nft.id))
        .order('bid_amount', { ascending: false });
      
      if (error) throw error;
      return data as (NFTBid & { nft: NFT })[];
    },
    enabled: !!userNFTs?.length
  });

  const getMarketplaceDisplay = (marketplaceKey: string | null) => {
    if (!marketplaceKey) return null;
    
    const marketplaceMap: Record<string, string> = {
      'purenft': 'PureNFT',
      'rarible': 'Rarible',
      'opensea': 'OpenSea',
      'looksrare': 'LooksRare',
      'dappradar': 'DappRadar',
      'debank': 'DeBank'
    };
    
    return marketplaceMap[marketplaceKey] || marketplaceKey;
  };

  const handleAcceptBid = (bid: NFTBid & { nft?: NFT }) => {
    setSelectedBid(bid);
    setActionType("accept");
    setConfirmDialogOpen(true);
  };

  const handleDeclineBid = (bid: NFTBid & { nft?: NFT }) => {
    setSelectedBid(bid);
    setActionType("decline");
    setConfirmDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedBid || !actionType) return;
    
    try {
      if (actionType === "accept") {
        // Update NFT ownership and sale status
        const { error: nftError } = await supabase
          .from('nfts')
          .update({ 
            owner_id: selectedBid.bidder_address,
            for_sale: false 
          })
          .eq('id', selectedBid.nft_id);
        
        if (nftError) throw nftError;

        // Delete all bids for this NFT
        const { error: bidsError } = await supabase
          .from('nft_bids')
          .delete()
          .eq('nft_id', selectedBid.nft_id);
        
        if (bidsError) throw bidsError;

        toast({
          title: "Bid Accepted",
          description: `You sold your NFT for ${selectedBid.bid_amount} ETH`,
        });
      } else {
        // Delete just this bid
        const { error } = await supabase
          .from('nft_bids')
          .delete()
          .eq('id', selectedBid.id);
        
        if (error) throw error;

        toast({
          title: "Bid Declined",
          description: "The bid has been declined",
        });
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['nft-bids'] });
      queryClient.invalidateQueries({ queryKey: ['user-nfts'] });
      
    } catch (error) {
      console.error(`Error ${actionType}ing bid:`, error);
      toast({
        title: "Error",
        description: `Failed to ${actionType} the bid`,
        variant: "destructive"
      });
    } finally {
      setConfirmDialogOpen(false);
      setSelectedBid(null);
      setActionType(null);
    }
  };

  const isLoading = isLoadingNFTs || isLoadingBids;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bids.length) {
    return (
      <div className="text-center py-12 space-y-4">
        <Award className="h-16 w-16 mx-auto text-primary/40" />
        <h3 className="text-xl font-medium">No active bids</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          When someone places a bid on your NFTs, they will appear here.
        </p>
      </div>
    );
  }

  // Group bids by NFT
  const bidsByNFT: Record<string, (NFTBid & { nft?: NFT })[]> = {};
  bids.forEach(bid => {
    if (!bidsByNFT[bid.nft_id]) {
      bidsByNFT[bid.nft_id] = [];
    }
    bidsByNFT[bid.nft_id].push(bid);
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Accordion type="single" collapsible className="w-full">
        {Object.entries(bidsByNFT).map(([nftId, nftBids]) => {
          const nft = nftBids[0]?.nft;
          // Sort bids by amount (highest first)
          const sortedBids = [...nftBids].sort((a, b) => 
            parseFloat(b.bid_amount) - parseFloat(a.bid_amount)
          );
          
          return (
            <AccordionItem 
              key={nftId} 
              value={nftId}
              className="nft-accordion-item"
            >
              <div className="bid-card overflow-hidden rounded-lg border border-purple-500/20">
                <AccordionTrigger className="px-4 sm:px-6 py-3 sm:py-4 hover:no-underline">
                  <div className="flex w-full items-center gap-2 sm:gap-4">
                    {/* NFT Image with Marketplace Badge */}
                    {nft?.image && (
                      <div className="h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 flex-shrink-0 rounded-lg overflow-hidden border border-purple-600/20 relative">
                        <img src={nft.image} alt={nft.name} className="h-full w-full object-cover" />
                        
                        {nft.marketplace && (
                          <div className="absolute top-2 left-2">
                            <Badge 
                              variant="outline" 
                              className="bg-black/70 text-white border-white/20 backdrop-blur-md text-[10px] px-1.5 py-0.5"
                            >
                              {getMarketplaceDisplay(nft.marketplace)}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* NFT Info */}
                    <div className="flex-grow space-y-1 text-left">
                      <h3 className="font-semibold text-sm sm:text-lg md:text-xl transition-colors duration-700 group-hover:text-primary line-clamp-1">{nft?.name || 'Unknown NFT'}</h3>
                      <div className="flex flex-wrap gap-1 sm:gap-2 items-center">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-200 border-blue-500/20 text-[10px] sm:text-xs py-0.5 sm:py-1">
                          <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-0.5 sm:mr-1" />
                          {nftBids.length} {nftBids.length === 1 ? 'Bid' : 'Bids'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="px-4 sm:px-6 pt-2 pb-4 sm:pb-5">
                  <div className="space-y-3 sm:space-y-4">
                    {/* Bids List */}
                    <div className="grid gap-2 sm:gap-3">
                      {sortedBids.map((bid) => (
                        <div 
                          key={bid.id} 
                          className="bid-item-regular"
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            {/* Bid Content */}
                            <div className="flex-grow">
                              {/* Bidder Info Row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <span className="text-xs sm:text-sm font-medium bidder-address">{bid.bidder_address}</span>
                                  
                                  {/* Verification Badge */}
                                  {bid.verified ? (
                                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30 flex text-[10px] h-5 items-center gap-0.5">
                                      <ShieldCheck className="h-3 w-3 mr-0.5" />
                                      Verified
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 flex text-[10px] h-5 items-center gap-0.5">
                                      <ShieldAlert className="h-3 w-3 mr-0.5" />
                                      Not Verified
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              {/* Bid Details */}
                              <div className="mt-1 sm:mt-2 flex flex-wrap gap-1 sm:gap-3 bid-meta-container">
                                <span className="bid-amount-regular">
                                  <img 
                                    src="/lovable-uploads/7dcd0dff-e904-44df-813e-caf5a6160621.png" 
                                    alt="ETH" 
                                    className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" 
                                  />
                                  {bid.bid_amount}
                                </span>
                                
                                <div className="flex flex-wrap gap-1 sm:gap-3">
                                  <span className="bid-meta-regular">
                                    <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 sm:mr-1" />
                                    {bid.created_at}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="flex gap-2 sm:gap-3 mt-2 sm:mt-3">
                                <Button 
                                  onClick={() => handleAcceptBid(bid)}
                                  className="accept-btn flex-1 text-xs sm:text-xs"
                                  size="sm"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Accept
                                </Button>
                                
                                <Button 
                                  variant="outline"
                                  onClick={() => handleDeclineBid(bid)}
                                  className="decline-btn flex-1 text-xs sm:text-xs"
                                  size="sm"
                                >
                                  <XCircle className="w-3 h-3 mr-1" /> Decline
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </div>
            </AccordionItem>
          );
        })}
      </Accordion>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md border-purple-500/30 bg-gradient-to-br from-background to-background/95 w-[calc(100%-2rem)] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-lg sm:text-xl">
              {actionType === "accept" ? "Accept Bid" : "Decline Bid"}
            </DialogTitle>
            <DialogDescription className="text-center pt-2 text-sm sm:text-base">
              {actionType === "accept" 
                ? "Are you sure you want to accept this bid and sell your NFT?" 
                : "Are you sure you want to decline this bid?"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedBid && selectedBid.nft && (
            <div className="py-3 sm:py-4">
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-purple-500/30 relative">
                  <img 
                    src={selectedBid.nft.image} 
                    alt={selectedBid.nft.name} 
                    className="w-full h-full object-cover" 
                  />
                  
                  {selectedBid.nft.marketplace && (
                    <div className="absolute top-1 left-1">
                      <Badge variant="outline" className="bg-black/70 text-white border-white/20 backdrop-blur-md text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5">
                        {getMarketplaceDisplay(selectedBid.nft.marketplace)}
                      </Badge>
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-sm sm:text-lg">{selectedBid.nft.name}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    {selectedBid.marketplace && `On ${getMarketplaceDisplay(selectedBid.marketplace)}`} • Token ID: #{selectedBid.nft_id.substring(0, 8)}
                  </div>
                </div>
              </div>
              
              <div className={`text-center p-4 sm:p-6 rounded-lg ${
                actionType === "accept" 
                  ? "bg-green-900/20 border border-green-500/30" 
                  : "bg-red-900/20 border border-red-500/30"
              }`}>
                {actionType === "accept" ? (
                  <div className="flex flex-col items-center">
                    <span className="text-xs sm:text-sm text-green-300">You are selling for</span>
                    <div className="flex items-center justify-center mt-1">
                      <img 
                        src="/lovable-uploads/7dcd0dff-e904-44df-813e-caf5a6160621.png" 
                        alt="ETH" 
                        className="h-5 w-5 sm:h-6 sm:w-6 mr-1 sm:mr-2" 
                      />
                      <span className="text-xl sm:text-2xl font-bold text-green-400">{selectedBid.bid_amount}</span>
                    </div>
                    <span className="text-xs sm:text-sm text-green-300 mt-1 bidder-address">{selectedBid.bidder_address}</span>
                    
                    {/* Verification Status in Confirmation Dialog */}
                    {selectedBid.verified ? (
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/30 flex text-xs mt-2 items-center gap-1">
                        <ShieldCheck className="h-3 w-3 mr-0.5" />
                        Verified Bidder
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30 flex text-xs mt-2 items-center gap-1">
                        <ShieldAlert className="h-3 w-3 mr-0.5" />
                        Not Verified Bidder
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <span className="text-xs sm:text-sm text-red-300">You are declining</span>
                    <div className="flex items-center justify-center mt-1">
                      <img 
                        src="/lovable-uploads/7dcd0dff-e904-44df-813e-caf5a6160621.png" 
                        alt="ETH" 
                        className="h-5 w-5 sm:h-6 sm:w-6 mr-1 sm:mr-2" 
                      />
                      <span className="text-xl sm:text-2xl font-bold text-red-400">{selectedBid.bid_amount}</span>
                    </div>
                    <span className="text-xs sm:text-sm text-red-300 mt-1 bidder-address">{selectedBid.bidder_address}</span>
                    
                    {/* Verification Status in Confirmation Dialog */}
                    {selectedBid.verified ? (
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/30 flex text-xs mt-2 items-center gap-1">
                        <ShieldCheck className="h-3 w-3 mr-0.5" />
                        Verified Bidder
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30 flex text-xs mt-2 items-center gap-1">
                        <ShieldAlert className="h-3 w-3 mr-0.5" />
                        Not Verified Bidder
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="flex justify-between gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialogOpen(false)}
              className="border-muted-foreground/20 hover:bg-background text-xs sm:text-sm"
              size="sm"
            >
              Cancel
            </Button>
            <Button 
              variant={actionType === "accept" ? "default" : "destructive"}
              onClick={confirmAction}
              className={`text-xs sm:text-sm ${actionType === "accept" ? "bg-green-600 hover:bg-green-700" : ""}`}
              size="sm"
            >
              {actionType === "accept" ? "Confirm Sale" : "Confirm Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
