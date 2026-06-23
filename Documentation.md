# Project Documentation
## NAGP 2026 — Kubernetes & DevOps Advance Assignment
**Candidate:** Arun Bisht | **ID:** 3145347

---

## 1. Requirement Understanding

The assignment required designing, containerizing, and deploying a multi-tier architecture on Kubernetes consisting of:

### Service API Tier Requirements
- Expose an API endpoint that fetches data from the database
- Use any standard language/framework (Node.js/Express chosen)
- Use best practices for DB connection (connection pooling)
- Support rolling updates
- Be externally accessible
- Demonstrate self-healing
- Demonstrate HPA (Horizontal Pod Autoscaler)
- Run as 4 replicas

### Database Tier Requirements
- One table with 5–10 records (8 employee records implemented)
- Support data persistence (PersistentVolumeClaim)
- Accessible only within the cluster (ClusterIP service)
- Automatically recover after pod deletion (StatefulSet)
- Run as 1 replica

### Other Requirements
- DB config provided via Kubernetes ConfigMap (not hardcoded)
- DB password stored in Kubernetes Secret (not plaintext)
- No Pod IPs used for communication (Service DNS names used)
- Expose API externally using Ingress
- Define CPU and memory requests and limits (FinOps)
- Identify cost optimization opportunities

---

## 2. Assumptions

1. **Local Kubernetes cluster** (Minikube) is used instead of a cloud provider, which is sufficient for demonstrating all Kubernetes concepts required by the assignment.

2. **MySQL 8.0** is used as the database, matching the version already used in the existing application.

3. **Node.js/Express** is used for the API tier since the candidate has prior experience with JavaScript.

4. **Single namespace** (`employee-app`) is used to isolate all assignment resources from Kubernetes system components.

5. **NodePort + Ingress** combination is used for external access since Minikube does not have a cloud LoadBalancer provisioner.

6. **Root MySQL user** is used for simplicity in a local development context. In production, a dedicated user with minimal privileges would be created.

7. **1Gi PersistentVolumeClaim** is sufficient for the dataset size (8 records).

8. **HPA target of 70% CPU** is a standard industry threshold that balances responsiveness with cost efficiency.

---

## 3. Solution Overview

### Technology Stack
| Component | Technology |
|---|---|
| API Framework | Node.js + Express v5 |
| Database | MySQL 8.0 |
| Containerization | Docker (node:20-alpine base) |
| Container Registry | Docker Hub |
| Orchestration | Kubernetes (Minikube) |
| Ingress Controller | nginx |

### Architecture
The solution implements a two-tier architecture:

**Tier 1 — Service API:**
- Node.js Express application containerized with Docker
- Deployed as a Kubernetes Deployment with 4 replicas
- Each replica reads DB config from ConfigMap and Secret via environment variables
- Health check endpoint (`/health`) enables liveness and readiness probes
- Exposed externally via NodePort Service and Ingress

**Tier 2 — Database:**
- MySQL 8.0 deployed as a Kubernetes StatefulSet
- Persistent storage via PersistentVolumeClaim (1Gi)
- Initialized with employees table and 8 records via init ConfigMap
- Accessible only within the cluster via ClusterIP Service
- DNS name `mysql-service` used for connection (never Pod IP)

### Communication Flow
```
User Request
    → Ingress (nginx, port 80)
    → api-service (NodePort, port 3000)
    → API Pod (Express app, port 3000)
    → mysql-service (ClusterIP, port 3306)
    → mysql-0 Pod (MySQL 8.0)
    → PersistentVolumeClaim (1Gi disk)
```

### Key Kubernetes Concepts Implemented

**Namespace:** All resources isolated in `employee-app` namespace.

**Secret:** MySQL root password stored as base64-encoded Kubernetes Secret, never visible in plaintext in any YAML file.

**ConfigMap (x2):**
- `app-config`: DB_HOST, DB_PORT, DB_NAME, DB_USER, PORT
- `mysql-init-configmap`: SQL script that creates and seeds the database on first boot

**StatefulSet:** MySQL runs as a StatefulSet to ensure stable pod identity (`mysql-0`), ordered deployment, and persistent storage attachment on pod restart.

**PersistentVolumeClaim:** 1Gi volume automatically provisioned and attached to MySQL pod. Data survives pod deletion and restart.

**Deployment:** API runs as a Deployment with 4 replicas, RollingUpdate strategy, and resource requests/limits.

**Services:**
- `mysql-service` (ClusterIP): Internal-only MySQL access
- `api-service` (NodePort): External API access on port 30007

