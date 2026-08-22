'use client';

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-4 lg:p-8">
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Algo deu errado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ocorreu um erro inesperado. Tente novamente.
          </p>
          <Button variant="destructive" className="mt-6" onClick={reset}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
