'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// Hardcoded so the star layout is identical on server and client render.
const STARS = [
  [8, 12, 1.4, 0], [22, 6, 1, 0.4], [35, 18, 1.8, 0.8], [48, 4, 1.2, 1.2],
  [61, 22, 1, 1.6], [74, 9, 1.6, 0.2], [88, 16, 1.1, 1.0], [15, 34, 1.3, 1.8],
  [30, 45, 1, 0.6], [44, 38, 1.5, 1.4], [58, 52, 1.2, 0.3], [70, 41, 1, 1.9],
  [83, 48, 1.7, 0.9], [93, 33, 1.1, 1.5], [5, 60, 1, 0.5], [20, 72, 1.4, 1.1],
  [38, 65, 1.1, 1.7], [52, 78, 1.6, 0.1], [66, 68, 1, 1.3], [80, 74, 1.3, 0.7],
  [92, 62, 1.5, 1.6], [12, 88, 1, 0.9], [27, 92, 1.2, 0.2], [45, 85, 1, 1.4],
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Usuário ou senha inválidos.');
        setLoading(false);
        return;
      }
      const from = searchParams.get('from') || '/';
      router.push(from);
      router.refresh();
    } catch {
      setError('Erro de conexão. Tenta de novo.');
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#040614] px-4">
      {/* Starfield backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(139,92,246,0.15),transparent_60%)]" />
        {STARS.map(([x, y, r, delay], i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2 }}
            animate={{ opacity: [0.2, 0.9, 0.2] }}
            transition={{ duration: 3 + (i % 4), repeat: Infinity, delay }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 shadow-[0_0_40px_rgba(139,92,246,0.35)]">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">LIFESYSTEM</h1>
          <p className="mt-1 text-sm text-white/50">Guiado pelos povos das estrelas</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl shadow-2xl"
        >
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="user" className="text-white/70">Usuário</Label>
              <Input
                id="user"
                autoFocus
                autoComplete="username"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                placeholder="jonny"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-white/70">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-critical"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={loading || !user || !password}
              className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? (
                'Entrando...'
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Entrar <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-white/30">
          Ecossistema pessoal — acesso restrito.
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
