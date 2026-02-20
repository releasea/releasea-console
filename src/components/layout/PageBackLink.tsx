import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageBackLinkProps {
  to: string;
  label?: string;
  className?: string;
}

export function PageBackLink({ to, label = "Back", className }: PageBackLinkProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      asChild
      className={cn("w-fit gap-2 text-muted-foreground hover:text-foreground", className)}
    >
      <Link to={to}>
        <ArrowLeft className="w-4 h-4" />
        {label}
      </Link>
    </Button>
  );
}
