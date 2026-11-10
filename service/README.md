# Backend SchoolCore (fase inicial)

Este backend implementa autenticação e encaminha o utilizador para uma página inicial provisória; as funcionalidades escolares ainda não existem.

## Desenvolvimento local

Instala Python e MongoDB Community Server e inicia o MongoDB local. Na pasta `service`:

```bash
python -m venv .venv
# Ativa o ambiente virtual: Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
```

Copia `.env.example` para `.env` e ajusta a ligação ao MongoDB. Cria uma conta local e inicia o servidor:

```bash
python launch.py create-user
python launch.py serve
```

Por defeito o servidor usa a porta 8080. O comando de criação pede username, nome, apelido, perfil, data de nascimento e password. A data é guardada como data BSON, a password como hash Argon2 e a conta começa ativa, com a introdução por concluir. Os usernames são únicos e distinguem maiúsculas de minúsculas. Para testar noutro dispositivo, configura `HOST=0.0.0.0` e `APP_ORIGIN` com o endereço exato de acesso; a instalação PWA necessita de HTTPS ou localhost.

Contas antigas sem perfil ou estado são tratadas como alunos ativos; sem a marca de introdução concluída, veem-na no próximo acesso. Contas com `is_active: false` ou um perfil inválido não podem iniciar nem manter sessão. Ainda não existem funcionalidades específicas nem permissões adicionais para cada perfil, nem alteração obrigatória de password no primeiro login.

## Produção

Esta é uma base de desenvolvimento, **não pronta para produção**. Antes de usar dados reais, configura HTTPS, `COOKIE_SECURE=true`, `APP_ORIGIN` com a origem HTTPS pública e MongoDB com autenticação e acesso restrito. É necessário também implementar limitação de tentativas de login partilhada entre workers, políticas de conta, recuperação de password, auditoria, backups e testes de segurança e carga. Não exponhas o MongoDB publicamente. As novas sessões são guardadas no MongoDB e expiram 30 dias após o login; `GET /api/me` consulta a sessão e `POST /api/logout` termina-a.
