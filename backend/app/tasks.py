from celery import shared_task


@shared_task(ignore_result=True)
def ping_task():
    """Smoke-test task for the worker."""
    return "pong"
