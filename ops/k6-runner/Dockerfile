FROM grafana/k6:0.53.0

USER root
RUN apk add --no-cache curl openssl

WORKDIR /k6-runner

COPY run.sh /k6-runner/run.sh
COPY script.js /k6-runner/script.js

RUN chmod +x /k6-runner/run.sh

ENTRYPOINT ["/bin/sh", "/k6-runner/run.sh"]
