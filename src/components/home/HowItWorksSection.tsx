
import { Wallet, Star, Shield } from "lucide-react";

const steps = [
  {
    title: "Generate Your Wallet",
    description: "Generate your crypto wallet to start buying and selling NFTs securely on our platform.",
    icon: Wallet
  },
  {
    title: "Choose Your NFTs",
    description: "Browse through our curated collection of unique digital assets and select your favorites.",
    icon: Star
  },
  {
    title: "Make Transactions",
    description: "Buy, sell, or trade NFTs with confidence using our secure blockchain technology.",
    icon: Shield
  }
];

export const HowItWorksSection = () => {
  return (
    <div className="py-32 bg-background/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-purple-500/5 to-pink-500/5"></div>
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px] animate-[pulse_10s_ease-in-out_infinite]"></div>
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[150px] animate-[pulse_12s_ease-in-out_infinite] delay-1000"></div>
      </div>

      <div className="container mx-auto px-4 relative">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-20 bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-pink-500 animate-fade-in drop-shadow-lg py-10">
          How It Works
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {steps.map((step, index) => (
            <div 
              key={index} 
              className="p-8 rounded-2xl bg-background/30 backdrop-blur-xl border border-primary/10 hover:border-primary/30 transition-all duration-700 hover:scale-[1.03] group relative overflow-hidden animate-fade-in"
              style={{ animationDelay: `${index * 300}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              
              <div className="relative z-10">
                <div className="w-24 h-24 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-105 transition-transform duration-700 group-hover:bg-primary/20">
                  <step.icon className="w-12 h-12 text-primary group-hover:rotate-6 transition-all duration-700" />
                </div>
                
                <div className="min-h-[80px] flex items-center justify-center">
                  <h3 className="text-2xl font-semibold text-center mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-pink-500 py-6">
                    {step.title}
                  </h3>
                </div>
                
                <p className="text-muted-foreground text-center text-lg leading-relaxed group-hover:text-primary/80 transition-colors duration-700">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
