/** Vídeos tutoriais (pasta public/tutoriais). Rota do menu → arquivo e título. */
export const TUTORIALS: { route: string; slug: string; title: string; exact?: boolean }[] = [
  { route: '/crm', slug: 'painel', title: 'Painel', exact: true },
  { route: '/crm/relatorios', slug: 'painel-gerencial', title: 'Painel gerencial' },
  { route: '/crm/agenda', slug: 'agenda', title: 'Agenda' },
  { route: '/crm/desempenho', slug: 'meu-desempenho', title: 'Meu desempenho' },
  { route: '/notificacoes', slug: 'notificacoes', title: 'Notificações' },
  { route: '/crm/oportunidades', slug: 'funil-comercial', title: 'Funil comercial' },
  { route: '/crm/apeltrys', slug: 'apeltrys-analytical-map', title: 'Apeltrys Analytical Map' },
  { route: '/crm/provedores', slug: 'provedores', title: 'Provedores' },
  { route: '/crm/simulacoes', slug: 'simulacoes', title: 'Simulações' },
  { route: '/crm/comissoes', slug: 'comissoes', title: 'Comissões' },
  { route: '/crm/equipe', slug: 'equipe-e-parceiros', title: 'Equipe e parceiros' },
  { route: '/crm/usuarios', slug: 'usuarios-e-acessos', title: 'Usuários e acessos' },
  { route: '/crm/simulador', slug: 'parametros-do-simulador', title: 'Parâmetros do simulador' },
  { route: '/crm/configuracoes', slug: 'configuracoes', title: 'Configurações' },
  { route: '/crm/auditoria', slug: 'auditoria', title: 'Auditoria' },
  { route: '/minha-conta', slug: 'minha-conta', title: 'Minha conta' },
]
export function tutorialFor(path: string) {
  return TUTORIALS.find((t) => (t.exact ? path === t.route : path === t.route || path.startsWith(`${t.route}/`))) ?? null
}
