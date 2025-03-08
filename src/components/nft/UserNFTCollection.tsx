
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { NFTCard } from "@/components/NFTCard";
import { EmptyNFTState } from "@/components/EmptyNFTState";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Filter, Search, LockIcon, Clock, RefreshCw } from "lucide-react";
import type { NFT } from "@/types/nft";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import ActiveBids from "./ActiveBids";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface FrozenBalanceInfo {
  amount: number;
  days_left: number;
  unfreeze_date: string;
  transaction_id: string;
}

export const UserNFTCollection = () => {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("my-nfts");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExchangeDialog, setShowExchangeDialog] = useState(false);
  const [exchangeAmount, setExchangeAmount] = useState<string>("");
  const [userBalance, setUserBalance] = useState({
    balance: "0.00",
    usdt_balance: "0.00",
    frozen_balance: "0.00",
    frozen_usdt_balance: "0.00",
  });
  const [showFrozenDetails, setShowFrozenDetails] = useState(false);
  const [frozenBalanceDetails, setFrozenBalanceDetails] = useState<FrozenBalanceInfo[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleExchangeToUSDT = async () => {
    if (!user?.id) return;
    
    try {
      const amount = parseFloat(exchangeAmount);
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Invalid Amount",
          description: "Please enter a valid amount greater than 0",
          variant: "destructive"
        });
        return;
      }

      if (amount > parseFloat(userBalance.frozen_balance)) {
        toast({
          title: "Insufficient Balance",
          description: "You don't have enough frozen balance for this exchange",
          variant: "destructive"
        });
        return;
      }
      
      // Call the exchange_to_usdt function
      const { data, error } = await supabase.rpc('exchange_to_usdt', {
        amount: amount
      });
      
      if (error) throw error;
      
      toast({
        title: "Exchange Request Submitted",
        description: "Your request to exchange frozen balance to USDT is being processed",
      });
      
      // Update the local balance
      setUserBalance(prev => ({
        ...prev,
        frozen_balance: (parseFloat(prev.frozen_balance) - amount).toFixed(2)
      }));
      
      setShowExchangeDialog(false);
      setExchangeAmount("");
    } catch (error) {
      console.error("Error requesting exchange:", error);
      toast({
        title: "Error",
        description: "Failed to submit exchange request",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        
        // Fetch user's NFTs
        const { data: nftData, error: nftError } = await supabase
          .from('nfts')
          .select('*')
          .eq('owner_id', user.id);
        
        if (nftError) {
          throw nftError;
        }
        
        // Format NFT data
        const formattedNFTs = nftData?.map(nft => ({
          ...nft,
          price: nft.price.toString()
        })) || [];
        
        setNfts(formattedNFTs);

        // Fetch user's balance information
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('balance, usdt_balance, frozen_balance, frozen_usdt_balance')
          .eq('user_id', user.id)
          .single();
        
        if (profileError) {
          throw profileError;
        }
        
        if (profileData) {
          setUserBalance({
            balance: profileData.balance?.toFixed(2) || "0.00",
            usdt_balance: profileData.usdt_balance?.toFixed(2) || "0.00",
            frozen_balance: profileData.frozen_balance?.toFixed(2) || "0.00",
            frozen_usdt_balance: profileData.frozen_usdt_balance?.toFixed(2) || "0.00",
          });
        }

        // Fetch frozen balance details
        const { data: frozenData, error: frozenError } = await supabase
          .rpc('get_user_frozen_balances', {
            user_uuid: user.id
          });

        if (frozenError) {
          console.error("Error fetching frozen balances:", frozenError);
        } else if (frozenData && frozenData.length > 0) {
          setFrozenBalanceDetails(frozenData[0].unfreezing_in_days || []);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast({
          title: "Error",
          description: "Failed to load your collection data",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user?.id, toast]);

  const handleUpdateNFTPrice = async (id: string, newPrice: string) => {
    try {
      const { error } = await supabase
        .from('nfts')
        .update({ price: newPrice })
        .eq('id', id)
        .eq('owner_id', user?.id);
      
      if (error) throw error;
      
      setNfts(nfts.map(nft => 
        nft.id === id ? { ...nft, price: newPrice } : nft
      ));

      toast({
        title: "Success",
        description: "NFT price updated successfully",
      });
    } catch (error) {
      console.error("Error updating NFT price:", error);
      toast({
        title: "Error",
        description: "Failed to update NFT price",
        variant: "destructive"
      });
    }
  };

  const handleCancelSale = async (id: string) => {
    try {
      const { error } = await supabase
        .from('nfts')
        .update({ for_sale: false })
        .eq('id', id)
        .eq('owner_id', user?.id);
      
      if (error) throw error;
      
      setNfts(nfts.map(nft => 
        nft.id === id ? { ...nft, for_sale: false } : nft
      ));

      toast({
        title: "Success",
        description: "NFT removed from sale",
      });
    } catch (error) {
      console.error("Error canceling NFT sale:", error);
      toast({
        title: "Error",
        description: "Failed to cancel NFT sale",
        variant: "destructive"
      });
    }
  };

  const filteredNFTs = nfts.filter(nft => {
    if (!searchQuery) return true;
    return nft.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           nft.creator.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="relative">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary to-purple-500 opacity-75 blur"></div>
          <Loader2 className="h-10 w-10 animate-spin text-primary relative" />
        </div>
      </div>
    );
  }

  const renderMyNFTs = () => {
    if (nfts.length === 0) {
      return <EmptyNFTState />;
    }

    if (filteredNFTs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
          <div className="p-4 rounded-full bg-primary/10">
            <Search className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">No NFTs match your search</h3>
          <p className="text-muted-foreground max-w-md">
            Try changing your search criteria
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 animate-in fade-in duration-300">
        {filteredNFTs.map((nft) => (
          <NFTCard
            key={nft.id}
            id={nft.id}
            name={nft.name}
            image={nft.image}
            price={nft.price}
            creator={nft.creator}
            owner_id={nft.owner_id}
            for_sale={nft.for_sale}
            isProfileView={true}
            onCancelSale={handleCancelSale}
            onUpdatePrice={handleUpdateNFTPrice}
          />
        ))}
      </div>
    );
  };

  const handleRefreshBids = () => {
    toast({
      title: "Success",
      description: "Bid accepted successfully",
    });
  };

  // Render balance cards before tabs
  const renderBalanceCards = () => {
    if (parseFloat(userBalance.balance) === 0 && parseFloat(userBalance.frozen_balance) === 0) {
      return null;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Available Balance Card */}
        <div className="bg-gradient-to-br from-primary/10 to-purple-600/5 rounded-xl border border-primary/20 p-6 shadow-lg hover:shadow-primary/5 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Available Balance</h3>
          </div>
          <div className="space-y-4">
            {/* ETH Balance */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="/lovable-uploads/7dcd0dff-e904-44df-813e-caf5a6160621.png" 
                  alt="ETH"
                  className="h-8 w-8"
                />
                <span className="text-sm text-muted-foreground">Ethereum</span>
              </div>
              <h2 className="text-2xl font-bold text-white">
                {userBalance.balance} <span className="text-sm text-muted-foreground">ETH</span>
              </h2>
            </div>
            
            {/* USDT Balance */}
            <div className="flex items-center justify-between border-t border-primary/10 pt-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center bg-green-500/10 rounded-full h-8 w-8">
                  <span className="text-green-500 font-bold">$</span>
                </div>
                <span className="text-sm text-muted-foreground">Tether</span>
              </div>
              <h2 className="text-2xl font-bold text-green-500">
                {userBalance.usdt_balance} <span className="text-sm text-green-500/70">USDT</span>
              </h2>
            </div>
          </div>
        </div>

        {/* Frozen Balance Card */}
        {parseFloat(userBalance.frozen_balance) > 0 && (
          <div className="bg-gradient-to-br from-yellow-500/10 to-amber-600/5 rounded-xl border border-yellow-500/20 p-6 shadow-lg hover:shadow-yellow-500/5 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-yellow-500">Hold Balance</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-yellow-500/20 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 h-8 px-3"
                  size="sm"
                  onClick={() => setShowFrozenDetails(!showFrozenDetails)}
                >
                  {showFrozenDetails ? "Hide Details" : "Show Details"}
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Frozen ETH Balance */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-yellow-500/20">
                    <LockIcon className="h-4 w-4 text-yellow-500" />
                  </div>
                  <span className="text-sm text-yellow-500/80">Frozen ETH</span>
                </div>
                <div className="flex flex-col items-end">
                  <h2 className="text-2xl font-bold text-yellow-500">
                    {userBalance.frozen_balance} <span className="text-sm text-yellow-500/70">ETH</span>
                  </h2>
                  {parseFloat(userBalance.frozen_balance) > 0 && (
                    <Button
                      variant="exchange"
                      size="sm"
                      onClick={() => setShowExchangeDialog(true)}
                      className="mt-2 h-8 px-3"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Exchange to USDT
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Frozen USDT Balance */}
              {parseFloat(userBalance.frozen_usdt_balance) > 0 && (
                <div className="flex items-center justify-between border-t border-yellow-500/20 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center bg-blue-500/20 rounded-full h-8 w-8">
                      <LockIcon className="h-4 w-4 text-blue-500" />
                    </div>
                    <span className="text-sm text-blue-500/80">Frozen USDT</span>
                  </div>
                  <h2 className="text-2xl font-bold text-blue-500">
                    {userBalance.frozen_usdt_balance} <span className="text-sm text-blue-500/70">USDT</span>
                  </h2>
                </div>
              )}
            </div>
            
            <p className="text-xs text-yellow-500/80 mt-4">
              Funds from NFT sales are frozen for 15 days before being available
            </p>
            
            {showFrozenDetails && frozenBalanceDetails.length > 0 && (
              <div className="mt-4 border-t border-yellow-500/20 pt-4 space-y-3 animate-in fade-in duration-300">
                <p className="text-xs font-medium text-yellow-500/80">Upcoming Releases:</p>
                <div className="max-h-40 overflow-y-auto pr-1 space-y-2">
                  {frozenBalanceDetails.map((item) => (
                    <div 
                      key={item.transaction_id} 
                      className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-yellow-500/80" />
                        <span className="text-xs text-yellow-500/90 font-medium">{item.days_left} days left</span>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end sm:gap-4">
                        <div className="flex items-center gap-1.5">
                          <img 
                            src="/lovable-uploads/0e51dc88-2aac-485e-84c5-0bb4ab88f00b.png" 
                            alt="ETH" 
                            className="h-3 w-3"
                          />
                          <span className="text-xs font-bold text-yellow-500">{item.amount.toFixed(2)}</span>
                        </div>
                        <span className="text-xs text-yellow-500/70">{item.unfreeze_date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Balance Cards Section */}
      {renderBalanceCards()}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <TabsList className="grid w-full md:w-auto grid-cols-2">
            <TabsTrigger 
              value="my-nfts"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              My NFTs
            </TabsTrigger>
            <TabsTrigger 
              value="active-bids"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              Active Bids
            </TabsTrigger>
          </TabsList>

          {activeTab === "my-nfts" && nfts.length > 0 && (
            <div className="relative group w-full md:w-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
              <div className="relative flex items-center">
                <Input
                  type="text"
                  placeholder="Search by name or creator..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 backdrop-blur-sm border-white/10 focus:border-primary shadow-lg transition-all duration-700 hover:shadow-primary/5 text-white placeholder:text-muted-foreground w-full"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors duration-700 group-hover:text-primary" />
              </div>
            </div>
          )}
        </div>
        
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 rounded-xl blur-xl opacity-50"></div>
          <div className="relative bg-card/30 backdrop-blur-sm border border-primary/10 rounded-xl p-4 sm:p-6 shadow-lg">
            
            <TabsContent value="my-nfts" className="mt-4">
              {renderMyNFTs()}
            </TabsContent>
            
            <TabsContent value="active-bids" className="mt-4">
              <ActiveBids 
                currentUserId={user?.id} 
                onBidAccepted={handleRefreshBids}
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {/* Exchange Dialog */}
      <Dialog open={showExchangeDialog} onOpenChange={setShowExchangeDialog}>
        <DialogContent className="sm:max-w-[425px] bg-card/90 backdrop-blur-md border-primary/20 text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-yellow-500" />
              Exchange to USDT
            </DialogTitle>
            <DialogDescription>
              Convert your frozen ETH balance to USDT. This request will be processed by the admin.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-white">Amount (ETH)</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  className="pl-10 bg-background/40 border-yellow-500/30 focus:border-yellow-500/50"
                  value={exchangeAmount}
                  onChange={(e) => setExchangeAmount(e.target.value)}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <img 
                    src="/lovable-uploads/0e51dc88-2aac-485e-84c5-0bb4ab88f00b.png" 
                    alt="ETH" 
                    className="h-4 w-4"
                  />
                </div>
              </div>
              <p className="text-xs text-yellow-500">
                Available: {userBalance.frozen_balance} ETH
              </p>
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setShowExchangeDialog(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              variant="exchange" 
              onClick={handleExchangeToUSDT} 
              className="w-full sm:w-auto"
              disabled={!exchangeAmount || parseFloat(exchangeAmount) <= 0 || parseFloat(exchangeAmount) > parseFloat(userBalance.frozen_balance)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Request Exchange
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
