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

Por defeito o servidor usa a porta 8080. O comando de criação pede username, nome, apelido, email, telefone, ano, turma, perfil, data de nascimento e password. Email, telefone, ano e turma são opcionais; deixa a resposta vazia se não se aplicarem. O ano é guardado como número e o telefone como texto. A data é guardada como data BSON, a password como hash Argon2 e a conta começa ativa, com a introdução por concluir. Os usernames são únicos e distinguem maiúsculas de minúsculas. Para testar noutro dispositivo, configura `HOST=0.0.0.0` e `APP_ORIGIN` com o endereço exato de acesso; a instalação PWA necessita de HTTPS ou localhost.

Contas antigas sem perfil ou estado são tratadas como alunos ativos; sem a marca de introdução concluída, veem-na no próximo acesso. Contas com `is_active: false` ou um perfil inválido não podem iniciar nem manter sessão. Ainda não existem funcionalidades específicas nem permissões adicionais para cada perfil, nem alteração obrigatória de password no primeiro login.

## Produção

Esta é uma base de desenvolvimento, **não pronta para produção**. Antes de usar dados reais, configura HTTPS, `COOKIE_SECURE=true`, `APP_ORIGIN` com a origem HTTPS pública e MongoDB com autenticação e acesso restrito. Não exponhas o MongoDB publicamente. As novas sessões são guardadas no MongoDB e expiram 30 dias após o login; `GET /api/me` consulta a sessão e `POST /api/logout` termina-a.

O login limita pedidos por endereço IP a 15 por janela fixa de 5 minutos, partilhados entre processos através do MongoDB. Isto inclui pedidos com sucesso; utilizadores atrás do mesmo IP partilham o limite. A proteção não impede ataques distribuídos nem substitui limitação no proxy/firewall. O servidor não confia em cabeçalhos de IP enviados pelo cliente; atrás de um proxy todos os pedidos poderão contar como o mesmo IP. Configura limitação por IP no proxy de confiança antes de colocar o serviço em produção.

Uma credencial MongoDB esteve anteriormente no código e no histórico Git: **altera-a/revoga-a** e atualiza `MONGODB_URI` no `.env`. Remover a credencial do código não a remove do histórico. Por opção da aplicação, o login revela se um username pertence a uma conta desativada; isto facilita a enumeração de contas.

Faltam ainda políticas de conta, recuperação de password, auditoria, backups, testes de segurança e carga e uma política CSP mais restritiva (atualmente são necessários scripts e estilos inline). Usa HTTPS também entre o proxy e o serviço quando apropriado. A instalação PWA e sessões persistentes dependem do navegador e das suas configurações.

## Testes

```bash
pip install -r requirements-test.txt
python -m unittest discover -s tests
```

## Teste de carga local

O teste cria contas temporárias numa base separada, simula login, pedidos autenticados a `/api/me` e logout, e apresenta tempos de resposta, códigos HTTP e pedidos por segundo. Não executes o teste contra o servidor ou a base de produção: este teste pode consumir CPU, memória e ligações e deve correr num ambiente isolado. O nome da base tem de terminar em `_loadtest`, mas isso não garante, por si só, que o servidor é isolado.

Instala `requirements-test.txt` e, num terminal PowerShell na pasta `service`, arranca uma instância separada da aplicação. Ela usa a ligação MongoDB de `service/.env`, mas uma base e porta de teste próprias:

```powershell
$env:MONGODB_DATABASE = 'schoolcore_loadtest'
$env:HOST = '127.0.0.1'
$env:PORT = '8081'
$env:APP_ORIGIN = 'http://127.0.0.1:8081'
$env:COOKIE_SECURE = 'false'
python launch.py serve
```

Noutro terminal, com o ambiente virtual ativo e na pasta `service`, executa:

```powershell
python load_test.py --database schoolcore_loadtest --confirm-test-db --url http://127.0.0.1:8081 --users 5 --concurrency 5 --requests 5
```

O servidor tem de usar a mesma base MongoDB e a mesma origem indicadas ao script. `--users` define o número de contas, `--concurrency` o máximo de utilizadores em simultâneo e `--requests` o número de pedidos `/api/me` por utilizador. O relatório inclui respostas de erro; p95 e p99 são percentis dos tempos dos pedidos que receberam resposta HTTP. A duração e o débito não incluem a criação das contas nem a limpeza.

O limite normal de 15 logins por IP em cada janela de 5 minutos mantém-se ativo, incluindo logins de execuções anteriores. Um `429` significa que o limite foi atingido, não necessariamente que o servidor está sobrecarregado. Para testar cargas maiores sem alterar a proteção, são necessários clientes com IPs diferentes; não falsifiques cabeçalhos de IP. Não uses esta instância com utilizadores reais: para HTTP a cookie segura está desativada.

O script remove apenas as contas da sua execução e as respetivas sessões, mesmo em caso de erro normal ou interrupção por Ctrl+C. Uma paragem forçada, falha de energia ou falha de ligação pode impedir a limpeza. Guarda o ID da execução mostrado no início; para repetir a limpeza, com a mesma ligação MongoDB configurada:

```powershell
python load_test.py --database schoolcore_loadtest --confirm-test-db --cleanup-run ID_DA_EXECUCAO
```

A base de teste, os índices e os registos temporários de limitação de login permanecem; estes últimos expiram automaticamente. O script nunca apaga a base inteira nem os limites de outros utilizadores. As variáveis `$env:` alteradas no primeiro terminal mantêm-se nessa sessão; fecha-o ou remove-as antes de voltar a iniciar o servidor normal.
