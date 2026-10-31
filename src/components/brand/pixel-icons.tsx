import type { ComponentType, SVGProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Home } from 'pixelarticons/react/Home';
import { Sun } from 'pixelarticons/react/Sun';
import { Calendar } from 'pixelarticons/react/Calendar';
import { Inbox } from 'pixelarticons/react/Inbox';
import { Sparkles } from 'pixelarticons/react/Sparkles';
import { CheckboxOn } from 'pixelarticons/react/CheckboxOn';
import { Folder } from 'pixelarticons/react/Folder';
import { Wand } from 'pixelarticons/react/Wand';
import { Notebook } from 'pixelarticons/react/Notebook';
import { Rss } from 'pixelarticons/react/Rss';
import { Grid3x3 } from 'pixelarticons/react/Grid3x3';
import { Briefcase } from 'pixelarticons/react/Briefcase';
import { Heart } from 'pixelarticons/react/Heart';
import { Wallet } from 'pixelarticons/react/Wallet';
import { FileText } from 'pixelarticons/react/FileText';
import { Trophy } from 'pixelarticons/react/Trophy';
import { Clock } from 'pixelarticons/react/Clock';
import { Target } from 'pixelarticons/react/Target';
import { ChartBarBig } from 'pixelarticons/react/ChartBarBig';
import { BookOpen } from 'pixelarticons/react/BookOpen';
import { Script } from 'pixelarticons/react/Script';
import { Robot } from 'pixelarticons/react/Robot';
import { RobotFace } from 'pixelarticons/react/RobotFace';
import { ColorsSwatch } from 'pixelarticons/react/ColorsSwatch';
import { Database } from 'pixelarticons/react/Database';
import { Compass } from 'pixelarticons/react/Compass';
import { Plus } from 'pixelarticons/react/Plus';
import { Menu } from 'pixelarticons/react/Menu';
import { Search } from 'pixelarticons/react/Search';

type PixelIcon = ComponentType<SVGProps<SVGSVGElement>>;

// Ícones pixel do visual Retrô, por destino (href) ou grupo (label) da navegação.
const byKey: Record<string, PixelIcon> = {
  '/': Home, '/hoje': Calendar, '/inbox': Inbox, '/tarefas': CheckboxOn, '/projetos': Folder,
  '/planejar': Wand, '/notas': Notebook, '/content-hub': Rss, '/areas': Grid3x3, '/profissional': Briefcase,
  '/corpo': Heart, '/financeiro': Wallet, '/conteudo': FileText, '/editais': Trophy, '/revisao': Clock,
  '/visao': Target, '/indicadores': ChartBarBig, '/diario': BookOpen, '/diario-bordo': Script,
  '/hermes': RobotFace, '/escritorio': Robot, '/design': ColorsSwatch, '/dados': Database,
  Agora: Sun, Capturar: Inbox, Organizar: Sparkles, 'Áreas': Target, Refletir: Clock, Sistema: Compass,
  plus: Plus, menu: Menu, search: Search,
};

/** Desenha o ícone Lucide do visual Astral e o ícone pixel do Retrô; o CSS
 * mostra só o do visual ativo, então a troca não depende de hidratação. */
export function NavIcon({ icon: Icon, pixel, size }: { icon: LucideIcon; pixel: string; size: number }) {
  const Pixel = byKey[pixel];
  return <>
    <Icon size={size} strokeWidth={1.65} className={Pixel ? 'skin-astral-only' : undefined} aria-hidden />
    {Pixel && <Pixel width={size + 2} height={size + 2} className="skin-retro-only" aria-hidden />}
  </>;
}