**HPA:** Scales API pods between 2 and 8 based on CPU utilization threshold of 70%.

**Ingress:** nginx Ingress routes external HTTP traffic to the API service.

**Liveness Probe:** Kubernetes calls `/health` every 10 seconds. Failed probes trigger automatic pod restart (self-healing).

**Readiness Probe:** Kubernetes calls `/health` before routing traffic to a pod. Ensures no traffic reaches unready pods.

**Rolling Update Strategy:**
- `maxUnavailable: 1` — at most 1 pod offline during update
- `maxSurge: 1` — at most 1 extra pod during update
- Ensures zero downtime during deployments

---

## 4. Justification for Resources Utilized

### API Deployment — 4 Replicas
**Justification:** The assignment explicitly requires 4 pods for the API tier. Additionally, 4 replicas provides high availability — if one pod fails, 3 continue serving traffic with no user impact.

### API Resource Limits
```yaml
requests:
  memory: "128Mi"
  cpu: "100m"
limits:
  memory: "256Mi"
  cpu: "200m"
```
**Justification:** The Node.js Express app is lightweight. 100m CPU (0.1 core) is sufficient for handling API requests with connection pooling. 128Mi memory accommodates Node.js runtime + application code + connection pool. Limits are set at 2x requests to allow burst capacity while preventing any single pod from starving others.

### MySQL StatefulSet — 1 Replica
**Justification:** The assignment requires exactly 1 database pod. A single replica is appropriate for this use case. MySQL read replicas would add cost and complexity without benefiting a single-user assignment workload.

### MySQL Resource Limits
```yaml
requests:
  memory: "256Mi"
  cpu: "250m"
limits:
  memory: "512Mi"
  cpu: "500m"
```
**Justification:** MySQL 8.0 requires more memory than the API tier for buffer pool, query cache, and InnoDB operations. 256Mi is the minimum for MySQL to run stably. CPU limit of 500m (0.5 core) is sufficient for the small dataset (8 records).

### PersistentVolumeClaim — 1Gi
**Justification:** 1Gi is more than adequate for 8 employee records. The overhead is MySQL system tables and InnoDB data files which require ~200MB minimum. 1Gi provides headroom for growth while minimizing storage cost.

### HPA — minReplicas: 2, maxReplicas: 8, target: 70% CPU
**Justification:**
- `minReplicas: 2` ensures high availability even at zero traffic (one pod could fail and the other keeps serving)
- `maxReplicas: 8` caps cost during traffic spikes while allowing 4x scale-out from the base
- `70% CPU target` is the industry standard threshold — high enough to avoid over-provisioning, low enough to scale before saturation

### node:20-alpine Base Image
**Justification:** Alpine Linux base keeps the image at ~180MB vs ~1GB for the full Node.js image. Smaller images reduce Docker Hub storage, pull time, and attack surface. Node.js 20 is the current LTS (Long Term Support) version, ensuring stability and security patches.

### Minikube with 4096MB RAM, 2 CPUs
**Justification:** MySQL requires ~256MB minimum, 4 API pods require ~512MB combined, and Kubernetes system components require ~1GB. 4096MB total provides sufficient headroom without over-allocating host resources. 2 CPUs allows concurrent pod scheduling without contention.

---

## 5. FinOps Cost Optimization Opportunities

### Opportunity 1 — HPA Scale-Down During Off-Peak Hours
**Current state:** Base replicas set to 4
**Optimization:** HPA with minReplicas: 2 automatically scales down during low traffic
**Estimated saving:** ~50% compute cost during nights/weekends when traffic is low

### Opportunity 2 — Lightweight Container Images
**Current state:** node:20-alpine (~180MB) vs node:20 (~1GB)
**Optimization:** Alpine base image already implemented
**Benefit:** 5x smaller image = faster pulls, less registry storage, faster pod startup

### Opportunity 3 — Right-sized Resource Requests
**Current state:** Requests set based on actual observed usage
**Optimization:** CPU requests set to 100m (not over-provisioned at 500m)
**Benefit:** Kubernetes scheduler can pack more pods per node, reducing node count needed

### Opportunity 4 — Production Dependencies Only
**Current state:** `npm install --production` excludes devDependencies
**Benefit:** Smaller image, faster builds, reduced attack surface

### Opportunity 5 — Single MySQL Replica
**Current state:** 1 MySQL replica (StatefulSet replicas: 1)
**Optimization:** Not running unnecessary read replicas for this workload
**Benefit:** Eliminates duplicate PVC storage costs and compute for unused replicas
