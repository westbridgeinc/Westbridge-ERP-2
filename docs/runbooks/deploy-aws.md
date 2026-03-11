# Deployment Runbook — AWS (ECS Fargate)

## Architecture

```
Route 53 → ALB → ECS Fargate (API containers)
                  ├── RDS PostgreSQL
                  ├── ElastiCache Redis
                  └── ERPNext (separate ECS service or EC2)
```

## Prerequisites

- AWS CLI configured with appropriate IAM permissions
- Docker image pushed to ECR
- VPC with private subnets configured
- RDS PostgreSQL instance running
- ElastiCache Redis cluster running

## Build and Push Docker Image

```bash
# Authenticate to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and tag
docker build -t westbridge-api .
docker tag westbridge-api:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/westbridge-api:latest

# Push
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/westbridge-api:latest
```

## ECS Task Definition

Key configuration for the task definition:

```json
{
  "containerDefinitions": [{
    "name": "westbridge-api",
    "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/westbridge-api:latest",
    "portMappings": [{ "containerPort": 4000 }],
    "healthCheck": {
      "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 10
    },
    "environment": [
      { "name": "NODE_ENV", "value": "production" },
      { "name": "PORT", "value": "4000" }
    ],
    "secrets": [
      { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:..." },
      { "name": "REDIS_HOST", "valueFrom": "arn:aws:secretsmanager:..." },
      { "name": "ENCRYPTION_KEY", "valueFrom": "arn:aws:secretsmanager:..." }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/westbridge-api",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "api"
      }
    }
  }],
  "cpu": "512",
  "memory": "1024",
  "networkMode": "awsvpc"
}
```

## Deploy

```bash
# Update service to use new task definition
aws ecs update-service \
  --cluster westbridge \
  --service westbridge-api \
  --force-new-deployment

# Monitor deployment
aws ecs describe-services \
  --cluster westbridge \
  --services westbridge-api \
  --query 'services[0].deployments'
```

## Database Migrations

```bash
# Run migrations via ECS Exec
aws ecs execute-command \
  --cluster westbridge \
  --task <task-id> \
  --container westbridge-api \
  --interactive \
  --command "npx prisma migrate deploy"
```

## Rollback

```bash
# Update service to previous task definition revision
aws ecs update-service \
  --cluster westbridge \
  --service westbridge-api \
  --task-definition westbridge-api:<previous-revision>
```

## Auto-Scaling

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/westbridge/westbridge-api \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policy (target 70% CPU)
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/westbridge/westbridge-api \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    '{"TargetValue": 70.0, "PredefinedMetricSpecification": {"PredefinedMetricType": "ECSServiceAverageCPUUtilization"}}'
```
