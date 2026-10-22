"""Handler d'erreurs : une seule forme de réponse pour tout le frontend.

Le client React lit ``data.message`` pour afficher les erreurs.
"""
from rest_framework.views import exception_handler


def _extract_message(data):
    if isinstance(data, dict):
        if 'detail' in data:
            return str(data['detail'])
        # Erreurs de validation : {"name": ["Ce champ est requis."]}
        first = next(iter(data.values()))
        if isinstance(first, (list, tuple)) and first:
            return str(first[0])
        return str(first)
    if isinstance(data, (list, tuple)) and data:
        first = data[0]
        if isinstance(first, dict):
            return _extract_message(first)
        return str(first)
    return str(data)


def taskify_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    message = _extract_message(response.data)
    response.data = {
        'message': message,
        'detail': message,
        'status': response.status_code,
    }
    return response
