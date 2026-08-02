ARG BUILD_FROM
FROM ${BUILD_FROM}

RUN apk add --no-cache nodejs

COPY run.sh /run.sh
COPY app.js /app/app.js
RUN chmod a+x /run.sh

CMD ["/run.sh"]
