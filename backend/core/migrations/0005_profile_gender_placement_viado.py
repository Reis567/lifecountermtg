# v2.7.0: sexo do perfil (desempate: mulher na frente) e marca de quem foi
# sorteado como viado na partida (desempate: mais vezes sorteado na frente).
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_death_cause_starter'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='gender',
            field=models.CharField(blank=True, choices=[('', 'Não informado'), ('f', 'Mulher'), ('m', 'Homem')], default='', max_length=1, verbose_name='Sexo'),
        ),
        migrations.AddField(
            model_name='matchplacement',
            name='viado',
            field=models.BooleanField(default=False, verbose_name='Sorteado como viado'),
        ),
    ]
