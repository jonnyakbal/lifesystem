'use client';

import { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { AgentSigil, agentSky } from '@/components/brand/sigils';
import { LifeConstellation } from '@/components/brand/constellation';
import { SolarGlyph, SolarMono, Wordmark } from '@/components/brand/marks';
import type { AgentId } from '@/lib/office/schema';
import { SystemMap } from '@/components/brand/system-map';
import {
  AsteroidsArt, CometArt, ConstellationArt, EclipseArt, FuelArt, LaunchWindowArt, LifeSupportArt, LogbookArt,
  OrbitWeekArt, PlanetArt, SatelliteArt, SignalArt, StarsArt, StationArt, SunArt, TelescopeArt,
} from '@/components/brand/illustrations';

// The brand book lives in brand space: always the deep-space surface of the
// approved "Órbita" identity, whatever the app theme, because that is how the
// identity was designed (public/brand/README.md, solar-cover.png).

const ink = '#EDE9FE';
const dim = 'rgba(237,233,254,.66)';

const palette = [
  ['Espaço profundo', '#070A1C', 'O fundo da marca. Silêncio para o que importa aparecer.', '#EDE9FE'],
  ['Nebulosa', '#8B5CF6', 'A cor da marca e das ações. O L e tudo que você aciona.', '#fff'],
  ['Lavanda', '#EDE9FE', 'Luz suave: textos e brilhos sobre o espaço.', '#2E1065'],
  ['Núcleo solar', '#FDE68A', 'O centro. Raro e precioso: conquistas, destaques, o agora.', '#3B2A05'],
  ['Planeta ciano', '#67E8F9', 'Movimento: o que está em curso, ligações, progresso.', '#063A44'],
] as const;

const functional = [
  ['Aurora', '#34D399', 'Concluído, recebido'],
  ['Anã vermelha', '#FB7185', 'Atraso, urgência, erro'],
  ['Poeira estelar', '#A5A3C2', 'Texto secundário'],
] as const;


const universe: [(p: { size?: number }) => React.ReactElement, string, string, string][] = [
  [SunArt, 'Núcleo', 'Visão', 'Você e o seu porquê. Tudo gira em volta.'],
  [ConstellationArt, 'Constelações', 'Pilares', 'As áreas da vida que dão sentido ao céu: carreira, saúde, relações.'],
  [PlanetArt, 'Planetas', 'Projetos', 'Corpos com massa própria, ligados a um pilar. Crescem com o trabalho.'],
  [SatelliteArt, 'Satélites', 'Ferramentas', 'Agenda, Financeiro, Conteúdo, Notas, Fontes, Arco Leads: orbitam e servem os projetos.'],
  [StarsArt, 'Estrelas', 'Tarefas', 'Pontos de luz. Apagadas esperam um passo; concluídas acendem.'],
  [CometArt, 'Cometas', 'Caixa de entrada', 'Ideias que chegam de fora, rápidas. Capture antes que passem.'],
  [AsteroidsArt, 'Cinturão', 'Tarefas soltas', 'Sem projeto nem pilar. Vale dar uma órbita a elas.'],
  [OrbitWeekArt, 'Órbita', 'Planejar e Hoje', 'O percurso da semana: cada dia é um ponto do caminho.'],
  [EclipseArt, 'Eclipse', 'Dependências', 'Uma tarefa que encobre outra até ser resolvida.'],
  [LaunchWindowArt, 'Janela de lançamento', 'Editais', 'Oportunidade com prazo para decolar.'],
  [FuelArt, 'Combustível', 'Financeiro', 'O que mantém a missão em voo. O satélite Financeiro mede o tanque.'],
  [LifeSupportArt, 'Suporte de vida', 'Corpo & saúde', 'Sono, água, movimento: o que mantém a tripulação de pé.'],
  [StationArt, 'Estação orbital', 'Escritório', 'A base de onde a tripulação trabalha com você.'],
  [LogbookArt, 'Diário de bordo', 'Diário', 'O registro da viagem: o que viveu, decidiu e aprendeu.'],
  [TelescopeArt, 'Telescópio', 'Revisão e Metas', 'Olhar o céu de longe para medir o caminho.'],
  [SignalArt, 'Sinais', 'Fontes e avisos', 'O que chega de fora: notícias, alertas, mensagens.'],
];

const crew: [AgentId, string, string][] = [
  ['hermes', 'Hermes', '#e2d5bd'], ['vega', 'Vega', '#d8ac64'], ['sirius', 'Sirius', '#8dbdcd'],
  ['orion', 'Órion', '#99b99a'], ['astro', 'Astro', '#b5a0cd'], ['cosmo', 'Cosmo', '#df967b'],
];

function Starfield({ count = 70, seed = 1 }: { count?: number; seed?: number }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 600" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const x = ((i + seed) * 379.7) % 1000;
        const y = ((i + seed) * 211.3) % 600;
        return <circle key={i} cx={x} cy={y} r={i % 9 === 0 ? 1.6 : 0.8} fill={ink} opacity={0.15 + (i % 6) * 0.08} />;
      })}
    </svg>
  );
}

