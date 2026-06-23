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

1. **Google Kubernetes Engine (GKE)** is used as the Kubernetes platform, providing a fully managed cluster with real public IP access, automatic persistent disk provisioning, and production-grade infrastructure.

2. **Minikube** was also used during local development and testing before deploying to GKE. All YAML files are identical for both environments — demonstrating Kubernetes portability.

3. **MySQL 8.0** is used as the database, matching the version already used in the existing application.

4. **Node.js/Express** is used for the API tier since the candidate has prior experience with JavaScript.

5. **Single namespace** (`employee-app`) is used to isolate all assignment resources from Kubernetes system components.

6. **e2-small machine type** is used for GKE nodes to minimize GCP credit usage while still running all required workloads.

7. **Root MySQL user** is used for simplicity. In production, a dedicated user with minimal privileges would be created.

8. **1Gi PersistentVolumeClaim** is sufficient for the dataset size (8 records). On GKE this automatically provisions a Google Persistent Disk SSD.

9. **HPA target of 70% CPU** is a standard industry threshold that balances responsiveness with cost efficiency.

10. **API resource requests reduced to 50m CPU / 64Mi memory** on GKE to accommodate e2-small node constraints where GKE system pods consume ~90% of resources by default.

---

## 3. Solution Overview

### Technology Stack
| Component | Technology |
|---|---|
| API Framework | Node.js + Express v5 |
| Database | MySQL 8.0 |
| Containerization | Docker (node:20-alpine base) |
| Container Registry | Docker Hub (arunbisht25) |
| Local Orchestration | Kubernetes via Minikube |
| Cloud Orchestration | Google Kubernetes Engine (GKE) |
| Cloud Provider | Google Cloud Platform (GCP) |
| GKE Cluster | employee-cluster, asia-south1-c |
| GCP Project | arun-kubernetes-and-devops |
| Ingress Controller | nginx |

### Architecture
The solution implements a two-tier architecture deployed on GKE:

**Tier 1 — Service API:**
- Node.js Express application containerized with Docker
- Deployed as a Kubernetes Deployment with 4 replicas
- Each replica reads DB config from ConfigMap and Secret via environment variables
- Health check endpoint (`/health`) enables liveness and readiness probes
- Exposed externally via NodePort Service and nginx Ingress with a real public IP

**Tier 2 — Database:**
- MySQL 8.0 deployed as a Kubernetes StatefulSet
- Persistent storage via PersistentVolumeClaim (1Gi) — automatically provisioned as a Google Persistent Disk SSD on GKE
- Initialized with employees table and 8 records via init ConfigMap
- Accessible only within the cluster via ClusterIP Service
- DNS name `mysql-service` used for connection (never Pod IP)

### Communication Flow
```
User (browser/curl)
    → GKE Ingress (nginx, public IP, port 80)
    → api-service (NodePort, port 3000)
    → API Pod (Express app, port 3000)
    → mysql-service (ClusterIP, port 3306)
    → mysql-0 Pod (MySQL 8.0)
    → Google Persistent Disk (1Gi SSD, asia-south1-c)
```

### GCP Infrastructure
| Resource | Details |
|---|---|
| Project | arun-kubernetes-and-devops |
| Cluster | employee-cluster |
| Zone | asia-south1-c (Mumbai) |
| Node count | 3 nodes |
| Machine type | e2-small (2 vCPU, 2GB RAM) |
| Disk per node | 20GB |
| Persistent Disk | Auto-provisioned 1Gi SSD for MySQL |
| Public IP | Assigned automatically via GKE Ingress |

### GKE Setup Commands
```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Authenticate
gcloud init

# Enable GKE API
gcloud services enable container.googleapis.com \
  --project=arun-kubernetes-and-devops

# Create cluster
gcloud container clusters create employee-cluster \
  --project=arun-kubernetes-and-devops \
  --zone=asia-south1-c \
  --num-nodes=3 \
  --machine-type=e2-small \
  --disk-size=20GB

# Connect kubectl to GKE
gcloud container clusters get-credentials employee-cluster \
  --zone=asia-south1-c \
  --project=arun-kubernetes-and-devops
```

### Deployment Commands (GKE)
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

### Key Kubernetes Concepts Implemented

**Namespace:** All resources isolated in `employee-app` namespace.

**Secret:** MySQL root password stored as base64-encoded Kubernetes Secret, never visible in plaintext in any YAML file.

**ConfigMap (x2):**
- `app-config`: DB_HOST, DB_PORT, DB_NAME, DB_USER, PORT
- `mysql-init-configmap`: SQL script that creates and seeds the database on first boot

**StatefulSet:** MySQL runs as a StatefulSet to ensure stable pod identity (`mysql-0`), ordered deployment, and persistent storage attachment on pod restart.

