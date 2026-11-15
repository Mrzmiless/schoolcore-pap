# Backend SchoolCore (fase inicial)

Este backend implementa autenticação e encaminha o utilizador para uma página inicial provisória; as funcionalidades escolares ainda não existem.

## Organização do código

- `launch.py`: ponto de entrada compatível com os comandos existentes.
- `backend/`: aplicação FastAPI, API, páginas, autenticação, configuração, base de dados, limite de login e comandos.
- `frontend/html/`, `frontend/css/` e `frontend/js/`: páginas, estilos e scripts separados, incluindo recursos partilhados.
- `frontend/assets/` e `frontend/pwa/`: imagens, ícones, manifesto e service worker.
- `config/`: exemplo de configuração e ficheiro `.env` privado, ignorado pelo Git.
- `tools/`: ferramentas de desenvolvimento, incluindo o teste de carga isolado.
- `tests/`: testes automáticos.

Somente os diretórios públicos de CSS e JavaScript são disponibilizados em `/assets/`. Não coloques segredos, código do servidor ou dados de utilizadores nesses diretórios. Os URLs da API, das páginas, do service worker e do manifesto mantêm-se inalterados durante a migração.

O CSS antigo, sem referências internas nas páginas atuais, foi preservado em `frontend/css/legacy-style.css` e continua disponível no endereço `/style.css`; a sua remoção requer uma verificação de utilizações externas.

## Versão em execução e atualização

Ao iniciar o servidor, os ficheiros do frontend são lidos para uma versão em memória. Alterar, acrescentar ou apagar esses ficheiros no disco não muda a versão servida até reiniciar o processo. O código Python também requer reinício; a base MongoDB e as alterações dos utilizadores continuam persistentes e não fazem parte desta cópia. Os ficheiros são servidos com `Cache-Control: no-store` para que uma atualização da página após o reinício peça a versão nova ao servidor. Uma página que já esteja aberta continua com o código carregado até ser atualizada; caches ou service workers antigos de instalações anteriores podem interferir até serem atualizados. Com vários processos, reinicia todos com os mesmos ficheiros para evitar versões diferentes.

Nas páginas da SchoolCore, desliza para baixo quando o conteúdo estiver no topo para mostrar o indicador e atualizar a app. A atualização recarrega a página e pode descartar formulários por guardar. Em conteúdo incorporado da própria SchoolCore atualiza a página principal; o navegador não permite detetar gestos dentro do GIAE externo, onde podes usar **Recarregar GIAE** ou deslizar na área da SchoolCore fora do site. A resposta ao gesto pode variar entre navegadores e dispositivos.

## Preferências da conta

Em User, as definições de tema, blur da navegação, movimento e tamanho do texto são guardadas automaticamente na conta. O servidor valida as opções e guarda-as no documento do utilizador; contas existentes sem preferências usam o tema normal, blur ativado, movimento do dispositivo e tamanho normal. O tema pessoal aplica-se após iniciar sessão, incluindo a página principal e o conteúdo incorporado; a entrada e o login mantêm o aspeto normal. As preferências não são guardadas no armazenamento local do dispositivo. Se a gravação falhar, a interface informa o utilizador e repõe a última escolha confirmada.

## PWA e ligação

A app continua instalável, mas requer ligação ao servidor. O service worker de migração remove as caches antigas com prefixo `minha-pwa-v` e não interceta pedidos. Em instalações existentes, a limpeza só acontece quando o dispositivo estiver online e receber a atualização; outras caches não são afetadas. Na abertura, um splash verifica a sessão: se existir, encaminha diretamente para a conta; caso contrário, mostra as boas-vindas e o botão Continue. A transição para o login partilha o botão nos browsers compatíveis, com uma animação alternativa nos restantes e sem movimento quando o dispositivo o pede.

## Segurança da conta

