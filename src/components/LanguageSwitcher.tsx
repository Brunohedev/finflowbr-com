import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/i18n/LanguageContext";
import { LANGUAGES } from "@/i18n/translations";

interface LanguageSwitcherProps {
  variant?: "icon" | "compact";
  className?: string;
}

const LanguageSwitcher = ({ variant = "icon", className }: LanguageSwitcherProps) => {
  const { language, setLanguage, t } = useLanguage();
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === "icon" ? "icon" : "sm"}
          className={className}
          aria-label={t("Selecionar idioma")}
          title={t("Idioma")}
        >
          {variant === "icon" ? (
            <span className="text-lg leading-none">{current.flag}</span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm">
              <span className="text-base leading-none">{current.flag}</span>
              <Globe className="w-3.5 h-3.5 opacity-70" />
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`flex items-center gap-2 cursor-pointer ${
              lang.code === language ? "font-semibold" : ""
            }`}
          >
            <span className="text-base leading-none">{lang.flag}</span>
            <span className="flex-1">{lang.label}</span>
            {lang.code === language && <span className="text-primary text-xs">●</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
