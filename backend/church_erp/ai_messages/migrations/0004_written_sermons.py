"""Written sermons, and embeddings that belong to them (AGENT_EXECUTION_PLAN.md, Tasks 4.1 and 4.2).

SermonEmbedding pointed at the public Sermon with a one-to-one link, which
allowed only one passage per sermon. No embeddings had been made, so its table
is made again, pointing at the new SermonDocument. The same goes for the
unused link from daily messages to public sermons."""
import django.db.models.deletion
import pgvector.django.vector
from django.conf import settings
from django.db import migrations, models

import church_erp.media_library.models


class Migration(migrations.Migration):

    dependencies = [
        ('ai_messages', '0003_one_published_message_per_day'),
        ('core', '0009_staffchange'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.DeleteModel(name='SermonEmbedding'),
        migrations.RemoveField(model_name='dailymessage', name='source_sermons'),
        migrations.CreateModel(
            name='SermonDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=300)),
                ('preached_on', models.DateField(blank=True, null=True)),
                ('text', models.TextField()),
                ('source_file', models.FileField(blank=True, storage=church_erp.media_library.models.private_storage, upload_to='sermon_documents/')),
                ('source_name', models.CharField(blank=True, help_text="The file's name on the pastor's computer", max_length=255)),
                ('file_kind', models.CharField(blank=True, max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('minister', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sermon_documents', to='core.minister')),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-preached_on', '-created_at']},
        ),
        migrations.CreateModel(
            name='SermonEmbedding',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chunk_index', models.PositiveIntegerField()),
                ('chunk_text', models.TextField()),
                ('embedding', pgvector.django.vector.VectorField(dimensions=1536)),
                ('model', models.CharField(max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('document', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='embeddings', to='ai_messages.sermondocument')),
            ],
            options={
                'ordering': ['document', 'chunk_index'],
                'constraints': [models.UniqueConstraint(fields=('document', 'chunk_index'), name='one_embedding_per_chunk')],
            },
        ),
        migrations.AddField(
            model_name='dailymessage',
            name='ai_generated',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='dailymessage',
            name='source_documents',
            field=models.ManyToManyField(blank=True, help_text='Written sermons the draft was based on', related_name='daily_messages', to='ai_messages.sermondocument'),
        ),
    ]
