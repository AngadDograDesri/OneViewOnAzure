"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Bell, Filter, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import GlobalApi from "@/app/_services/GlobalApi";
import { useAuth } from "@/app/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";


export const Header = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedTechnology, setSelectedTechnology] = useState([]);
  const [projects, setProjects] = useState([]); // ✅ Changed: Now state instead of const
  const [loading, setLoading] = useState(true); // ✅ New: Loading state

  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        const response = await GlobalApi.getProjectData();
        setProjects(response.data);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  const statuses = ["Operational", "Construction", "Development"];
  const technologies = ["Solar PV", "Wind", "Hybrid"];

  const toggleFilter = (value, currentFilters, setFilters) => {
    if (currentFilters.includes(value)) {
      setFilters(currentFilters.filter((f) => f !== value));
    } else {
      setFilters([...currentFilters, value]);
    }
  };

  const clearAllFilters = () => {
    setSelectedStatus([]);
    setSelectedTechnology([]);
  };

  const hasActiveFilters = selectedStatus.length > 0 || selectedTechnology.length > 0;

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.technology.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = selectedStatus.length === 0 || selectedStatus.includes(project.status);
    const matchesTechnology = selectedTechnology.length === 0 || selectedTechnology.includes(project.technology);

    return matchesSearch && matchesStatus && matchesTechnology;
  });

  const handleProjectSelect = (project) => {
    router.push(`/project/${project.id}`);
    setSearchQuery("");
    setOpen(false);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setOpen(false);
  };

  // Logo Click goes to Home Page
  const handleLogoClick = () => {
    router.push("/");
  }

  return (
    <header className="flex h-16 items-center border-b border-border bg-card px-3 md:px-6">
      <button
        onClick={handleLogoClick}
        className="cursor-pointer hover:opacity-80 transition-opacity"
        aria-label="Go to Portfolio Overview"
      >
        <img src="/assets/oneview-logo.png" alt="OneView" className="h-6 md:h-8 flex-shrink-0" />
      </button>
      

      <div className="flex items-center gap-2 md:gap-3 flex-1 justify-center max-w-2xl mx-auto">
        {/* Search */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search a project name..."
                className="pl-10 pr-10 text-foreground"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value.slice(0, 100));
                  setOpen(e.target.value.length > 0);
                }}
                onFocus={() => searchQuery.length > 0 && setOpen(true)}
                disabled={loading}
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="center">
            <Command>
              <CommandList>
                {loading ? (
                  // ✅ New: Loading state
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Loading projects...
                  </div>
                ) : filteredProjects.length > 0 ? (
                  <CommandGroup heading="Projects">
                    {filteredProjects.map((project) => (
                      <CommandItem
                        key={project.id} // ✅ Changed: Use project.id
                        onSelect={() => handleProjectSelect(project)}
                        className="cursor-pointer group"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="font-medium group-hover:text-white">{project.name}</div>
                          <div className="text-xs text-muted-foreground group-hover:text-white">
                            {project.location} • {project.technology}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : (
                  <CommandEmpty>No projects found.</CommandEmpty>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Filter Button */}
        {/* Status Filter */}
        {/* Technology Filter */}
        {/* <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={`flex-shrink-0 relative ${hasActiveFilters ? "border-primary" : ""}`}
            >
              <Filter className="h-4 w-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                  {selectedStatus.length + selectedTechnology.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-card z-50" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Filters</h4>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearAllFilters}>
                    Clear all
                  </Button>
                )}
              </div>

              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="space-y-2">
                  {statuses.map((status) => (
                    <div
                      key={status}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-primary/10 p-2 rounded-md transition-colors"
                      onClick={() => toggleFilter(status, selectedStatus, setSelectedStatus)}
                    >
                      <div
                        className={`h-4 w-4 border rounded flex items-center justify-center ${selectedStatus.includes(status) ? "bg-primary border-primary" : "border-input"
                          }`}
                      >
                        {selectedStatus.includes(status) && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-sm">{status}</span>
                    </div>
                  ))}
                </div>
              </div>

              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Technology</label>
                <div className="space-y-2">
                  {technologies.map((tech) => (
                    <div
                      key={tech}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-primary/10 p-2 rounded-md transition-colors"
                      onClick={() => toggleFilter(tech, selectedTechnology, setSelectedTechnology)}
                    >
                      <div
                        className={`h-4 w-4 border rounded flex items-center justify-center ${selectedTechnology.includes(tech) ? "bg-primary border-primary" : "border-input"
                          }`}
                      >
                        {selectedTechnology.includes(tech) && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-sm">{tech}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover> */}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        <img src="/assets/desri-logo-black.png" alt="DESRI" className="h-7 md:h-9 hidden lg:block mr-2" />

        {/* <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-foreground" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary"></span>
        </Button> */}

        {/* Submit Feedback Button */}
                <Button 
          variant="default" 
          size="sm"
          onClick={() => window.open('https://forms.office.com/r/hCRvN9aZbj', '_blank')}
          className="flex-shrink-0 bg-yellow-500 text-black hover:bg-yellow-600 font-semibold"
        >
          Submit Issue
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="relative h-10 w-10 rounded-full border-2 border-transparent hover:bg-accent/50 hover:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus:ring-0 focus:outline-none focus:border-transparent active:ring-0 active:outline-none active:border-transparent data-[state=open]:border-transparent data-[state=open]:ring-0 data-[state=open]:outline-none data-[state=open]:shadow-none transition-colors [&>*]:text-primary-foreground hover:[&>*]:text-primary-foreground"
              style={{ transform: 'none', outline: 'none' }}
            >
              <Avatar className="h-10 w-10 pointer-events-none border-0">
                <AvatarFallback className="bg-primary text-primary-foreground border-0 outline-none">
                  {user?.name
                    ? user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : user?.email
                    ? user.email[0].toUpperCase()
                    : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || 'No email'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* <DropdownMenuItem>Profile Settings</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem> */}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive cursor-pointer" 
              onClick={logout}
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
