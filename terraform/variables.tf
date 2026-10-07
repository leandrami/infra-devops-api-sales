variable "project_name" {
  description = "Prefixo usado no nome dos recursos"
  type        = string
  default     = "sales"
}

variable "region" {
  description = "Regiao AWS (simulada)"
  type        = string
  default     = "us-east-1"
}

variable "localstack_endpoint" {
  description = "Endpoint do LocalStack"
  type        = string
  default     = "http://localhost:4566"
}

variable "api_port" {
  description = "Porta da API liberada no firewall"
  type        = number
  default     = 3000
}

variable "allowed_cidr" {
  description = "Faixa de IPs com acesso a API"
  type        = string
  default     = "10.0.0.0/16"
}
