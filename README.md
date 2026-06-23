# Kubernetes & DevOps Advance Assignment

**NAGP 2026 | Arun Bisht | ID: 3145347**

---

## Repository & Links

| Resource             | URL                                                                       |
| -------------------- | ------------------------------------------------------------------------- |
| GitHub Repository    | `https://github.com/arunbisht/Arun_3145347_Kubernetes-and-DevOps-Advance` |
| Docker Hub Image     | `https://hub.docker.com/repository/docker/arunbisht25/employee-api`       |
| API Endpoint (local) | `http://8.232.223.201/employees`                                          |
| Health Check         | `http://8.232.223.201/health`                                             |

---

## Project Structure

```
employee-api/
├── app/
│   ├── server.js          # Express API server
│   ├── db.js              # MySQL connection pool
│   ├── package.json       # Dependencies
│   ├── Dockerfile         # Container definition
│   ├── .dockerignore
│   └── .gitignore
└── k8s/
    ├── namespace.yaml             # Isolated namespace
    ├── secret.yaml                # DB password (base64)
    ├── configmap.yaml             # App configuration
    ├── mysql-init-configmap.yaml  # DB init SQL script
    ├── mysql-statefulset.yaml     # MySQL pod + PVC
    ├── mysql-service.yaml         # Internal ClusterIP service
    ├── api-deployment.yaml        # API pods (4 replicas)
    ├── api-service.yaml           # NodePort service
    ├── hpa.yaml                   # Horizontal Pod Autoscaler
    └── ingress.yaml               # External traffic routing
```

---

## Quick Start

### Prerequisites

- Docker Engine
- kubectl
- Minikube

### Start Minikube

```bash
sudo service docker start
minikube start --driver=docker --memory=4096 --cpus=2 --force
minikube addons enable ingress
minikube addons enable metrics-server
```

### Deploy Everything

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/mysql-init-configmap.yaml
kubectl apply -f k8s/mysql-statefulset.yaml
kubectl apply -f k8s/mysql-service.yaml
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/api-service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
```

### Verify Deployment

```bash
kubectl get all -n employee-app
curl http://192.168.49.2:30007/employees
```

---

## Architecture Overview

```
Internet
    │
    ▼
Ingress (nginx) ← routes HTTP traffic
    │
    ▼
NodePort Service (api-service:3000)
    │
    ▼
API Deployment (4 pods — Node.js/Express)
    │   ConfigMap: DB_HOST, DB_PORT, DB_NAME, DB_USER
    │   Secret:    DB_PASSWORD
    │
    ▼
ClusterIP Service (mysql-service:3306)
    │
    ▼
MySQL StatefulSet (1 pod)
    │
    ▼
PersistentVolumeClaim (1Gi disk)
```

---

## Kubernetes Resources Summary

| Resource             | Kind                | Purpose                   |
| -------------------- | ------------------- | ------------------------- |
| employee-app         | Namespace           | Isolated workspace        |
| mysql-secret         | Secret              | DB password (base64)      |
| app-config           | ConfigMap           | DB host, port, name, user |
| mysql-init-configmap | ConfigMap           | SQL init script           |
| mysql                | StatefulSet         | MySQL database pod        |
| mysql-service        | Service (ClusterIP) | Internal DB access        |
| mysql-data-mysql-0   | PVC                 | Persistent 1Gi storage    |
| api-deployment       | Deployment          | 4 Node.js API pods        |
| api-service          | Service (NodePort)  | External API access       |
| api-hpa              | HPA                 | Auto-scaling (2-8 pods)   |
| api-ingress          | Ingress             | HTTP routing              |

---

## Demonstrating Key Features

### Self-Healing

```bash
# Delete a pod — Kubernetes recreates it automatically
kubectl delete pod <api-pod-name> -n employee-app
kubectl get pods -n employee-app -w
```

### Data Persistence

```bash
# Delete MySQL pod — data survives via PVC
kubectl delete pod mysql-0 -n employee-app
kubectl get pods -n employee-app -w
curl http://192.168.49.2:30007/employees  # data still there!
```

### Rolling Update

```bash
# Update image version — pods replaced one at a time
kubectl set image deployment/api-deployment \
  employee-api=arunbisht25/employee-api:2.0 -n employee-app
kubectl rollout status deployment/api-deployment -n employee-app
```

### HPA (Auto-scaling)

```bash
kubectl get hpa -n employee-app
kubectl describe hpa api-hpa -n employee-app
```

---

## FinOps — Cost Optimization

### 1. Right-sized Resource Requests & Limits

All pods have explicit CPU and memory requests/limits defined:

**API pods:**

- Request: 100m CPU, 128Mi memory
- Limit: 200m CPU, 256Mi memory

**MySQL pod:**

- Request: 250m CPU, 256Mi memory
- Limit: 500m CPU, 512Mi memory

This prevents resource waste by ensuring pods only use what they need.

### 2. HPA — Scale Down During Low Traffic

The HPA is configured with `minReplicas: 2` and `maxReplicas: 8`.
During off-peak hours, it scales down to 2 pods saving ~50% compute cost
compared to always running 4 pods.

### 3. Lightweight Base Image

Using `node:20-alpine` instead of `node:20` reduces image size from ~1GB
to ~180MB. Smaller images mean faster pulls, less storage cost, and
faster pod startup times.

### 4. Single MySQL Replica

The database runs as 1 replica (StatefulSet replicas: 1) which is
sufficient for this workload. Running unnecessary replicas would waste
persistent storage and compute resources.

### 5. Production-only Dependencies

Using `npm install --production` in the Dockerfile excludes development
dependencies from the container image, keeping it lean and reducing
attack surface.
