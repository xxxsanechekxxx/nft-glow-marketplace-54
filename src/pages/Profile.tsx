import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { User, Settings, Mail, Key, LogOut, Wallet, ArrowUpCircle, ArrowDownCircle, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import WalletAddressModal from "@/components/WalletAddressModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import DepositConfirmationDialog from "@/components/DepositConfirmationDialog";
import FraudWarningDialog from "@/components/FraudWarningDialog";

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'purchase';
  amount: string;
  created_at: string;
  status: 'pending' | 'completed' | 'failed';
  item?: string;
}

interface UserData {
  id: string;
  email: string;
  login: string;
  country: string;
  avatar_url: string | null;
  balance: string;
  wallet_address?: string;
  erc20_address?: string;
}

const Profile = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isDepositConfirmationOpen, setIsDepositConfirmationOpen] = useState(false);
  const [isFraudWarningOpen, setIsFraudWarningOpen] = useState(false);

  const showDelayedToast = (title: string, description: string, variant: "default" | "destructive" = "default") => {
    setTimeout(() => {
      toast({
        title,
        description,
        variant,
      });
    }, 1000);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      showDelayedToast("Success", "Logged out successfully");
      navigate("/");
    } catch (error) {
      showDelayedToast("Error", "Failed to log out", "destructive");
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        console.log("Fetching user data...");
        
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.error("Auth error:", authError);
          throw authError;
        }

        if (!currentUser) {
          console.log("No user found");
          return;
        }

        console.log("Current user:", currentUser);

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', currentUser.id)
          .single();

        if (profileError) {
          console.error("Profile error:", profileError);
          throw profileError;
        }

        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (transactionsError) {
          console.error("Transactions error:", transactionsError);
          throw transactionsError;
        }

        console.log("Profile data:", profileData);
        
        if (isMounted && currentUser) {
          setUserData({
            id: currentUser.id,
            email: currentUser.email || '',
            login: profileData?.login || currentUser.user_metadata?.login || '',
            country: profileData?.country || currentUser.user_metadata?.country || '',
            avatar_url: null,
            balance: profileData?.balance?.toString() || "0.0",
            wallet_address: profileData?.wallet_address || ''
          });

          setTransactions(transactionsData?.map(tx => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount.toString(),
            created_at: new Date(tx.created_at).toISOString().split('T')[0],
            status: tx.status,
            item: tx.item
          })) || []);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        if (isMounted) {
          showDelayedToast("Error", "Failed to fetch user data. Please try again.", "destructive");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const handleGenerateWalletAddress = async (address: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ wallet_address: address })
        .eq('user_id', userData?.id);

      if (error) throw error;

      setUserData(prev => prev ? { ...prev, wallet_address: address } : null);
      
      showDelayedToast("Success", "Wallet address has been generated and saved.");
    } catch (error) {
      console.error("Error saving wallet address:", error);
      showDelayedToast("Error", "Failed to save wallet address. Please try again.", "destructive");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      showDelayedToast("Error", "New passwords do not match", "destructive");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      showDelayedToast("Success", "Password has been updated");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      showDelayedToast("Error", "Failed to update password", "destructive");
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const withdrawAmountNum = parseFloat(withdrawAmount);
    const balanceNum = parseFloat(userData?.balance || "0");
    
    if (withdrawAmountNum <= 0) {
      showDelayedToast("Error", "Please enter a valid amount greater than 0", "destructive");
      return;
    }

    if (withdrawAmountNum > balanceNum) {
      showDelayedToast(
        "Insufficient funds",
        `Your balance (${balanceNum} ETH) is less than the requested withdrawal amount`,
        "destructive"
      );
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .insert([
          {
            user_id: userData?.id,
            type: 'withdraw',
            amount: withdrawAmountNum,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      showDelayedToast(
        "Withdrawal Requested",
        `Your withdrawal request for ${withdrawAmount} ETH has been submitted`
      );
      
      setWithdrawAmount("");
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      showDelayedToast(
        "Error",
        "Failed to process withdrawal. Please try again.",
        "destructive"
      );
    }
  };

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userData?.wallet_address) {
      showDelayedToast(
        "Error",
        "You need to generate a wallet address in your profile first",
        "destructive"
      );
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      showDelayedToast(
        "Error",
        "Please enter a valid amount greater than 0",
        "destructive"
      );
      return;
    }

    setIsDepositConfirmationOpen(true);
  };

  const handleDepositConfirm = (hash: string) => {
    setIsDepositConfirmationOpen(false);
    setIsFraudWarningOpen(true);
    setDepositAmount("");
    
    showDelayedToast(
      "Rejected",
      `Deposit of ${depositAmount} the rejected. Please contact our support team on Telegram for transaction verification`
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 mt-16">
        <div className="max-w-4xl mx-auto">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 mt-16">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-6 p-8 bg-card rounded-lg border shadow-lg hover:shadow-xl transition-shadow duration-300">
          <Avatar className="w-24 h-24 border-2 border-primary/20">
            <AvatarFallback>
              <User className="w-12 h-12 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-foreground">@{userData?.login}</h1>
            <div className="flex items-center gap-2 text-primary">
              <Wallet className="w-5 h-5" />
              <span className="text-lg font-semibold">{userData?.balance} ETH</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="wallet" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Wallet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </label>
                    <Input value={userData?.email} readOnly className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Country
                    </label>
                    <Input value={userData?.country} readOnly className="bg-muted/50" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Wallet Address
                  </label>
                  <div className="flex gap-4 items-start">
                    <div className="flex-grow flex gap-2 items-center">
                      <Input 
                        value={userData?.wallet_address || ''} 
                        readOnly 
                        className="bg-muted/50 font-mono text-sm flex-grow"
                        placeholder="No wallet address generated"
                      />
                      {userData?.wallet_address && (
                        <Input
                          value="ERC-20"
                          readOnly
                          className="bg-muted/50 w-24 text-sm text-center"
                        />
                      )}
                    </div>
                    {!userData?.wallet_address && (
                      <Button
                        onClick={() => setIsWalletModalOpen(true)}
                      >
                        Generate Address
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Current Password
                    </label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">New Password</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confirm New Password</label>
                    <Input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit">Update Password</Button>
                </form>
              </CardContent>
            </Card>

            <div className="mt-6">
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="wallet">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Wallet Operations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button onClick={handleDeposit}>
                          <ArrowDownCircle className="w-4 h-4 mr-2" />
                          Deposit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Deposit ETH</DialogTitle>
                          <DialogDescription>
                            Enter the amount of ETH you want to deposit.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleDeposit} className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Amount (ETH)</label>
                            <Input
                              type="number"
                              step="0.000000000000000001"
                              min="0"
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(e.target.value)}
                              placeholder="0.00"
                              required
                            />
                          </div>
                          <DialogFooter>
                            <Button type="submit">Continue</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive">
                          <ArrowUpCircle className="w-4 h-4 mr-2" />
                          Withdraw
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Withdraw ETH</DialogTitle>
                          <DialogDescription>
                            Enter the amount of ETH you want to withdraw.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleWithdraw} className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Amount (ETH)</label>
                            <Input
                              type="number"
                              step="0.000000000000000001"
                              min="0"
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(e.target.value)}
                              placeholder="0.00"
                              required
                            />
                          </div>
                          <DialogFooter>
                            <Button type="submit">Confirm Withdrawal</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                  {transactions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount (ETH)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>{transaction.created_at}</TableCell>
                            <TableCell className="capitalize">{transaction.type}</TableCell>
                            <TableCell>{transaction.amount}</TableCell>
                            <TableCell className="capitalize">{transaction.status}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No transactions found
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <WalletAddressModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onGenerated={handleGenerateWalletAddress}
      />

      <DepositConfirmationDialog
        isOpen={isDepositConfirmationOpen}
        onClose={() => setIsDepositConfirmationOpen(false)}
        amount={depositAmount}
        onConfirm={handleDepositConfirm}
      />

      <FraudWarningDialog
        isOpen={isFraudWarningOpen}
        onClose={() => setIsFraudWarningOpen(false)}
      />
    </div>
  );
};

export default Profile;
