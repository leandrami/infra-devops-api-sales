# Infra DevOps — API Flash Sales

Infraestrutura, automação e entrega contínua para a API **flash-sales** (Node.js + TypeScript, Express, TypeORM/PostgreSQL, Redis e métricas Prometheus).

A API tem: `POST /checkout` (reserva atômica de ingressos no Redis + pedido no Postgres), `POST /tickets/export` (relatório pesado que consome CPU e memória de propósito) e `GET /metrics`. O `GET /health` foi adicionado para as verificações de saúde.

## Visão geral

```
Dev ──push──▶ GitHub ──▶ GitHub Actions (segredos ∥ testes ∥ SAST ∥ IaC ▶ build ▶ Trivy ▶ Docker Hub ∥ DAST ∥ Terraform)
                                                   │
                         ┌─────────────────────────┴───────────────┐
                         ▼                                         ▼
              Docker Compose (local)                    Kubernetes (cluster)
   api ─ postgres ─ redis ─ prometheus ─ grafana     Ingress ▶ Service ▶ API (HPA 2–6)
                                                              ├─ StatefulSet Postgres (PVC)
                                                              └─ Redis
```

## Arquivos de infraestrutura

| Arquivo | Função |
|---|---|
| `Dockerfile` / `.dockerignore` | Imagem multi-stage, enxuta, usuário não-root, HEALTHCHECK |
| `docker-compose.yml` | Ambiente local completo, com healthchecks, limites de recurso e Redis persistente (AOF) |
| `.env.example` | Modelo de variáveis (o `.env` real não é versionado) |
| `.github/workflows/ci-cd.yml` | Pipeline DevSecOps: segredos, testes, SAST, IaC, imagem, DAST e Terraform |
| `terraform/` | Infraestrutura como código (9 recursos) para o LocalStack |
| `k8s/*.yaml` | Namespace, config, Postgres, Redis, API, HPA e Ingress |
| `monitoring/` | Prometheus e Grafana provisionados como código |
| `scripts/load-test.sh` | Carga na exportação pesada para demonstrar limites e autoscaling |
| `Makefile` | Atalhos de operação |

## Pré-requisitos

Docker + Docker Compose v2, Git e Terraform. Opcional: `kubectl` + minikube/kind (parte extra de Kubernetes).

## Execução local (Docker Compose)

```bash
cp .env.example .env          # edite as senhas
docker compose up -d --build  # ou: make up
docker compose ps             # todos "healthy"/"running"
make seed                     # cria o estoque: 100 ingressos para o evento evt-1
```

Serviços: API `http://localhost:3000` · Prometheus `http://localhost:9090` · Grafana `http://localhost:3001` (usuário `admin`, senha `GRAFANA_PASSWORD`).

## Testando a API

Rotas: `POST /checkout`, `POST /tickets/export`, `GET /metrics` e `GET /health`. No checkout, `eventId`, `userId` e `quantity` são obrigatórios. Na exportação, `records` é opcional (padrão: 500000).

> O checkout só funciona se o estoque existir no Redis (chave `event:<eventId>:tickets`). Sem o `make seed`, a resposta é 409 (esgotado).

```bash
# 1) saúde e métricas
curl -i http://localhost:3000/health
curl -s http://localhost:3000/metrics | head

# 2) compra válida (esperado: HTTP 201 e "Checkout successful")
curl -i -X POST http://localhost:3000/checkout \
  -H "Content-Type: application/json" \
  -d '{"eventId":"evt-1","userId":"user-1","quantity":2}'

# 3) estoque no Redis (esperado: 98) e pedido no Postgres
docker compose exec redis redis-cli GET event:evt-1:tickets
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT * FROM orders;"'

# 4) campo faltando (esperado: HTTP 400, "Missing required fields")
curl -i -X POST http://localhost:3000/checkout \
  -H "Content-Type: application/json" \
  -d '{"eventId":"evt-1","userId":"user-1"}'

# 5) estoque insuficiente (esperado: HTTP 409, "Tickets sold out or insufficient quantity")
curl -i -X POST http://localhost:3000/checkout \
  -H "Content-Type: application/json" \
  -d '{"eventId":"evt-1","userId":"user-1","quantity":1000}'

# 6) exportação pesada, com poucos registros para o teste (esperado: HTTP 200, "Export completed")
curl -i -X POST http://localhost:3000/tickets/export \
  -H "Content-Type: application/json" \
  -d '{"records":100000}'
```

A exportação bloqueia o event loop e consome CPU e memória de propósito; com o padrão de 500000 registros ela leva mais tempo e a API fica lenta durante esse período. Testes unitários: `npm ci && npm test`.

> As tabelas são criadas automaticamente (`synchronize: true` no TypeORM). Em produção real o ideal é usar migrations.

## Demonstrando limites de recurso e escalabilidade

A exportação (`POST /tickets/export`) é pesada por projeto: aloca muita memória e ocupa a CPU. Para observar o comportamento da infraestrutura:

```bash
make load                       # 20 exportações em paralelo (500000 registros cada)
N=50 RECORDS=200000 make load   # ajuste a quantidade de requisições e de registros
docker stats                    # a API respeita 0,5 CPU e 512 MB
```

No Kubernetes, com o HPA ativo:

```bash
kubectl -n sales port-forward svc/sales-api 8080:80 &
URL=http://localhost:8080 make load
kubectl -n sales get hpa -w     # réplicas sobem de 2 até 6
kubectl -n sales get pods       # observe reinícios (OOMKilled), se houver
```

## Infraestrutura como código (Terraform + LocalStack)

