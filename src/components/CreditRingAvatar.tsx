import { User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CreditRingAvatarProps {
  onClick: () => void;
  maxCredits?: number;
}

const CreditRingAvatar = ({ onClick, maxCredits = 2000 }: CreditRingAvatarProps) => {
  const { user, credits } = useAuth();
  const size = 34;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(credits / maxCredits, 1);
  const offset = circumference - ratio * circumference;

  return (
    <button onClick={onClick} className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth={strokeWidth}
          opacity={0.4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{ filter: "drop-shadow(0 0 4px hsl(var(--primary) / 0.5))" }}
        />
      </svg>
      <div className="w-[26px] h-[26px] rounded-full bg-secondary flex items-center justify-center overflow-hidden">
        {user?.user_metadata?.avatar_url ? (
          <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" alt="" />
        ) : (
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </div>
    </button>
  );
};

export default CreditRingAvatar;
