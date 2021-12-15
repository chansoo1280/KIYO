node {
    stage ('Pull'){
        sh 'dir'
        git url: 'https://github.com/chansoo1280/KIYO.git', credentialsId: 'git-chansoo1280'
    }
    stage ('Build'){
        withAWS(credentials: 'aws-chansoo1280', region: 'ap-northeast-2') {
            sh(script: 'aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 633540653248.dkr.ecr.ap-northeast-2.amazonaws.com')
            sh 'docker build -t account-manager-fe ./frontend'
            sh 'docker tag account-manager-fe:latest 633540653248.dkr.ecr.ap-northeast-2.amazonaws.com/account-manager-fe:latest'
            sh 'docker push 633540653248.dkr.ecr.ap-northeast-2.amazonaws.com/account-manager-fe:latest'
            sh 'docker ps'
        }
    }
    stage ('Init'){
        sh '''#!/bin/bash
            cd /root
            docker-compose pull
            docker-compose up --force-recreate --build -d
            docker system prune -f
        '''
    }
}