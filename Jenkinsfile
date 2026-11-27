pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 20, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '15'))
  }

  parameters {
    choice(
      name: 'DEPLOY_ENV',
      choices: ['staging', 'production'],
      description: 'Ambiente objetivo de despliegue'
    )
    booleanParam(
      name: 'PUSH_IMAGES',
      defaultValue: false,
      description: 'Publicar imágenes Docker en el registro configurado'
    )
    booleanParam(
      name: 'DEPLOY_COMPOSE',
      defaultValue: false,
      description: 'Desplegar stack con docker compose en el agente'
    )
    booleanParam(
      name: 'FAIL_ON_AUDIT',
      defaultValue: true,
      description: 'Fallar el pipeline si npm audit detecta vulnerabilidades high o critical en producción'
    )
  }

  environment {
    // Configurar DOCKER_REGISTRY en Variables Globales de Jenkins o aquí (ej: registry.empresa.local/reportes)
    DOCKER_REGISTRY = ''
    IMAGE_PREFIX = 'reporteador-multiempresa'
    DOCKER_CREDENTIALS_ID = 'docker-registry-credentials'
    SERVER_ENV_CREDENTIAL_ID = 'reporteador-server-env-file'
    CLIENT_ENV_CREDENTIAL_ID = 'reporteador-client-env-file'
    ORACLE_INSTANTCLIENT_URL = 'https://download.oracle.com/otn_software/linux/instantclient/instantclient-basic-linuxx64.zip'
    ASTRO_TELEMETRY_DISABLED = '1'
    NODE_IMAGE = 'node:24-bookworm-slim'
  }

  stages {
    stage('Checkout & Versionado') {
      steps {
        script {
          def shortCommit = sh(
            script: 'git rev-parse --short HEAD 2>/dev/null || echo "nogit"',
            returnStdout: true
          ).trim()
          env.GIT_COMMIT_SHORT = shortCommit
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${shortCommit}"

          def registryPrefix = env.DOCKER_REGISTRY?.trim()
          if (registryPrefix) {
            env.SERVER_IMAGE_REPO = "${registryPrefix}/${env.IMAGE_PREFIX}-server"
            env.WEB_IMAGE_REPO = "${registryPrefix}/${env.IMAGE_PREFIX}-web"
          } else {
            env.SERVER_IMAGE_REPO = "${env.IMAGE_PREFIX}-server"
            env.WEB_IMAGE_REPO = "${env.IMAGE_PREFIX}-web"
          }
        }
        echo "Pipeline Reporteador Multiempresa | Env: ${params.DEPLOY_ENV} | Tag: ${env.IMAGE_TAG}"
      }
    }

    stage('Verificación de Secretos e Higiene Git') {
      steps {
        sh '''
          set -eu
          if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
            TRACKED_ENV=$(git ls-files | grep -E '(^|/)\\.env(\\..*)?$' | grep -Ev '\\.example$' || true)
            if [ -n "$TRACKED_ENV" ]; then
              echo "ERROR: Hay archivos .env reales rastreados en Git:"
              echo "$TRACKED_ENV"
              exit 1
            fi

            TRACKED_LEGACY=$(git ls-files | grep -E '^reporteador-yumundi/' || true)
            if [ -n "$TRACKED_LEGACY" ]; then
              echo "ERROR: La carpeta legada reporteador-yumundi/ contiene credenciales y NO debe subirse a Git."
              exit 1
            fi

            TRACKED_KEYS=$(git ls-files | grep -Ei '\\.(pem|key|crt|csr|p12|pfx|jks)$' || true)
            if [ -n "$TRACKED_KEYS" ]; then
              echo "ERROR: Se detectaron llaves o certificados privados rastreados en Git:"
              echo "$TRACKED_KEYS"
              exit 1
            fi
          fi
          echo "Higiene Git verificada: sin secretos ni credenciales legadas rastreadas."
        '''
      }
    }

    stage('Instalación y Auditoría de Seguridad') {
      parallel {
        stage('Server Dependencies & Audit') {
          steps {
            sh '''
              set -eu
              docker run --rm -i \
                -u "$(id -u):$(id -g)" \
                -e HOME=/tmp \
                -e npm_config_cache=/tmp/.npm \
                -e FAIL_ON_AUDIT="${FAIL_ON_AUDIT}" \
                -v "${WORKSPACE}:/workspace" \
                -w /workspace/server \
                "${NODE_IMAGE}" sh -s <<'EOF'
set -eu
npm ci
set +e
npm audit --omit=dev --audit-level=high --json > /workspace/audit-server.json
AUDIT_RC=$?
set -e
npm audit --omit=dev || true
if [ "${FAIL_ON_AUDIT}" = "true" ] && [ "$AUDIT_RC" -ne 0 ]; then
  echo "ERROR: npm audit en server detectó vulnerabilidades high/critical (exit $AUDIT_RC)."
  exit "$AUDIT_RC"
fi
EOF
            '''
          }
        }

        stage('Client Dependencies & Audit') {
          steps {
            sh '''
              set -eu
              docker run --rm -i \
                -u "$(id -u):$(id -g)" \
                -e HOME=/tmp \
                -e npm_config_cache=/tmp/.npm \
                -e FAIL_ON_AUDIT="${FAIL_ON_AUDIT}" \
                -v "${WORKSPACE}:/workspace" \
                -w /workspace/client \
                "${NODE_IMAGE}" sh -s <<'EOF'
set -eu
npm ci
set +e
npm audit --omit=dev --audit-level=high --json > /workspace/audit-client.json
AUDIT_RC=$?
set -e
npm audit --omit=dev || true
if [ "${FAIL_ON_AUDIT}" = "true" ] && [ "$AUDIT_RC" -ne 0 ]; then
  echo "ERROR: npm audit en client detectó vulnerabilidades high/critical (exit $AUDIT_RC)."
  exit "$AUDIT_RC"
fi
EOF
            '''
          }
        }
      }
    }

    stage('Validación, Pruebas y Compilación') {
      parallel {
        stage('Server Typecheck, Tests & Build') {
          steps {
            sh '''
              set -eu
              docker run --rm \
                -u "$(id -u):$(id -g)" \
                -e HOME=/tmp \
                -e npm_config_cache=/tmp/.npm \
                -v "${WORKSPACE}:/workspace" \
                -w /workspace/server \
                "${NODE_IMAGE}" sh -eu -c 'npm run typecheck && npm test && npm run build'
            '''
          }
        }

        stage('Client Typecheck & Static Build') {
          steps {
            withCredentials([
              file(credentialsId: env.CLIENT_ENV_CREDENTIAL_ID, variable: 'CLIENT_ENV_FILE')
            ]) {
              sh '''
                set -eu
                trap 'rm -f client/.env' EXIT
                tr -d '\\r' < "$CLIENT_ENV_FILE" > client/.env
                chmod 600 client/.env
                docker run --rm \
                  -u "$(id -u):$(id -g)" \
                  -e HOME=/tmp \
                  -e npm_config_cache=/tmp/.npm \
                  -e ASTRO_TELEMETRY_DISABLED=1 \
                  -v "${WORKSPACE}:/workspace" \
                  -w /workspace/client \
                  "${NODE_IMAGE}" sh -eu -c 'npm run typecheck && npm run build'
              '''
            }
          }
        }
      }
    }

    stage('Build y Validación Docker') {
      steps {
        withCredentials([
          file(credentialsId: env.CLIENT_ENV_CREDENTIAL_ID, variable: 'CLIENT_ENV_FILE')
        ]) {
          sh '''
            set -eu
            PUBLIC_API_URL_VALUE=$(tr -d '\\r' < "$CLIENT_ENV_FILE" | grep -E '^[[:space:]]*PUBLIC_API_URL=' | tail -n 1 | cut -d '=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//' | sed "s/^'//;s/'$//" || true)
            PUBLIC_LOGIN_API_URL_VALUE=$(tr -d '\\r' < "$CLIENT_ENV_FILE" | grep -E '^[[:space:]]*PUBLIC_LOGIN_API_URL=' | tail -n 1 | cut -d '=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//' | sed "s/^'//;s/'$//" || true)

            if [ -z "$PUBLIC_API_URL_VALUE" ] || [ -z "$PUBLIC_LOGIN_API_URL_VALUE" ]; then
              echo "ERROR: La credencial ${CLIENT_ENV_CREDENTIAL_ID} debe definir PUBLIC_API_URL y PUBLIC_LOGIN_API_URL."
              exit 1
            fi

            export PUBLIC_API_URL="${PUBLIC_API_URL_VALUE}"
            export PUBLIC_LOGIN_API_URL="${PUBLIC_LOGIN_API_URL_VALUE}"

            docker compose config -q

            docker build \
              --pull \
              --build-arg ORACLE_INSTANTCLIENT_URL="${ORACLE_INSTANTCLIENT_URL}" \
              -t "${SERVER_IMAGE_REPO}:${IMAGE_TAG}" \
              -t "${SERVER_IMAGE_REPO}:latest" \
              ./server

            docker build \
              --pull \
              --build-arg PUBLIC_API_URL="${PUBLIC_API_URL_VALUE}" \
              --build-arg PUBLIC_LOGIN_API_URL="${PUBLIC_LOGIN_API_URL_VALUE}" \
              -t "${WEB_IMAGE_REPO}:${IMAGE_TAG}" \
              -t "${WEB_IMAGE_REPO}:latest" \
              -f client/Dockerfile \
              .

            docker run --rm \
              --add-host=reporteador-server:127.0.0.1 \
              --add-host=api_login_v2:127.0.0.1 \
              --entrypoint nginx "${WEB_IMAGE_REPO}:${IMAGE_TAG}" -t
          '''
        }
      }
    }

    stage('Publicar Imágenes') {
      when {
        expression { return params.PUSH_IMAGES }
      }
      steps {
        withCredentials([
          usernamePassword(
            credentialsId: env.DOCKER_CREDENTIALS_ID,
            usernameVariable: 'REGISTRY_USER',
            passwordVariable: 'REGISTRY_PASS'
          )
        ]) {
          sh '''
            set -eu
            trap 'docker logout "${DOCKER_REGISTRY}" >/dev/null 2>&1 || true' EXIT
            printf '%s\n' "$REGISTRY_PASS" | docker login "${DOCKER_REGISTRY}" -u "$REGISTRY_USER" --password-stdin

            docker push "${SERVER_IMAGE_REPO}:${IMAGE_TAG}"
            docker push "${SERVER_IMAGE_REPO}:latest"
            docker push "${WEB_IMAGE_REPO}:${IMAGE_TAG}"
            docker push "${WEB_IMAGE_REPO}:latest"
          '''
        }
      }
    }

    stage('Despliegue Docker Compose') {
      when {
        expression { return params.DEPLOY_COMPOSE }
      }
      steps {
        withCredentials([
          file(credentialsId: env.SERVER_ENV_CREDENTIAL_ID, variable: 'SERVER_ENV_FILE'),
          file(credentialsId: env.CLIENT_ENV_CREDENTIAL_ID, variable: 'CLIENT_ENV_FILE')
        ]) {
          sh '''
            set -eu
            # Limpia los archivos .env temporales del workspace de Jenkins al finalizar el despliegue
            trap 'rm -f .env server/.env client/.env' EXIT
            tr -d '\\r' < "$SERVER_ENV_FILE" > .env
            tr -d '\\r' < "$SERVER_ENV_FILE" > server/.env
            tr -d '\\r' < "$CLIENT_ENV_FILE" > client/.env
            chmod 600 .env server/.env client/.env

            PUBLIC_API_URL_VALUE=$(grep -E '^[[:space:]]*PUBLIC_API_URL=' client/.env | tail -n 1 | cut -d '=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//' | sed "s/^'//;s/'$//" || true)
            PUBLIC_LOGIN_API_URL_VALUE=$(grep -E '^[[:space:]]*PUBLIC_LOGIN_API_URL=' client/.env | tail -n 1 | cut -d '=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//' | sed "s/^'//;s/'$//" || true)
            export PUBLIC_API_URL="${PUBLIC_API_URL_VALUE:-/api}"
            export PUBLIC_LOGIN_API_URL="${PUBLIC_LOGIN_API_URL_VALUE:-/apilogin}"

            echo "Desplegando imágenes tag=${IMAGE_TAG}..."
            docker compose up -d --force-recreate --remove-orphans

            ATTEMPTS=0
            until docker exec reporteador-web wget -qO- "http://127.0.0.1:8080/healthz" >/dev/null 2>&1 && \
                  docker exec reporteador-web wget -qO- "http://127.0.0.1:8080/api/health" >/dev/null 2>&1; do
              ATTEMPTS=$((ATTEMPTS + 1))
              if [ "$ATTEMPTS" -ge 15 ]; then
                echo "ERROR: El stack no respondió saludable dentro del tiempo esperado."
                docker compose ps
                docker logs --tail 30 reporteador-web || true
                docker logs --tail 30 reporteador-server || true
                exit 1
              fi
              sleep 2
            done

            echo "Despliegue completado y verificado en red red-gane-int (http://reporteador-web:8080)"
          '''
        }
      }
    }
  }

  post {
    always {
      sh 'rm -f .env server/.env client/.env || true'
      archiveArtifacts artifacts: 'audit-*.json', allowEmptyArchive: true
      sh 'docker image prune -f >/dev/null 2>&1 || true'
      cleanWs()
    }
  }
}
