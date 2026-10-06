.PHONY: up down logs test seed k8s-up k8s-seed k8s-down load
up:       ; cp -n .env.example .env || true; docker compose up -d --build
down:     ; docker compose down
logs:     ; docker compose logs -f api
test:     ; npm ci && npm test
k8s-up:
	kubectl apply -f k8s/namespace.yaml
	kubectl -n sales get secret sales-secret >/dev/null 2>&1 || \
	  kubectl -n sales create secret generic sales-secret --from-literal=DB_USER=sales --from-literal=DB_PASSWORD=$${DB_PASSWORD:?defina DB_PASSWORD}
	kubectl apply -f k8s/configmap.yaml -f k8s/postgres.yaml -f k8s/redis.yaml -f k8s/api.yaml -f k8s/hpa.yaml -f k8s/ingress.yaml
k8s-down: ; kubectl delete namespace sales
seed:     ; docker compose exec redis redis-cli SET event:evt-1:tickets 100
k8s-seed: ; kubectl -n sales exec deploy/redis -- redis-cli SET event:evt-1:tickets 100
load:     ; ./scripts/load-test.sh $${URL:-http://localhost:3000} $${N:-20}