Em User → Segurança, a password atual é necessária para desbloquear alterações durante cinco minutos, apenas na sessão atual. Fechar a secção tenta bloquear imediatamente; o servidor impõe sempre a expiração. A alteração do email é imediata e ainda não tem verificação por email. A nova password tem de ter entre 12 e 256 caracteres; ao alterá-la, todas as sessões são invalidadas, incluindo a atual. A limitação de tentativas de reautenticação é aplicada tanto por IP como por conta. O ID, email e telefone aparecem ocultos por defeito, com um efeito de blur; este evita exposição visual, mas não é uma proteção contra quem já tem acesso à sessão. Passkeys e recuperação de conta ainda não estão implementadas.

## Lunch e GIAE

A aba Lunch tenta apresentar `https://giae.aeb.pt/` num painel incorporado; as opções **Recarregar GIAE** e **Abrir no navegador** estão sempre disponíveis nessa aba. Recarregar volta à página inicial do GIAE. O início de sessão é feito diretamente no GIAE: a SchoolCore não recolhe nem guarda as credenciais e não faz login automático. O painel mantém-se carregado ao trocar de aba, mas a sessão pode depender das regras do GIAE e do navegador, incluindo o bloqueio de cookies de terceiros. Se a incorporação ou o login falhar, usa o link externo. Terminar a sessão da SchoolCore não termina necessariamente a sessão do GIAE. A configuração de segurança permite incorporar apenas este domínio externo na página principal.

## Desenvolvimento local

Instala Python e MongoDB Community Server e inicia o MongoDB local. Na pasta `service`:

```bash
python -m venv .venv
# Ativa o ambiente virtual: Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
```

Copia `config/.env.example` para `config/.env` e ajusta a ligação ao MongoDB. Não publiques nem adiciones `config/.env` ao Git. Cria uma conta local e inicia o servidor:

```bash
python launch.py create-user
python launch.py serve
```

Em instalações anteriores, o ficheiro `service/.env` continua a ser aceite quando `service/config/.env` não existe. Para migrar, move o ficheiro antigo para `service/config/.env`, sem o substituir se já existir outro. Se os dois existirem, o servidor e o teste de carga recusam escolher automaticamente; confirma qual deves manter antes de continuar. Variáveis de ambiente já definidas continuam a ter prioridade sobre os valores do ficheiro.

Por defeito o servidor usa a porta 8080. O comando de criação pede username, nome, apelido, email, telefone, ano, turma, perfil, data de nascimento e password. Email, telefone, ano e turma são opcionais; deixa a resposta vazia se não se aplicarem. O ano é guardado como número e o telefone como texto. A data é guardada como data BSON, a password como hash Argon2 e a conta começa ativa, com a introdução por concluir. Os usernames são únicos e distinguem maiúsculas de minúsculas. Para testar noutro dispositivo, configura `HOST=0.0.0.0` e `APP_ORIGIN` com o endereço exato de acesso; a instalação PWA necessita de HTTPS ou localhost.

Contas antigas sem perfil ou estado são tratadas como alunos ativos; sem a marca de introdução concluída, veem-na no próximo acesso. Contas com `is_active: false` ou um perfil inválido não podem iniciar nem manter sessão. Ainda não existem funcionalidades específicas nem permissões adicionais para cada perfil, nem alteração obrigatória de password no primeiro login.

## Produção

Esta é uma base de desenvolvimento, **não pronta para produção**. Antes de usar dados reais, configura HTTPS, `COOKIE_SECURE=true`, `APP_ORIGIN` com a origem HTTPS pública e MongoDB com autenticação e acesso restrito. Não exponhas o MongoDB publicamente. As novas sessões são guardadas no MongoDB e expiram 30 dias após o login; `GET /api/me` consulta a sessão e `POST /api/logout` termina-a.

