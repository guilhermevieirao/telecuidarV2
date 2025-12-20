import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Renderizar todas as rotas no servidor (SSR)
  // Isso evita problemas com chamadas API durante pré-renderização
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
