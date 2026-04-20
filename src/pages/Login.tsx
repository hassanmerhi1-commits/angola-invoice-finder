import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useERP';
import { useCompanyLogo } from '@/hooks/useCompanyLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Shield } from 'lucide-react';
import { z } from 'zod';
import defaultLogo from '/icon.png?url';
...
          <div className="mx-auto w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-8 shadow-xl overflow-hidden">
            <img src={logo || defaultLogo} alt={companyName} className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-4xl font-extrabold mb-3 tracking-tight">{companyName}</h1>
...
          <div className="lg:hidden text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-glow overflow-hidden">
              <img src={logo || defaultLogo} alt={companyName} className="w-10 h-10 object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold text-gradient">{companyName}</h1>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Bem-vindo de volta</h2>
            <p className="text-muted-foreground text-sm mt-1">Entre para continuar no sistema</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-semibold">Utilizador</Label>
              <Input
                id="username"
                type="text"
                placeholder="Introduza o seu utilizador"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`h-11 rounded-xl ${errors.username ? 'border-destructive' : ''}`}
                autoComplete="username"
              />
              {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`h-11 rounded-xl ${errors.password ? 'border-destructive' : ''}`}
                autoComplete="current-password"
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl text-sm font-bold gradient-primary shadow-glow" disabled={isLoading}>
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2 font-semibold">Demo — Credenciais de teste:</p>
              <div className="space-y-1 text-xs">
                <p><span className="font-bold text-foreground">Admin:</span> <span className="font-mono text-primary">admin</span></p>
                <p><span className="font-bold text-foreground">Caixa:</span> <span className="font-mono text-primary">caixa1</span></p>
                <p className="text-muted-foreground">(qualquer senha)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
