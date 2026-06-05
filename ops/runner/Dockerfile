FROM alpine:3.20

RUN apk add --no-cache curl openssl

WORKDIR /runner

COPY run.sh /runner/run.sh
RUN chmod +x /runner/run.sh

ENTRYPOINT ["/bin/sh", "/runner/run.sh"]
