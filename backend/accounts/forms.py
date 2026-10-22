from django import forms
from django.contrib.auth.forms import UserChangeForm as DjangoUserChangeForm

from .models import User


class TaskifyUserCreationForm(forms.ModelForm):
    """Formulaire de création admin compatible User sans username."""

    password1 = forms.CharField(label='Mot de passe', widget=forms.PasswordInput)
    password2 = forms.CharField(
        label='Confirmation', widget=forms.PasswordInput, help_text='Retapez le mot de passe'
    )

    class Meta:
        model = User
        fields = ('email', 'name')

    def clean_password2(self):
        p1 = self.cleaned_data.get('password1')
        p2 = self.cleaned_data.get('password2')
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError('Les mots de passe ne correspondent pas')
        return p2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password1'])
        if commit:
            user.save()
        return user


class TaskifyUserChangeForm(DjangoUserChangeForm):
    class Meta(DjangoUserChangeForm.Meta):
        model = User
        fields = ('email', 'name', 'avatar_color')
