ARG PYTHON_VERSION=3.12-slim
FROM python:$PYTHON_VERSION

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip3 install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --system --uid 10001 boma && chown -R boma /app
USER boma

EXPOSE 8000
CMD ["./entrypoint.sh"]