**PersistentVolumeClaim:** 1Gi volume automatically provisioned on GKE as a Google Persistent Disk SSD. Data survives pod deletion and restart. Same YAML works on Minikube (hostPath) and GKE (Google PD) — demonstrating Kubernetes storage abstraction.

**Deployment:** API runs as a Deployment with 4 replicas, RollingUpdate strategy, and resource requests/limits.

**Services:**
- `mysql-service` (ClusterIP): Internal-only MySQL access
- `api-service` (NodePort): External API access on port 30007

**HPA:** Scales API pods between 2 and 8 based on CPU utilization threshold of 70%.

**Ingress:** nginx Ingress routes external HTTP traffic to the API service. On GKE, this automatically provisions a Google Cloud Load Balancer with a real public IP address.

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

### API Resource Requests/Limits (GKE-optimized)
```yaml
requests:
  memory: "64Mi"
  cpu: "50m"
limits:
  memory: "256Mi"
  cpu: "200m"
```
**Justification:** Requests were tuned down from initial values (128Mi/100m) after observing that e2-small GKE nodes had ~90% resources consumed by system pods, leaving insufficient space for 4 API replicas. 50m CPU and 64Mi memory requests allow all 4 pods to schedule across the 3-node cluster while limits remain generous enough to handle burst traffic.

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
**Justification:** 1Gi is more than adequate for 8 employee records. On GKE, this provisions a Google Persistent Disk SSD which has a minimum size of 1Gi. This provides headroom for data growth while minimizing storage cost (~$0.17/month for 1Gi in asia-south1).

### GKE Cluster — 3 nodes, e2-small
**Justification:** Initially 2 nodes were provisioned but were insufficient because GKE system pods (kube-dns, metrics-server, ingress controller etc.) consume ~90% of e2-small resources. Adding a third node provided enough headroom for all 4 API pods plus MySQL to schedule successfully. e2-small was chosen over larger machine types to minimize GCP credit consumption.

### HPA — minReplicas: 2, maxReplicas: 8, target: 70% CPU
**Justification:**
- `minReplicas: 2` ensures high availability even at zero traffic
- `maxReplicas: 8` caps cost during traffic spikes while allowing 4x scale-out
- `70% CPU target` is the industry standard threshold — high enough to avoid over-provisioning, low enough to scale before saturation

### node:20-alpine Base Image
**Justification:** Alpine Linux base keeps the image at ~180MB vs ~1GB for the full Node.js image. Smaller images reduce Docker Hub storage, pull time on GKE nodes, and attack surface. Node.js 20 is the current LTS version.

---

## 5. FinOps Cost Optimization Opportunities

### Opportunity 1 — HPA Scale-Down During Off-Peak Hours
**Current state:** Base replicas set to 4
**Optimization:** HPA with minReplicas: 2 automatically scales down during low traffic
**Estimated saving:** ~50% compute cost during nights/weekends when traffic is low
**GCP context:** Each e2-small node costs ~$0.017/hour. Scaling from 3 to 2 nodes during off-peak saves ~$0.017/hour = ~$12/month

### Opportunity 2 — Lightweight Container Images
**Current state:** node:20-alpine (~180MB) vs node:20 (~1GB)
**Optimization:** Alpine base image already implemented
**Benefit:** 5x smaller image = faster pulls on GKE nodes, less Artifact Registry storage, faster pod startup times during scaling events

### Opportunity 3 — Right-sized Resource Requests
**Current state:** CPU requests tuned to 50m based on observed usage
**Optimization:** Conservative requests allow Kubernetes scheduler to pack more pods per node
**Benefit:** Reduces required node count — running 4 API pods on 3 e2-small nodes instead of needing 4 larger nodes

### Opportunity 4 — Delete Cluster After Demo
**Current state:** GKE cluster running continuously
**Optimization:** Per assignment instructions, cluster can be deleted after screen recording
**Command:** `gcloud container clusters delete employee-cluster --zone=asia-south1-c`
**Estimated saving:** Eliminates ~$1.22/day in compute costs after deliverables are captured

### Opportunity 5 — Production Dependencies Only
**Current state:** `npm install --production` excludes devDependencies
**Benefit:** Smaller image, faster builds, reduced attack surface, lower Docker Hub storage

### Opportunity 6 — Single MySQL Replica
**Current state:** 1 MySQL replica (StatefulSet replicas: 1)
**Optimization:** Not running unnecessary read replicas for this workload
**Benefit:** Eliminates duplicate Google Persistent Disk costs (~$0.17/Gi/month) and compute for unused replicas

### Opportunity 7 — Preemptible/Spot Nodes for Non-Critical Workloads
**Future optimization:** GKE Spot VMs cost 60-90% less than regular VMs
**Applicability:** API pods can run on Spot nodes since they are stateless and replaceable
**MySQL exception:** Database pod should remain on regular nodes for stability
