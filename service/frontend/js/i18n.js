// Textos da interface; nunca traduzir dados introduzidos pelos utilizadores.
(function () {
  const entries = [
    ['A space for everyone', 'A space for everyone', 'Um espaço para todos'],
    ['Welcome screen', 'Welcome screen', 'Ecrã de boas-vindas'],
    ['Continue', 'Continue', 'Continuar'],
    ['Logging in…', 'Logging in…', 'A iniciar sessão…'],
    ['Try again', 'Try again', 'Tentar novamente'],
    ['Install SchoolCore', 'Install SchoolCore', 'Instalar SchoolCore'],
    ['Install now', 'Install now', 'Instalar agora'],
    ['Login', 'Login', 'Iniciar sessão'],
    ['Username', 'Username', 'Nome de utilizador'],
    ['Password', 'Password', 'Palavra-passe'],
    ['Terms and Conditions', 'Terms and Conditions', 'Termos e condições'],
    ['By logging in, you declare that the information provided is yours and that you agree to use the application responsibly. Access is personal and non-transferable, so you must not share your login credentials with third parties. Misuse of the account may result in suspension of access. Your data is processed solely for authentication and account management purposes.', 'By logging in, you declare that the information provided is yours and that you agree to use the application responsibly. Access is personal and non-transferable, so you must not share your login credentials with third parties. Misuse of the account may result in suspension of access. Your data is processed solely for authentication and account management purposes.', 'Ao iniciar sessão, declaras que os dados fornecidos são teus e que concordas em utilizar a aplicação de forma responsável. O acesso é pessoal e intransmissível; não partilhes as tuas credenciais. A utilização indevida pode resultar na suspensão da conta. Os teus dados são tratados apenas para autenticação e gestão da conta.'],
    ['Welcome to SchoolCore', 'Welcome to SchoolCore', 'Bem-vindo ao SchoolCore'],
    ['SchoolCore is an app for school life, designed for students, teachers and administrators.', 'SchoolCore is an app for school life, designed for students, teachers and administrators.', 'O SchoolCore é uma aplicação para a vida escolar, destinada a alunos, professores e administradores.'],
    ['What you can do now:', 'What you can do now:', 'O que já podes fazer:'],
    ['Sign in with your personal account.', 'Sign in with your personal account.', 'Iniciar sessão com a tua conta pessoal.'],
    ['Install the app on your phone and open it from your home screen.', 'Install the app on your phone and open it from your home screen.', 'Instalar a aplicação no telemóvel e abri-la a partir do ecrã inicial.'],
    ['More school features are in development and will depend on your role.', 'More school features are in development and will depend on your role.', 'Estão a ser desenvolvidas mais funcionalidades escolares, que dependerão do teu perfil.'],
    ['Get started', 'Get started', 'Começar'],
    ['Loading…', 'Loading…', 'A carregar…'],
    ['Loading...', 'Loading...', 'A carregar…'],
    ['Home', 'Home', 'Início'],
    ['Good morning, {name}!', 'Good morning, {name}!', 'Bom dia, {name}!'],
    ['Good afternoon, {name}!', 'Good afternoon, {name}!', 'Boa tarde, {name}!'],
    ['Good evening, {name}!', 'Good evening, {name}!', 'Boa noite, {name}!'],
    ['Posts', 'Posts', 'Publicações'],
    ['View all posts', 'View all posts', 'Ver todas as publicações'],
    ['All posts', 'All posts', 'Todas as publicações'],
    ['Back to home', 'Back to home', 'Voltar ao início'],
    ['Create a post', 'Create a post', 'Criar publicação'],
    ['Title', 'Title', 'Título'],
    ['Message', 'Message', 'Mensagem'],
    ['Publish', 'Publish', 'Publicar'],
    ['Publishing…', 'Publishing…', 'A publicar…'],
    ['Post published.', 'Post published.', 'Publicação criada.'],
    ['Please enter a title and message.', 'Please enter a title and message.', 'Introduz um título e uma mensagem.'],
    ['Only administrators can publish posts.', 'Only administrators can publish posts.', 'Só os administradores podem criar publicações.'],
    ['Could not publish. Please try again.', 'Could not publish. Please try again.', 'Não foi possível publicar. Tenta novamente.'],
    ['No posts yet.', 'No posts yet.', 'Ainda não existem publicações.'],
    ['Could not load posts. Tap to try again.', 'Could not load posts. Tap to try again.', 'Não foi possível carregar publicações. Toca para tentar novamente.'],
    ['Could not load posts. Please try again.', 'Could not load posts. Please try again.', 'Não foi possível carregar as publicações. Tenta novamente.'],
    ['Load more', 'Load more', 'Carregar mais'],
    ['Calendar', 'Calendar', 'Calendário'],
    ['Previous month', 'Previous month', 'Mês anterior'],
    ['Next month', 'Next month', 'Mês seguinte'],
    ['User', 'User', 'Utilizador'],
    ['Lunch', 'Lunch', 'Almoço'],
    ['School Info', 'School Info', 'Informação escolar'],
    ['Main navigation', 'Main navigation', 'Navegação principal'],
    ['Choose an option below. More features are coming soon.', 'Choose an option below. More features are coming soon.', 'Escolhe uma opção abaixo. Brevemente haverá mais funcionalidades.'],
    ['View account information', 'View account information', 'Ver dados da conta'],
    ['GIAE · Site externo', 'GIAE · External site', 'GIAE · Site externo'],
    ['Recarregar GIAE', 'Reload GIAE', 'Recarregar GIAE'],
    ['Abrir no navegador', 'Open in browser', 'Abrir no navegador'],
    ['(nova janela)', '(new window)', '(nova janela)'],
    ['Page not found', 'Page not found', 'Página não encontrada'],
    ['This page is not available yet. Please check back later.', 'This page is not available yet. Please check back later.', 'Esta página ainda não está disponível. Volta mais tarde.'],
    ['Dados da conta', 'Account details', 'Dados da conta'],
    ['Definições da app', 'App settings', 'Definições da app'],
    ['Account ID', 'Account ID', 'ID da conta'],
    ['First name', 'First name', 'Nome'],
    ['Last name', 'Last name', 'Apelido'],
    ['Email', 'Email', 'Email'],
    ['Phone number', 'Phone number', 'Número de telefone'],
    ['Grade', 'Grade', 'Ano'],
    ['Class', 'Class', 'Turma'],
    ['Role', 'Role', 'Perfil'],
    ['Date of birth', 'Date of birth', 'Data de nascimento'],
    ['Account created', 'Account created', 'Conta criada'],
    ['Account status', 'Account status', 'Estado da conta'],
    ['Introduction completed', 'Introduction completed', 'Introdução concluída'],
    ['Private information', 'Private information', 'Informação privada'],
    ['Hidden', 'Hidden', 'Oculto'],
    ['Show account ID', 'Show account ID', 'Mostrar ID da conta'],
    ['Hide account ID', 'Hide account ID', 'Ocultar ID da conta'],
    ['Show email', 'Show email', 'Mostrar email'],
    ['Hide email', 'Hide email', 'Ocultar email'],
    ['Show phone number', 'Show phone number', 'Mostrar número de telefone'],
    ['Hide phone number', 'Hide phone number', 'Ocultar número de telefone'],
    ['School information is coming soon', 'School information is coming soon', 'A informação escolar estará disponível brevemente'],
    ['Bar is coming soon', 'Bar is coming soon', 'O bar estará disponível brevemente'],
    ['Lunch booking is coming soon', 'Lunch booking is coming soon', 'A marcação de refeições estará disponível brevemente'],
    ['SchoolCore — Home', 'SchoolCore — Home', 'SchoolCore — Início'],
    ['SchoolCore — Account', 'SchoolCore — Account', 'SchoolCore — Conta'],
    ['Login SC', 'Login SC', 'Iniciar sessão SC'],
    ['Page not found — SchoolCore', 'Page not found — SchoolCore', 'Página não encontrada — SchoolCore'],
    ['Loading — SchoolCore', 'Loading — SchoolCore', 'A carregar — SchoolCore'],
    ['Aparência', 'Appearance', 'Aparência'],
    ['Tema', 'Theme', 'Tema'],
    ['Claro', 'Light', 'Claro'],
    ['Blur da barra de navegação', 'Navigation bar blur', 'Desfoque da barra de navegação'],
    ['Acessibilidade', 'Accessibility', 'Acessibilidade'],
    ['Animações', 'Animations', 'Animações'],
    ['Seguir o dispositivo', 'Follow device settings', 'Seguir o dispositivo'],
    ['Reduzir animações', 'Reduce animations', 'Reduzir animações'],
    ['Tamanho do texto', 'Text size', 'Tamanho do texto'],
    ['Maior', 'Large', 'Maior'],
    ['Idioma', 'Language', 'Idioma'],
    ['Repor definições', 'Reset settings', 'Repor definições'],
    ['Segurança', 'Security', 'Segurança'],
    ['Confirma a password da tua conta para alterar os dados de segurança.', 'Confirm your account password to change security details.', 'Confirma a palavra-passe da tua conta para alterar os dados de segurança.'],
    ['Password atual', 'Current password', 'Palavra-passe atual'],
    ['Desbloquear', 'Unlock', 'Desbloquear'],
    ['Acesso válido durante 5 minutos.', 'Access is valid for 5 minutes.', 'Acesso válido durante 5 minutos.'],
    ['Novo email', 'New email', 'Novo email'],
    ['Alterar email', 'Change email', 'Alterar email'],
    ['Nova password (mínimo 12 caracteres)', 'New password (at least 12 characters)', 'Nova palavra-passe (mínimo 12 caracteres)'],
    ['Confirmar nova password', 'Confirm new password', 'Confirmar nova palavra-passe'],
    ['A alteração termina a sessão em todos os dispositivos.', 'Changing it signs you out on all devices.', 'A alteração termina a sessão em todos os dispositivos.'],
    ['Alterar password', 'Change password', 'Alterar palavra-passe'],
    ['Sign out', 'Sign out', 'Terminar sessão'],
    ['Back', 'Back', 'Voltar'],
    ['Dismiss notification', 'Dismiss notification', 'Fechar notificação'],
    ['Not available', 'Not available', 'Não disponível'],
    ['Student', 'Student', 'Aluno'],
    ['Teacher', 'Teacher', 'Professor'],
    ['Administrator', 'Administrator', 'Administrador'],
    ['Active', 'Active', 'Ativa'],
    ['Disabled', 'Disabled', 'Desativada'],
    ['Yes', 'Yes', 'Sim'],
    ['No', 'No', 'Não'],
    ['Hello, {name}!', 'Hello, {name}!', 'Olá, {name}!'],
    ['Welcome, {name}!', 'Welcome, {name}!', 'Bem-vindo, {name}!'],
    ['Welcome to SchoolCore, {name}!', 'Welcome to SchoolCore, {name}!', 'Bem-vindo ao SchoolCore, {name}!'],
    ['A guardar…', 'Saving…', 'A guardar…'],
    ['Guardado.', 'Saved.', 'Guardado.'],
    ['Não foi possível guardar. Tenta novamente.', 'Could not save. Please try again.', 'Não foi possível guardar. Tenta novamente.'],
    ['O servidor rejeitou este endereço. Verifica se APP_ORIGIN corresponde ao endereço da app.', 'The server rejected this address. Check that APP_ORIGIN matches the app address.', 'O servidor rejeitou este endereço. Verifica se APP_ORIGIN corresponde ao endereço da app.'],
    ['O servidor recusou este pedido (403).', 'The server rejected this request (403).', 'O servidor recusou este pedido (403).'],
    ['O servidor não aceitou os dados enviados (422).', 'The server did not accept the submitted data (422).', 'O servidor não aceitou os dados enviados (422).'],
    ['O servidor ou a base de dados não está disponível. Tenta novamente.', 'The server or database is unavailable. Please try again.', 'O servidor ou a base de dados não está disponível. Tenta novamente.'],
    ['Não foi possível concluir o pedido. Tenta novamente.', 'Could not complete the request. Please try again.', 'Não foi possível concluir o pedido. Tenta novamente.'],
    ['Não foi possível carregar as definições. Atualiza a página para tentar novamente.', 'Could not load settings. Refresh the page to try again.', 'Não foi possível carregar as definições. Atualiza a página para tentar novamente.'],
    ['Repor as definições da app?', 'Reset app settings?', 'Repor as definições da app?'],
    ['Could not load your account. Refresh the page to try again.', 'Could not load your account. Refresh the page to try again.', 'Não foi possível carregar a conta. Atualiza a página para tentar novamente.'],
    ['Could not load your account. Please refresh the page.', 'Could not load your account. Please refresh the page.', 'Não foi possível carregar a conta. Atualiza a página.'],
    ['Could not save. Please try again.', 'Could not save. Please try again.', 'Não foi possível guardar. Tenta novamente.'],
    ['Saving…', 'Saving…', 'A guardar…'],
    ['Signing out...', 'Signing out...', 'A terminar sessão…'],
    ['Could not sign out. Please try again.', 'Could not sign out. Please try again.', 'Não foi possível terminar sessão. Tenta novamente.'],
    ['Signing in…', 'Signing in…', 'A iniciar sessão…'],
    ['Signed in. Opening the home page…', 'Signed in. Opening the home page…', 'Sessão iniciada. A abrir a página inicial…'],
    ['Your session could not be saved. Check that cookies are enabled and use HTTPS.', 'Your session could not be saved. Check that cookies are enabled and use HTTPS.', 'Não foi possível guardar a sessão. Verifica se os cookies estão ativos e usa HTTPS.'],
    ['Could not verify your session. Please try again.', 'Could not verify your session. Please try again.', 'Não foi possível verificar a sessão. Tenta novamente.'],
    ['Your account is now disabled, please talk to your school support', 'Your account is now disabled, please talk to your school support', 'A tua conta está desativada. Contacta o apoio da escola.'],
    ['The server rejected this address. Ask your administrator to check APP_ORIGIN.', 'The server rejected this address. Ask your administrator to check APP_ORIGIN.', 'O servidor rejeitou este endereço. Pede ao administrador para verificar APP_ORIGIN.'],
    ['Incorrect username or password.', 'Incorrect username or password.', 'Nome de utilizador ou palavra-passe incorretos.'],
    ['Too many attempts. Please wait a few minutes and try again.', 'Too many attempts. Please wait a few minutes and try again.', 'Demasiadas tentativas. Aguarda alguns minutos e tenta novamente.'],
    ['Could not sign in. Please try again.', 'Could not sign in. Please try again.', 'Não foi possível iniciar sessão. Tenta novamente.'],
    ['The server took too long to respond. Please try again.', 'The server took too long to respond. Please try again.', 'O servidor demorou demasiado a responder. Tenta novamente.'],
    ['Could not reach the server. Please try again.', 'Could not reach the server. Please try again.', 'Não foi possível contactar o servidor. Tenta novamente.'],
    ['Install on your iPhone', 'Install on your iPhone', 'Instalar no iPhone'],
    ['Open in Safari', 'Open in Safari', 'Abrir no Safari'],
    ['Add SchoolCore to your home screen to use it as an app.', 'Add SchoolCore to your home screen to use it as an app.', 'Adiciona o SchoolCore ao ecrã principal para o usar como aplicação.'],
    ['For the best installation experience, copy the link and open it in Safari.', 'For the best installation experience, copy the link and open it in Safari.', 'Para instalar, copia o link e abre-o no Safari.'],
    ['Open this site in <strong>Safari</strong>.', 'Open this site in <strong>Safari</strong>.', 'Abre este site no <strong>Safari</strong>.'],
    ['Tap the <strong>Share</strong> button {icon} in the Safari toolbar.', 'Tap the <strong>Share</strong> button {icon} in the Safari toolbar.', 'Toca no botão <strong>Partilhar</strong> {icon} na barra do Safari.'],
    ['Choose <strong>Add to Home Screen</strong>.', 'Choose <strong>Add to Home Screen</strong>.', 'Escolhe <strong>Adicionar ao ecrã principal</strong>.'],
    ['Tap <strong>Add</strong> to confirm.', 'Tap <strong>Add</strong> to confirm.', 'Toca em <strong>Adicionar</strong> para confirmar.'],
    ['Install on your phone', 'Install on your phone', 'Instalar no telemóvel'],
    ['Install SchoolCore to open it faster without the browser.', 'Install SchoolCore to open it faster without the browser.', 'Instala o SchoolCore para o abrir mais rapidamente, sem o navegador.'],
    ['Tap the browser menu <strong>⋮</strong>.', 'Tap the browser menu <strong>⋮</strong>.', 'Toca no menu do navegador <strong>⋮</strong>.'],
    ['Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.', 'Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.', 'Escolhe <strong>Instalar aplicação</strong> ou <strong>Adicionar ao ecrã principal</strong>.'],
    ['Tap <strong>Install</strong> to confirm.', 'Tap <strong>Install</strong> to confirm.', 'Toca em <strong>Instalar</strong> para confirmar.'],
    ['Available on mobile only', 'Available on mobile only', 'Disponível apenas em dispositivos móveis'],
    ['This service is not available on computers. Open the site on an Android phone or iPhone to install the app.', 'This service is not available on computers. Open the site on an Android phone or iPhone to install the app.', 'Este serviço não está disponível em computadores. Abre o site num telemóvel Android ou iPhone para instalar a aplicação.'],
    ['The server is unavailable or encountered an error. Please try again later.', 'The server is unavailable or encountered an error. Please try again later.', 'O servidor está indisponível ou ocorreu um erro. Tenta novamente mais tarde.'],
    ['Could not connect to the server. Check your connection and try again.', 'Could not connect to the server. Check your connection and try again.', 'Não foi possível ligar ao servidor. Verifica a ligação e tenta novamente.'],
    ['Puxa para atualizar', 'Pull to refresh', 'Puxa para atualizar'],
    ['Solta para atualizar', 'Release to refresh', 'Solta para atualizar'],
    ['A atualizar…', 'Refreshing…', 'A atualizar…'],
    ['Please rotate your device to portrait.', 'Please rotate your device to portrait.', 'Roda o dispositivo para a posição vertical.'],
    ['{page} is not available yet. Please check back later.', '{page} is not available yet. Please check back later.', '{page} ainda não está disponível. Volta mais tarde.'],
    ['Could not load this page. Restart the server and try again.', 'Could not load this page. Restart the server and try again.', 'Não foi possível carregar esta página. Reinicia o servidor e tenta novamente.'],
    ['Could not load this page. Refresh to try again.', 'Could not load this page. Refresh to try again.', 'Não foi possível carregar esta página. Atualiza para tentar novamente.'],
    ['A verificar…', 'Checking…', 'A verificar…'],
    ['Demasiadas tentativas. Aguarda e tenta novamente.', 'Too many attempts. Wait and try again.', 'Demasiadas tentativas. Aguarda e tenta novamente.'],
    ['Password incorreta ou sessão expirada.', 'Incorrect password or expired session.', 'Palavra-passe incorreta ou sessão expirada.'],
    ['Não foi possível verificar. Tenta novamente.', 'Could not verify. Please try again.', 'Não foi possível verificar. Tenta novamente.'],
    ['Acesso expirado. Confirma novamente a password.', 'Access expired. Confirm your password again.', 'Acesso expirado. Confirma novamente a palavra-passe.'],
    ['Não foi possível contactar o servidor.', 'Could not reach the server.', 'Não foi possível contactar o servidor.'],
    ['Email atualizado.', 'Email updated.', 'Email atualizado.'],
    ['Não foi possível alterar o email.', 'Could not change email.', 'Não foi possível alterar o email.'],
    ['As passwords não coincidem.', 'Passwords do not match.', 'As palavras-passe não coincidem.'],
    ['Alterar a password e terminar todas as sessões?', 'Change password and sign out everywhere?', 'Alterar a palavra-passe e terminar todas as sessões?'],
    ['Não foi possível confirmar a alteração. Tenta iniciar sessão com a nova password.', 'Could not confirm the change. Try signing in with the new password.', 'Não foi possível confirmar a alteração. Tenta iniciar sessão com a nova palavra-passe.']
  ];
  const translations = Object.fromEntries(entries.map(([key, en, pt]) => [key, { en, 'pt-PT': pt }]));
  let language = document.documentElement.dataset?.defaultLanguage === 'en'
    ? 'en' : /^pt(?:-|$)/i.test(navigator.language || '') ? 'pt-PT' : 'en';
  const textNodes = [];
  const attributes = [];
  const titleKey = document.title;
  const t = (key, params = {}) => {
    const value = translations[key]?.[language] || translations[key]?.en || key;
    return value.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
  };
  function collect() {
    // Registar apenas textos conhecidos evita traduzir publicações ou dados pessoais.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (['SCRIPT', 'STYLE'].includes(node.parentElement?.tagName)) continue;
      const key = node.nodeValue.trim();
      if (translations[key]) textNodes.push({ node, key, original: node.nodeValue, last: node.nodeValue });
    }
    document.querySelectorAll('[aria-label], [title], [placeholder]').forEach(element => {
      for (const name of ['aria-label', 'title', 'placeholder']) {
        const key = element.getAttribute(name);
        if (translations[key]) attributes.push({ element, name, key, last: key });
      }
    });
  }
  function setLanguage(value) {
    language = value === 'pt-PT' ? 'pt-PT' : 'en';
    document.documentElement.lang = language;
    if (translations[titleKey]) document.title = t(titleKey);
    for (const item of textNodes) {
      // Se outro código mudou o texto, não o substituímos por uma tradução antiga.
      if (item.node.nodeValue !== item.last) continue;
      item.last = item.original.replace(item.key, t(item.key));
      item.node.nodeValue = item.last;
    }
    for (const item of attributes) {
      if (item.element.getAttribute(item.name) !== item.last) continue;
      item.last = t(item.key);
      item.element.setAttribute(item.name, item.last);
    }
    window.dispatchEvent(new CustomEvent('schoolcore:language', { detail: language }));
  }
  collect();
  window.schoolcoreI18n = { t, setLanguage, getLanguage: () => language };
  setLanguage(language);
})();