O login limita pedidos por endereço IP a 15 por janela fixa de 5 minutos, partilhados entre processos através do MongoDB. Isto inclui pedidos com sucesso; utilizadores atrás do mesmo IP partilham o limite. A proteção não impede ataques distribuídos nem substitui limitação no proxy/firewall. O servidor não confia em cabeçalhos de IP enviados pelo cliente; atrás de um proxy todos os pedidos poderão contar como o mesmo IP. Configura limitação por IP no proxy de confiança antes de colocar o serviço em produção.

Uma credencial MongoDB esteve anteriormente no código e no histórico Git: **altera-a/revoga-a** e atualiza `MONGODB_URI` no `config/.env`. Remover a credencial do código não a remove do histórico. Por opção da aplicação, o login revela se um username pertence a uma conta desativada; isto facilita a enumeração de contas.

Faltam ainda políticas de conta, recuperação de password, auditoria, backups, testes de segurança e carga e uma política CSP mais restritiva (atualmente são necessários scripts e estilos inline). Usa HTTPS também entre o proxy e o serviço quando apropriado. A instalação PWA e sessões persistentes dependem do navegador e das suas configurações.

## Testes

```bash
pip install -r requirements-test.txt
python -m unittest discover -s tests
# Opcional, com Node.js instalado: testes da PWA e interface
node --test tests/test_service_worker.js tests/test_offline_ui.js tests/test_preferences_ui.js tests/test_navigation.js tests/test_security_ui.js tests/test_welcome_transition.js tests/test_refresh.js
```

## Teste de carga local

O teste cria contas temporárias numa base separada, simula login, pedidos autenticados a `/api/me` e logout, e apresenta tempos de resposta, códigos HTTP e pedidos por segundo. Não executes o teste contra o servidor ou a base de produção: este teste pode consumir CPU, memória e ligações e deve correr num ambiente isolado. O nome da base tem de terminar em `_loadtest`, mas isso não garante, por si só, que o servidor é isolado.

Instala `requirements-test.txt` e, num terminal PowerShell na pasta `service`, arranca uma instância separada da aplicação. Ela usa a ligação MongoDB de `service/config/.env`, mas uma base e porta de teste próprias:

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
python -m tools.load_test --database schoolcore_loadtest --confirm-test-db --url http://127.0.0.1:8081 --users 5 --concurrency 5 --requests 5
```

O servidor tem de usar a mesma base MongoDB e a mesma origem indicadas ao script. `--users` define o número de contas, `--concurrency` o máximo de utilizadores em simultâneo e `--requests` o número de pedidos `/api/me` por utilizador. O relatório inclui respostas de erro; p95 e p99 são percentis dos tempos dos pedidos que receberam resposta HTTP. A duração e o débito não incluem a criação das contas nem a limpeza.

O limite normal de 15 logins por IP em cada janela de 5 minutos mantém-se ativo, incluindo logins de execuções anteriores. Um `429` significa que o limite foi atingido, não necessariamente que o servidor está sobrecarregado. Para testar cargas maiores sem alterar a proteção, são necessários clientes com IPs diferentes; não falsifiques cabeçalhos de IP. Não uses esta instância com utilizadores reais: para HTTP a cookie segura está desativada.

O script remove apenas as contas da sua execução e as respetivas sessões, mesmo em caso de erro normal ou interrupção por Ctrl+C. Uma paragem forçada, falha de energia ou falha de ligação pode impedir a limpeza. Guarda o ID da execução mostrado no início; para repetir a limpeza, com a mesma ligação MongoDB configurada:

```powershell
python -m tools.load_test --database schoolcore_loadtest --confirm-test-db --cleanup-run ID_DA_EXECUCAO
```

A base de teste, os índices e os registos temporários de limitação de login permanecem; estes últimos expiram automaticamente. O script nunca apaga a base inteira nem os limites de outros utilizadores. As variáveis `$env:` alteradas no primeiro terminal mantêm-se nessa sessão; fecha-o ou remove-as antes de voltar a iniciar o servidor normal.
