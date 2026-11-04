# DealSourcing · Plataforma de Prospecção e Aquisição de ISPs

Produto **NOVALE** (T8 Soluções Ltda.).

Frontend em **Nuxt 4 + Vue 3 + TypeScript**, com identidade visual NOVALE
(marinho `#0D2B5E`, azul `#14268A`, fundo `#F7F9FD`, bordas `#D8DEEC`).
Backend: **Supabase** (banco, autenticação e Edge Function `api`).

## Fases entregues: 1 a 7 (Fundação, Simulador, Equipe e parceiros, CRM e funil, Reuniões, Comissões, Painel e relatórios)

**Fase 7:** Painel gerencial (admin e gestores) com indicadores de captação, atendimento e resultado,
pipeline estimado, evolução mensal/semanal, funil com taxa de conversão entre etapas, distribuição por
região, estado e origem, motivos de perda, desempenho da equipe e dos parceiros; filtros por período,
região, estado, cidade, responsável, indicação, etapa e origem (guardados no endereço da página);
exportação de oportunidades, provedores, simulações, reuniões e comissões em CSV (abre no Excel),
com registro na auditoria.

**Fase 6:** regras de comissão (parceiros por indicação, equipe por indicação ou atendimento;
percentual, valor fixo e teto; etapa que gera; base de cálculo; prazo e vigência), geração automática
somente quando a oportunidade chega à etapa da regra (simular ou formalizar não gera), valor do negócio
fechado obrigatório na conclusão, filtro por origem da indicação nas regras de atendimento (ex.: bônus
para a equipe que atende indicações de parceiros externos), aprovação, ajuste com motivo, cancelamento, reabertura, pagamentos
parciais, previsão das oportunidades em aberto, histórico, tela Comissões no CRM e no portal do parceiro
(sem valor-base nem percentuais).

**Fase 5:** agenda (mês e lista), agendamento com participantes, link ou endereço, 7 status,
resultado e próximos passos, integração com o funil, lembretes, aviso de conflito de horário,
convite por e-mail com arquivo de calendário (.ics) e reuniões no portal do provedor.

**Fase 4:** funil em Kanban (arrastar e soltar), tabela e fila de atendimento; prospecção de ISPs
ainda não cadastrados (vinculada automaticamente pelo CNPJ); atribuição, transferência,
prioridade, prazo e próximo passo; registro de contatos e tentativas; documentos anexados
(Supabase Storage, bucket privado `attachments`); alertas de prazo vencido e oportunidade parada;
edição das etapas e regras de movimentação em Configurações.

**Fase 3:** painéis individuais (Meu desempenho no CRM e Minhas indicações no portal do parceiro),
tela Equipe e parceiros para gestores, alteração de código e correção de indicação com
justificativa e auditoria. O provedor vê apenas a faixa de valor da simulação.

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