O diretório `terraform/` descreve, em código, 9 recursos de uma AWS simulada pelo LocalStack (sem custo): VPC, sub-rede, internet gateway, tabela de rotas, associação de rota, security group (firewall), instância EC2, bucket S3 e versionamento do bucket. A EC2 é simulada; os containers da aplicação rodam via Docker Compose.

```bash
# requer Terraform instalado
docker compose --profile iac up -d localstack
curl -s http://localhost:4566/_localstack/health   # serviços "available"
cd terraform
terraform init
terraform apply -auto-approve                      # 9 recursos criados
terraform output
```

Atalhos: `make tf-up` e `make tf-down` (remove tudo com `terraform destroy`). O estado local (`.tfstate`) não vai para o Git.

## Extra (opcional): Kubernetes (minikube/kind)

Não faz parte da pipeline; mostra como a mesma imagem rodaria em um cluster.


```bash
minikube start && minikube addons enable ingress && minikube addons enable metrics-server
# ajuste a imagem em k8s/api.yaml (<usuario-dockerhub>/<repo>)
export DB_PASSWORD='senha-forte'
make k8s-up
make k8s-seed
kubectl -n sales get pods
```

Remover tudo: `make k8s-down`.

## Pipeline CI/CD (DevSecOps)

A cada push na `main` (e em pull requests), o GitHub Actions executa:

| Etapa | Ferramenta | O que faz |
|---|---|---|
| Segredos | Gitleaks | Procura credenciais vazadas no código e no histórico |
| Testes | Node.js + Jest | Compila (`tsc`) e roda os testes |
| SAST | Semgrep | Análise estática do código-fonte |
| Scan de IaC | Checkov | Verifica Dockerfile, Terraform e manifestos |
| Imagem | Docker + Trivy | Build, scan de vulnerabilidades e push no Docker Hub (tags SHA e `latest`) |
| DAST | OWASP ZAP | Ataque simulado contra a API em execução |
| Infraestrutura | Terraform + LocalStack | Cria 9 recursos numa AWS simulada |

**Secrets do GitHub** (*Settings → Secrets and variables → Actions*): `DOCKERHUB_USERNAME` e `DOCKERHUB_TOKEN` (token de acesso criado no Docker Hub). Sem eles, a imagem é construída e analisada, mas não publicada, e a pipeline continua verde.

Gitleaks, testes e Terraform bloqueiam a pipeline se falharem. SAST, Checkov, Trivy e DAST funcionam em modo relatório: mostram os achados sem bloquear.

## Justificativa de arquitetura

**Containerização.** O mesmo artefato roda em dev, CI e produção. O build multi-stage deixa a imagem final só com o necessário, e o usuário não-root reduz a superfície de ataque.

**Infraestrutura como código.** Compose, manifestos, Prometheus e Grafana são arquivos versionados e revisáveis; o ambiente é recriado do zero com poucos comandos.

**Entrega contínua.** Cada commit é compilado, testado, validado e empacotado automaticamente. Tags por SHA dão rastreabilidade e permitem rollback (`kubectl rollout undo`).

**Escalabilidade.** A API é stateless: o estoque vive no Redis (operação atômica via script Lua, sem venda em duplicidade entre réplicas) e os pedidos no Postgres. O HPA escala de 2 a 6 réplicas por CPU (70%) e memória (80%), absorvendo picos de checkout e de exportação.

**Isolamento do gargalo.** O relatório pesado pode saturar CPU e memória. Os limites de recurso (0,5 CPU / 512 MB) impedem que um pod afete o nó; com várias réplicas, o checkout continua atendido enquanto um pod reinicia. As probes têm timeout e tolerância maiores (liveness com 6 falhas) porque o laço síncrono da exportação bloqueia o event loop e atrasa respostas.

**Confiabilidade.** Healthchecks e `depends_on` garantem a ordem de subida; o `initContainer` espera Postgres e Redis; rolling update com `maxUnavailable: 0` evita downtime; PVC mantém os dados do Postgres e o Redis do Compose usa AOF para não perder o estoque ao reiniciar.

**Segurança.** Contêiner não-root, sem escalada de privilégios, limites de recursos; credenciais fora do código (`.env` ignorado, Secrets do Kubernetes e do GitHub); banco e Redis só na rede interna; scan de vulnerabilidades no pipeline.

**Observabilidade.** O `/metrics` alimenta Prometheus e Grafana (provisionados como código), mostrando latência, requisições e erros durante a carga.

**Infraestrutura como código (Terraform).** A infraestrutura de nuvem também é código: o mesmo `terraform apply` gera sempre o mesmo ambiente, e cada mudança fica registrada e revisável no Git. O LocalStack permite validar tudo sem custo.

**Segurança integrada ao pipeline (DevSecOps).** A segurança é verificada a cada push, antes de o código ir para o ar: Gitleaks (segredos), Semgrep (SAST), Checkov (IaC), Trivy (imagem) e OWASP ZAP (DAST, com a API rodando). Problemas aparecem cedo, quando custam pouco para corrigir.

**Entrega por imagem versionada.** A imagem é publicada no Docker Hub com a tag `latest` e o SHA do commit, o que mostra exatamente qual alteração gerou cada versão e permite voltar a uma versão anterior.

## Limitações e melhorias futuras

Postgres e Redis em instância única (em produção: serviços gerenciados ou réplicas; no Kubernetes o Redis aqui é efêmero); `synchronize: true` no TypeORM (em produção, usar migrations); exportação síncrona (ideal: fila e worker separado, ou streaming); Terraform para provisionar o cluster; alertas com Alertmanager.
