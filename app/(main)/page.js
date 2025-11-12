"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Zap,
  Calendar,
  TrendingUp,
  Sparkles,
  Loader2,
} from "lucide-react";
import GlobalApi from "@/app/_services/GlobalApi";

const getProjectImage = (projectId) => {
  const projectImageMap = {
    1: "/assets/Big River.JPG", 
    2: "/assets/BlueBird.jpg",
    3: "/assets/Bartsonville.JPG",
    4: "/assets/Highland.JPG",
    5: "/assets/Sunlight Road.JPG",
  };
  
  return projectImageMap[projectId] || "/assets/banner-wind-farm.png";
};

const getStatusColor = (status) => {
  switch (status) {
    case "Operating":
      return "bg-green-800 text-white hover:bg-green-600 font-medium";
    case "Construction":
      return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
    case "Development":
      return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
};

const formatDate = (dateString) => {
  if (!dateString || dateString === 'TBD') return 'TBD';
  try {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return 'TBD';
  }
};

export default function LandingPage() {
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const carouselImages = [
    "/assets/banner-wind-farm.png",
    "/assets/project-solar-autumn.png",
    "/assets/project-solar-desert.png",
    "/assets/project-wind.png",
    "/assets/project-solar-construction.png",
    "/assets/project-solar-sheep.png",
  ];

  // Auto-rotate carousel every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [carouselImages.length]);

  // Fetch projects data
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch all projects
        const response = await GlobalApi.getProjectData();
        console.log('Projects data:', response.data);
        
        // Transform the data to match the expected format
        const transformedProjects = response.data.map(project => ({
          id: project.id,
          name: project.name || 'Unnamed Project',
          location: project.location || 'Location not specified',
          address: project.overview?.address || 'Address not available',
          capacity: project.overview?.poi_ac_capacity || 0,
          status: project.status || 'Unknown',
          cod: 'TBD',
          technology: project.technology || 'Renewable Energy',
          investment: '$0M',
          image: getProjectImage(project.id),
          term_conversion_date: project.term_conversion_date || 'TBD',
        }));
        
        setProjects(transformedProjects);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);



  const handleProjectClick = async (projectId) => {
    try {
      setLoading(true);
      setError(false);
      router.push(`/project/${projectId}`);
    } catch (error) {
      console.error('Error navigating to project:', error);
      setError('Failed to navigate to project');
    } finally {
      setLoading(false);
    }
  }
  

  // const handleProjectClick = (projectId) => {
  //   router.push(`/project/${projectId}`);
  // };

  // Calculate totals
  const totalCapacity = projects.reduce((sum, p) => {
    const capacity = p.capacity || 0; // poi_ac_capacity should be a number
    return sum + capacity;
  }, 0);

  const totalInvestment = projects.reduce((sum, p) => {
    const investment = parseFloat(p.investment.replace(/[^\d.]/g, '')) || 0;
    return sum + investment;
  }, 0);

if (loading) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-6">
        
        {/* Rotating module icons */}
        {/* <div className="flex items-center justify-center space-x-4">
          <div className="animate-bounce" style={{ animationDelay: '0s' }}>
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div className="animate-bounce" style={{ animationDelay: '0.2s' }}>
            <MapPin className="h-6 w-6 text-primary" />
          </div>
          <div className="animate-bounce" style={{ animationDelay: '0.4s' }}>
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div className="animate-bounce" style={{ animationDelay: '0.6s' }}>
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
        </div>
        <p className="text-muted-foreground text-lg">Please wait while we load the projects!
        </p> */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <img src="/assets/turbine-bg-removed.gif" alt="Turbine" className="h-24 w-24"></img>
          <p className="text-muted-foreground text-lg">The Dashboard is loading!</p>
        </div>

      </div>
    </div>
  );
}

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-red-500">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50">
        <div className="absolute inset-0 z-0">
          {carouselImages.map((img, index) => (
            <img
              key={index}
              src={img}
              alt={`Renewable Energy Project ${index + 1}`}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                index === currentImageIndex ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/70 to-background/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 p-8 md:p-16 lg:p-20">
          <div className="max-w-3xl space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">
                Portfolio Overview
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight tracking-tight">
                OneView 
                {/* <span className="block text-primary mt-2">Projects</span> */}
              </h1>
              {/* <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
                Explore and manage our portfolio of renewable energy projects
                across North America
              </p> */}
            </div>
          </div>
        </div>
      </div>
      {/* Stats Overview */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <Card className="shadow-md hover:shadow-lg transition-all border-2 hover:border-primary/20">
    <CardContent className="p-6">
      <div className="text-sm text-muted-foreground mb-1">
        Total Projects
      </div>
      <div className="text-3xl font-bold text-primary">
        {projects.length}
      </div>
    </CardContent>
  </Card>

  <Card className="shadow-md hover:shadow-lg transition-all border-2 hover:border-primary/20">
    <CardContent className="p-6">
      <div className="text-sm text-muted-foreground mb-1">
        Total Capacity
      </div>
      <div className="text-3xl font-bold text-primary">
        {totalCapacity} MW
      </div>
    </CardContent>
  </Card>

  <Card className="shadow-md hover:shadow-lg transition-all border-2 hover:border-primary/20">
    <CardContent className="p-6">
      <div className="text-sm text-muted-foreground mb-1">
        Operational
      </div>
      <div className="text-3xl font-bold text-primary">
        {projects.filter((p) => p.status === "Operating").length}
      </div>
    </CardContent>
  </Card>
</div>

      {/* Projects Grid */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">All Projects</h2>
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No projects found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="shadow-md hover:shadow-lg transition-all cursor-pointer group overflow-hidden border-2 hover:border-primary/30"
                onClick={() => handleProjectClick(project.id)}
              >
                <div className="h-48 relative overflow-hidden bg-muted">
                  <img
                    src={project.image}
                    alt={project.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-2">
                      {project.name}
                    </CardTitle>
                    <Badge
                      className={`${getStatusColor(project.status)} flex-shrink-0`}
                    >
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pb-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="line-clamp-1">{project.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Zap className="h-4 w-4 flex-shrink-0" />
                    <span>
                      {project.capacity ? `${Math.round(project.capacity)} MW` : '0 MW'} • {project.technology}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span>Term Conversion Date: {formatDate(project.term_conversion_date)}</span>
                  </div>


                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}