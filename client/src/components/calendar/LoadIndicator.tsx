import { cn } from "@/lib/utils";

interface LoadIndicatorProps {
  status: 'available' | 'moderate' | 'busy' | 'full';
  percentage: number;
}

export default function LoadIndicator({ status, percentage }: LoadIndicatorProps) {
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div 
        className={cn(
          "load-indicator h-full", 
          status === 'available' && "bg-status-available",
          status === 'moderate' && "bg-status-moderate",
          status === 'busy' && "bg-status-busy",
          status === 'full' && "bg-status-full"
        )} 
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
}
