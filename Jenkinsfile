pipeline {
    agent any

    environment {
        DOCKER_COMPOSE = 'docker-compose'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Backend') {
            steps {
                dir('backend') {
                    sh 'npm install'
                    // sh 'npm test' // Uncomment when tests are added
                }
            }
        }

        stage('Build Frontend') {
            steps {
                dir('frontend') {
                    sh 'npm install'
                    sh 'npm run build'
                    // sh 'npm test' // Uncomment when tests are added
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                sh '${DOCKER_COMPOSE} build'
            }
        }

        stage('Deploy Locally (Test)') {
            steps {
                sh '${DOCKER_COMPOSE} up -d'
                // Here you would typically run integration tests against the running containers
                // sleep 10
                // sh 'curl http://localhost:8080'
            }
        }
    }

    post {
        always {
            sh '${DOCKER_COMPOSE} down'
            cleanWs()
        }
    }
}
