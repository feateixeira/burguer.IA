import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <div className="text-center px-4 max-w-md w-full">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 rounded-full p-8 border border-primary/20">
              <FileQuestion className="h-24 w-24 text-primary" />
            </div>
          </div>
        </div>
        
        <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mb-4">
          404
        </h1>
        
        <h2 className="text-2xl font-semibold text-foreground mb-3">
          Página não encontrada
        </h2>
        
        <p className="text-muted-foreground mb-8 text-lg">
          A página que você está procurando não existe ou foi movida.
        </p>
        
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/auth">
            Voltar ao Login
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
