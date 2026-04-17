import { useTranslation } from "react-i18next";
import { Languages, Check } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCustomizer, Lang } from "@/contexts/ThemeCustomizer";
import { SUPPORTED_LANGS } from "@/lib/i18n";
import { useEffect } from "react";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { lang, setLang } = useCustomizer();

  // Keep i18next in sync with the customizer-stored lang.
  useEffect(() => {
    if (i18n.language !== lang) i18n.changeLanguage(lang);
  }, [lang, i18n]);

  const choose = (code: Lang) => {
    setLang(code);
    i18n.changeLanguage(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("topbar.selectLanguage")}>
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => choose(l.code as Lang)}
            className="flex items-center justify-between gap-3"
          >
            <span>{l.label}</span>
            {lang === l.code && <Check className="h-3.5 w-3.5 text-product" aria-label="selected" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
