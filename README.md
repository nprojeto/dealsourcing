# DealSourcing · Plataforma de Prospecção e Aquisição de ISPs

Produto **NOVALE** (T8 Soluções Ltda.).

Frontend em **Nuxt 4 + Vue 3 + TypeScript**, com identidade visual NOVALE
(marinho `#0D2B5E`, azul `#14268A`, fundo `#F7F9FD`, bordas `#D8DEEC`).
Backend: **Supabase** (banco, autenticação e Edge Function `api`).

## Fases entregues: 1 — Fundação · 2 — Simulador

**Fase 2:** cadastro do provedor (CNPJ e e-mail únicos, CEP automático), código de indicação
(gerado para equipe e parceiros, com link que preenche o código), simulador com 13 campos e
botão SIMULAR AGORA, resultado financeiro visível só à equipe interna, FORMALIZAR INTERESSE
(cria a oportunidade na fila), telas Provedores e Simulações no CRM e editor de parâmetros
com versões imutáveis e teste de cálculo.

### Fase 1

- Portal público com cadastro de proprietário de ISP, parceiro e equipe
- Confirmação de e-mail por código (Brevo), reenvio com intervalo, recuperação de senha
- Login, controle de acesso por perfil e status da conta
- CRM: painel com indicadores reais, usuários e acessos (aprovar, rejeitar, bloquear,
  desativar, reativar, trocar perfil, convidar), configurações, documentos legais (LGPD),
  auditoria e notificações
- Portal externo (proprietário de ISP e parceiro) e "Minha conta"

## Publicação (GitHub Pages)

A publicação é automática a cada envio para a branch `main`
(arquivo `.github/workflows/deploy.yml`).

O endereço do Supabase (`https://nenexsfeqguwprpwvsfn.supabase.co`) e a chave pública
ficam em `nuxt.config.ts`. Variáveis no GitHub são opcionais (`SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `BASE_URL`).

Em **Settings → Pages → Source**, escolher **GitHub Actions**.

> Nunca coloque a Service Role Key, a chave da Brevo ou o CODE_PEPPER no GitHub.
> Esses segredos ficam somente no Supabase (Edge Functions → Secrets).

## Estrutura

```
app/
  assets/css/main.css    identidade visual (tokens, botões, tabelas, formulários)
  components/            logo, ícones, modal, código de 6 dígitos, notificações...
  composables/           Supabase, API, sessão, avisos, configurações públicas
  layouts/               default (site), auth, portal (externo), crm (interno)
  middleware/            controle de acesso por rota
  pages/                 telas
  utils/                 rótulos, formatação, validações (CPF/CNPJ, telefone...)
public/brand/            logotipos e ícones (também usados nos e-mails)
```

## Desenvolvimento local (opcional)

```
npm install
npm run dev
```
