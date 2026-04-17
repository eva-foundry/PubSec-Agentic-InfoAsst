import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Compass, Home, MessageSquare } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center py-12">
      <div className="relative">
        <div aria-hidden className="absolute inset-0 -m-8 rounded-full bg-gradient-glow blur-2xl opacity-70" />
        <div className="relative h-16 w-16 mx-auto rounded-2xl bg-gradient-accent grid place-items-center shadow-elegant">
          <Compass className="h-8 w-8 text-white" />
        </div>
      </div>
      <div className="mt-8">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{t("notFound.errorTag")}</div>
        <h1 className="mt-2 text-4xl sm:text-5xl font-extrabold gradient-text">{t("notFound.title")}</h1>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto">
          {t("notFound.subtitle", { path: location.pathname })}
        </p>
      </div>
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Button asChild className="bg-gradient-accent shadow-elegant">
          <Link to="/"><Home className="mr-2 h-4 w-4" />{t("notFound.goHome")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/chat"><MessageSquare className="mr-2 h-4 w-4" />{t("notFound.goChat")}</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
