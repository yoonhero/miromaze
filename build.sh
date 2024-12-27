# docker buildx build --platform=linux/amd64 --load --tag ghcr.io/yoonhero/miro-front . && docker push ghcr.io/yoonhero/miro-front
docker build --platform linux/amd64 --tag ghcr.io/yoonhero/miro-front frontend && docker push ghcr.io/yoonhero/miro-front
docker build --platform linux/amd64 --tag ghcr.io/yoonhero/miro-server backend && docker push ghcr.io/yoonhero/miro-server
