import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { generatePDF } from "@/lib/pdfUtils";

export const ProjectBanner = ({ 
  projectName, 
  status = "Operating",
  solarCapacity = "Solar", 
  projectId = "ID:198274020",
  image
}) => {
  const handleDownloadPDF = async () => {
    try {
      toast.info("Generating PDF...");
      await generatePDF(projectName);
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  return (
    <div className="relative h-56 md:h-64 lg:h-72 rounded-xl overflow-hidden mb-6">
      {/* Banner Image */}
      {image && (
        <img 
          src={image} 
          alt={`${projectName} Banner`} 
          className="w-full h-full object-cover"
        />
      )}
      
      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-transparent" />
      
      {/* Project Info Card */}
      <Card className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-card shadow-lg max-w-[calc(100%-120px)] md:max-w-md rounded-xl">
        <CardContent className="p-3 md:p-5">
          <h2 className="text-lg md:text-2xl font-bold text-foreground mb-2 md:mb-3">{projectName}</h2>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-800 text-white hover:bg-green-600 font-medium">
              {status}
            </Badge>
            <Badge className="bg-yellow-300 text-orange-700 hover:bg-yellow-400 font-medium">
              {solarCapacity}
            </Badge>
            <Badge className="bg-violet-500 text-white hover:bg-violet-600 font-medium">
              {projectId}
            </Badge>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};