"""Validação e valores padrão das preferências da conta."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, StrictBool, ValidationError


class Preferences(BaseModel):
    model_config = ConfigDict(extra='forbid')

    theme: Literal['normal', 'light', 'amoled'] = 'normal'
    navbar_blur: StrictBool = True
    motion: Literal['system', 'reduced'] = 'system'
    text_size: Literal['normal', 'large'] = 'normal'
    language: Literal['pt-PT', 'en'] = 'en'


class PreferencesUpdate(Preferences):
    theme: Literal['normal', 'light', 'amoled']
    navbar_blur: StrictBool
    motion: Literal['system', 'reduced']
    text_size: Literal['normal', 'large']
    # Older clients do not send a language; leave the stored choice untouched.
    language: Literal['pt-PT', 'en'] | None = None


def preferences_for(user):
    """Preserva valores válidos de contas antigas ou parcialmente configuradas."""
    stored = user.get('preferences')
    if not isinstance(stored, dict):
        return Preferences()
    values = {}
    for name in Preferences.model_fields:
        if name not in stored:
            continue
        try:
            values[name] = getattr(Preferences.model_validate({name: stored[name]}), name)
        except ValidationError:
            continue
    return Preferences(**values)