function Chapter({ n, title, kicker, children }: { n: string; title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`brand-${n}`} className="relative border-t border-white/10 px-6 py-14 sm:px-12">
      <p className="font-mono text-xs tracking-[0.3em]" style={{ color: '#FDE68A' }}>{n}</p>
      <h2 id={`brand-${n}`} className="mt-2 font-display text-3xl sm:text-4xl" style={{ color: ink }}>{title}</h2>
      {kicker && <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: dim }}>{kicker}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function BrandBook() {
  const [lit, setLit] = useState(false);
  return (
    <div className="relative mb-12 overflow-hidden rounded-[28px] border border-white/10" style={{ background: 'radial-gradient(120% 80% at 70% 20%, #1B2152 0%, #0B1030 45%, #070A1C 100%)', color: ink }}>
      {/* Abertura */}
      <header className="relative grid min-h-[520px] items-center gap-10 px-6 py-16 sm:px-12 lg:grid-cols-[1.1fr_1fr]">
        <Starfield />
        <svg className="pointer-events-none absolute -right-40 top-0 h-full w-[900px] opacity-60" viewBox="0 0 900 600" aria-hidden="true">
          <ellipse cx="560" cy="300" rx="420" ry="190" transform="rotate(-18 560 300)" fill="none" stroke="#C4B5FD" strokeOpacity=".18" />
          <ellipse cx="560" cy="300" rx="300" ry="260" transform="rotate(24 560 300)" fill="none" stroke="#8B5CF6" strokeOpacity=".22" />
          <circle cx="905" cy="170" r="9" fill="#67E8F9" /><circle cx="300" cy="520" r="6" fill="#FDE68A" />
        </svg>
        <div className="relative">
          <p className="font-mono text-xs tracking-[0.3em]" style={{ color: dim }}>ÓRBITA · IDENTIDADE ASTRAL</p>
          <Wordmark className="mt-6 block text-4xl sm:text-6xl" />
          <p className="mt-4 font-display text-2xl italic sm:text-3xl" style={{ color: dim }}>Seu universo, em movimento.</p>
          <span className="mt-6 block h-[3px] w-20 rounded-full" style={{ background: '#FDE68A' }} />
          <p className="mt-8 max-w-xl text-lg leading-relaxed" style={{ color: ink }}>
            Toda vida tem um centro. Em volta dele giram as coisas que importam — corpo, trabalho, gente, sonhos.
            O LifeSystem existe para que esse movimento tenha direção: um passo de cada vez, cada um acendendo uma estrela.
          </p>
        </div>
        <div className="relative mx-auto">
          <div className="absolute inset-0 -z-0 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(139,92,246,.45), transparent 65%)' }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/solar.svg" alt="Símbolo LifeSystem: L solar" width={300} height={300} className="relative w-56 drop-shadow-2xl sm:w-[300px]" />
        </div>
      </header>

      <Chapter n="01" title="A ideia" kicker="A marca é um pequeno sistema solar. Três partes, três significados — e é exatamente o que o app faz por você.">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['O núcleo', 'Você e o seu porquê. O sol dourado no centro: é em volta dele que tudo se organiza.', <svg key="c" viewBox="0 0 80 80" className="h-20 w-20"><circle cx="40" cy="40" r="26" fill="#FDE68A" opacity=".2" /><circle cx="40" cy="40" r="15" fill="#FDE68A" /></svg>],
            ['As órbitas', 'Seus projetos e rotinas em movimento. Cada um no próprio caminho, todos ligados ao mesmo centro.', <svg key="o" viewBox="0 0 80 80" className="h-20 w-20"><ellipse cx="40" cy="40" rx="34" ry="14" transform="rotate(-20 40 40)" fill="none" stroke="#C4B5FD" strokeWidth="2" /><circle cx="70" cy="30" r="5" fill="#67E8F9" /><circle cx="40" cy="40" r="6" fill="#FDE68A" /></svg>],
            ['O L', 'A direção. A linha desce, assenta no chão e segue em frente: decidir, firmar, avançar.', <svg key="l" viewBox="0 0 80 80" className="h-20 w-20"><path d="M24 14v38c0 7 4 11 11 11h24" stroke="#A78BFA" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>],
          ].map(([t, d, art]) => (
            <div key={String(t)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              {art}
              <p className="mt-4 font-display text-xl">{t}</p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: dim }}>{d}</p>
            </div>
          ))}
        </div>
      </Chapter>


      <Chapter n="02" title="O universo" kicker="O LifeSystem inteiro é um céu. Você está no centro; seus projetos são planetas em órbita, as ferramentas são satélites que os servem, os pilares desenham constelações ao fundo. É a mesma lógica do mapa estelar do Escritório.">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-2 sm:p-4"><SystemMap /></div>
      </Chapter>

      <Chapter n="03" title="Glossário do céu" kicker="Cada parte do sistema tem um corpo celeste, um significado e uma ilustração. As ilustrações formam a biblioteca usada em estados vazios, aberturas e cabeçalhos de cada módulo.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {universe.map(([Art, object, where, meaning]) => (
            <div key={object} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid h-24 place-items-center rounded-xl bg-black/30"><Art size={120} /></div>
              <p className="mt-3 font-display text-lg">{object}</p>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#67E8F9' }}>{where}</p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: dim }}>{meaning}</p>
            </div>
          ))}
        </div>
      </Chapter>

      <Chapter n="04" title="O símbolo" kicker="O L solar aprovado é o ícone do app. Para cada tamanho e fundo, uma versão — sempre a mesma geometria.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <figure className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/solar.svg" alt="" width={112} height={112} className="mx-auto" />
            <figcaption className="mt-3 text-sm">Ícone completo<br /><span className="text-xs" style={{ color: dim }}>App, instalação, capa</span></figcaption>
          </figure>
          <figure className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
            <div className="mx-auto w-fit"><SolarMono size={112} color="#A78BFA" title="Símbolo em uma cor" /></div>
            <figcaption className="mt-3 text-sm">Uma cor<br /><span className="text-xs" style={{ color: dim }}>Impressão, carimbo, marca d’água</span></figcaption>
          </figure>
          <figure className="rounded-2xl border border-white/10 p-6 text-center" style={{ background: '#F5F3FF' }}>
            <div className="mx-auto w-fit"><SolarMono size={112} color="#5B21B6" title="Símbolo em fundo claro" /></div>
            <figcaption className="mt-3 text-sm" style={{ color: '#2E1065' }}>Fundo claro<br /><span className="text-xs opacity-70">Tema claro, documentos</span></figcaption>
          </figure>
          <figure className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
            <div className="flex items-end justify-center gap-4" style={{ color: '#A78BFA' }}><SolarGlyph size={16} /><SolarGlyph size={24} /><SolarGlyph size={32} /><SolarGlyph size={48} /></div>
            <figcaption className="mt-6 text-sm">Pequeno<br /><span className="text-xs" style={{ color: dim }}>16–48 px: só o L e o núcleo</span></figcaption>
          </figure>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {['Não distorcer nem girar o símbolo', 'Não trocar o violeta do L por outra cor', 'Não aplicar sobre fotos ou fundos agitados'].map(t => (
            <p key={t} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm"><X className="h-4 w-4 shrink-0" style={{ color: '#FB7185' }} />{t}</p>
          ))}
        </div>
      </Chapter>

      <Chapter n="05" title="Logotipo" kicker="Símbolo + nome em Fraunces espaçada. O nome em caixa alta, a frase em itálico: estrutura e alma juntas.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-black/30 p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/solar.svg" alt="" width={72} height={72} />
            <div><Wordmark className="block text-2xl sm:text-3xl" /><p className="font-display italic" style={{ color: dim }}>Seu universo, em movimento.</p></div>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 p-8 text-center" style={{ background: '#F5F3FF', color: '#1E1B4B' }}>
            <SolarMono size={64} color="#5B21B6" />
            <Wordmark className="text-2xl" />
          </div>
        </div>
      </Chapter>

      <Chapter n="06" title="Paleta" kicker="Cinco cores de marca com papel definido, e três funcionais que significam sempre a mesma coisa.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {palette.map(([name, hex, use, fg]) => (
            <div key={name} className="flex min-h-48 flex-col justify-between rounded-2xl border border-white/10 p-5" style={{ background: hex, color: fg }}>
              <p className="font-display text-xl">{name}</p>
              <div><p className="text-xs leading-relaxed opacity-90">{use}</p><p className="mt-2 font-mono text-xs opacity-80">{hex}</p></div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {functional.map(([name, hex, use]) => (
            <div key={name} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <span className="h-10 w-10 rounded-xl" style={{ background: hex }} />
              <div><p className="text-sm font-semibold">{name} <span className="font-mono text-xs" style={{ color: dim }}>{hex}</span></p><p className="text-xs" style={{ color: dim }}>{use}</p></div>
            </div>
          ))}
        </div>
      </Chapter>

      <Chapter n="07" title="Tipografia" kicker="Duas vozes que se completam.">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
            <p className="font-mono text-xs" style={{ color: '#FDE68A' }}>ALMA · FRAUNCES</p>
            <p className="mt-3 font-display text-5xl leading-tight">Seu dia em órbita</p>
            <p className="mt-2 font-display text-2xl italic" style={{ color: dim }}>“Clareza também é uma forma de cuidado.”</p>
            <p className="mt-3 text-sm" style={{ color: dim }}>Títulos, aberturas e frases. Expressiva, humana, com curvas.</p>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="font-mono text-xs" style={{ color: '#67E8F9' }}>SISTEMA · INTER</p>
              <p className="mt-3 text-xl font-semibold">Revisar proposta comercial</p>
              <p className="mt-1 text-sm" style={{ color: dim }}>Tudo que se lê e se usa: tarefas, botões, campos.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="font-mono text-xs" style={{ color: '#A78BFA' }}>INSTRUMENTOS · JETBRAINS MONO</p>
              <p className="mt-3 font-mono text-xl tabular-nums">R$ 3.000 · 07/10 · 12:15</p>
            </div>
          </div>
        </div>
      </Chapter>

      <Chapter n="08" title="A tripulação" kicker="Cada agente é uma constelação. Os nomes vêm do céu — e o desenho também, quando o céu permite.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {crew.map(([id, name, color]) => (
            <div key={id} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl" style={{ background: `radial-gradient(circle, ${color}22, transparent 70%)` }}>
                <AgentSigil agent={id} color={color} size={64} title={`Constelação de ${name}`} />
              </div>
              <div>
                <p className="font-display text-xl" style={{ color }}>{name}</p>
                <p className="text-xs uppercase tracking-wider" style={{ color: dim }}>{agentSky[id].role}</p>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: dim }}>{agentSky[id].meaning}</p>
              </div>
            </div>
          ))}
        </div>
      </Chapter>

      <Chapter n="09" title="Sua constelação" kicker="A ilustração da marca é feita dos seus dados. Cada projeto é um planeta; cada tarefa concluída acende uma estrela em volta dele e se liga às outras. O desenho cresce com você.">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4">
          <LifeConstellation pillars={[
            { name: 'Site Arco Labs', color: '#67E8F9', done: lit ? 7 : 5, open: 3 },
            { name: 'Treino', color: '#34D399', done: lit ? 5 : 3, open: 2 },
            { name: 'Casamento', color: '#FDE68A', done: 2, open: 2 },
            { name: 'TCC', color: '#A78BFA', done: 4, open: 3 },
          ]} />
          <button type="button" onClick={() => setLit(v => !v)} className="absolute bottom-4 right-4 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium" style={{ background: '#8B5CF6', color: '#fff' }}>
            <Sparkles className="h-4 w-4" />{lit ? 'Voltar' : 'Concluir 4 tarefas'}
          </button>
        </div>
      </Chapter>

      <Chapter n="10" title="Voz" kicker="Fala como alguém que está do seu lado: calma, direta, nunca culpa. Frases curtas. Nenhum jargão técnico.">
        <div className="grid gap-3 md:grid-cols-3">
          {['Um passo de cada vez.', 'Ideias ganham forma quando encontram espaço.', 'Clareza também é uma forma de cuidado.'].map(t => (
            <blockquote key={t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 font-display text-xl italic">“{t}”</blockquote>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[['“3 tarefas esperam um novo passo.”', '“Você tem 3 tarefas ATRASADAS!”'], ['“Feito. Desfazer?”', '“Operação realizada com sucesso.”']].map(([good, bad]) => (
            <div key={good} className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <p className="flex items-center gap-2"><Check className="h-4 w-4" style={{ color: '#34D399' }} />{good}</p>
              <p className="flex items-center gap-2" style={{ color: dim }}><X className="h-4 w-4" style={{ color: '#FB7185' }} />{bad}</p>
            </div>
          ))}
        </div>
      </Chapter>

      <Chapter n="11" title="Movimento" kicker="Lento como uma órbita, nunca nervoso. O movimento celebra uma conclusão ou mostra uma mudança — e desliga quando você pede menos movimento.">
        <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-white/10 bg-black/30 p-6">
          <button type="button" onClick={() => setLit(v => !v)} aria-pressed={lit} className="inline-flex min-h-11 items-center gap-3 rounded-full border border-white/15 px-5 text-sm">
            <span className={`relative grid h-6 w-6 place-items-center`}>
              <span className="absolute inset-0 rounded-full" style={{ background: lit ? 'rgba(253,230,138,.35)' : 'transparent', transition: 'all .4s ease' }} />
              <svg viewBox="0 0 24 24" className="relative h-5 w-5" style={{ transition: 'transform .5s cubic-bezier(.2,.8,.2,1)', transform: lit ? 'scale(1.15) rotate(45deg)' : 'scale(.8)' }}><path d="M12 2Q12 12 22 12Q12 12 12 22Q12 12 2 12Q12 12 12 2Z" fill={lit ? '#FDE68A' : '#64748b'} /></svg>
            </span>
            {lit ? 'Estrela acesa' : 'Concluir e acender'}
          </button>
          <p className="max-w-md text-sm" style={{ color: dim }}>Concluir acende uma estrela (0,4 s). Abrir um painel desliza. Nada pisca, nada fica girando sobre seus dados.</p>
        </div>
      </Chapter>

      <Chapter n="12" title="Aplicações" kicker="Como a marca aparece no produto.">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 p-6 text-center" style={{ background: '#070A1C' }}>
            <Starfield count={30} seed={3} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/solar.svg" alt="" width={64} height={64} className="relative mx-auto" />
            <Wordmark className="relative mt-3 block text-lg" />
            <div className="relative mt-5 space-y-2 text-left text-sm">
              <div className="rounded-xl border border-white/15 px-3 py-2.5" style={{ color: dim }}>Usuário</div>
              <div className="rounded-xl border border-white/15 px-3 py-2.5" style={{ color: dim }}>Senha</div>
              <div className="rounded-xl px-3 py-2.5 text-center font-medium" style={{ background: '#8B5CF6' }}>Entrar no seu universo</div>
            </div>
            <p className="relative mt-3 text-xs" style={{ color: dim }}>Login</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <svg viewBox="0 0 120 80" className="mx-auto h-24 w-36" aria-hidden="true"><ellipse cx="60" cy="42" rx="52" ry="18" fill="none" stroke="#C4B5FD" strokeOpacity=".35" /><circle cx="60" cy="42" r="10" fill="#FDE68A" /><circle cx="110" cy="38" r="4" fill="#67E8F9" /><path d="M20 20Q20 26 26 26Q20 26 20 32Q20 26 14 26Q20 26 20 20Z" fill="#EDE9FE" opacity=".7" /></svg>
            <p className="mt-3 font-display text-xl">Céu limpo por hoje</p>
            <p className="mt-1 text-sm" style={{ color: dim }}>Nenhuma tarefa para agora. Que tal escolher a próxima?</p>
            <p className="mt-4 text-xs" style={{ color: dim }}>Estado vazio</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 p-4" style={{ background: '#11183A' }}>
              <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0"><path d="M12 2Q12 12 22 12Q12 12 12 22Q12 12 2 12Q12 12 12 2Z" fill="#FDE68A" /></svg>
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">Estrela acesa</p><p className="text-xs" style={{ color: dim }}>“Revisar proposta” concluída</p></div>
              <span className="text-sm" style={{ color: '#A78BFA' }}>Desfazer</span>
            </div>
            <p className="mt-4 text-xs" style={{ color: dim }}>Aviso de conclusão</p>
          </div>
        </div>
      </Chapter>
    </div>
  );
}
