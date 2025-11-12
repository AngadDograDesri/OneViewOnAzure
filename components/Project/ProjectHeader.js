import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const ProjectHeader = ({ projectName }) => {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">{projectName}</h1>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Download className="mr-2 h-4 w-4" />
          Download Now
        </Button>
      </div>
    </div>
  );
};


