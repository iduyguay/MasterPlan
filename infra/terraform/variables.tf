variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "prod"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.42.0.0/16"
}

variable "backend_image" {
  description = "Container image URI for the backend service"
  type        = string
  default     = "ghcr.io/masterplan/backend:1.0.0"
}

variable "frontend_image" {
  description = "Container image URI for the frontend service"
  type        = string
  default     = "ghcr.io/masterplan/frontend:1.0.0"
}

variable "backend_cpu" {
  description = "Fargate CPU units for the backend task"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Fargate memory (MiB) for the backend task"
  type        = number
  default     = 1024
}

variable "backend_desired_count" {
  description = "Desired backend task count"
  type        = number
  default     = 2
}

variable "backend_max_count" {
  description = "Maximum backend task count for autoscaling"
  type        = number
  default     = 10
}

variable "frontend_desired_count" {
  description = "Desired frontend task count"
  type        = number
  default     = 2
}

variable "jwt_public_secret" {
  description = "Public JWT secret"
  type        = string
  sensitive   = true
}

variable "jwt_internal_secret" {
  description = "Internal JWT secret"
  type        = string
  sensitive   = true
}

variable "aes_master_key" {
  description = "AES-256 master key (hex)"
  type        = string
  sensitive   = true
}

variable "alb_allowed_cidrs" {
  description = "CIDRs allowed to reach the public ALB"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
