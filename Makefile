SHELL := /bin/bash
.DEFAULT_GOAL := help

help:
	@echo "make install    - tum bagimliliklari kur"
	@echo "make dev        - lokal dev (backend + frontend)"
	@echo "make seed       - veritabanini seedle"
	@echo "make build      - docker imajlarini insa et"
	@echo "make up         - docker compose ayaga kaldir"
	@echo "make down       - docker compose durdur"
	@echo "make logs       - tum servislerin loglari"
	@echo "make tf-init    - terraform init"
	@echo "make tf-plan    - terraform plan"
	@echo "make tf-apply   - terraform apply"

install:
	cd backend && npm install
	cd frontend && npm install

dev:
	@trap 'kill 0' SIGINT; \
	(cd backend && cp -n .env.example .env || true; npm run dev) & \
	(cd frontend && npm run dev) & \
	wait

seed:
	cd backend && npm run seed

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

tf-init:
	cd infra/terraform && terraform init

tf-plan:
	cd infra/terraform && terraform plan

tf-apply:
	cd infra/terraform && terraform apply -auto-approve

.PHONY: help install dev seed build up down logs tf-init tf-plan tf-apply
