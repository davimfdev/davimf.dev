import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-8 text-gray-300">
      <h1 className="text-4xl font-bold mb-6 text-white">Política de Privacidade</h1>
      
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">1. Introdução</h2>
          <p>
            Bem-vindo à nossa Política de Privacidade. Sua privacidade é importante para nós. Esta política explica como coletamos, usamos e protegemos suas informações quando você utiliza nosso site e, especificamente, a funcionalidade de integração com o Google Calendar.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">2. Coleta de Dados</h2>
          <p>
            Ao conectar sua conta do Google para sincronizar sua agenda, solicitamos sua permissão para acessar seu Google Calendar e Google Tasks. Os únicos dados que armazenamos em nossos servidores são:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 pl-4">
            <li>
              <strong>Token de Atualização (Refresh Token) do Google:</strong> Este é um token seguro que nos permite solicitar novos tokens de acesso para interagir com a API do Google em seu nome, sem que você precise fazer login repetidamente. Este token é armazenado de forma criptografada em nosso banco de dados.
            </li>
          </ul>
          <p className="mt-2">
            Nós <strong>não</strong> armazenamos seus eventos, tarefas, detalhes de agenda, ou sua senha do Google.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">3. Uso dos Dados</h2>
          <p>
            Utilizamos o acesso concedido e o token de atualização exclusivamente para as seguintes finalidades:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 pl-4">
            <li><strong>Importar eventos e tarefas:</strong> Ler os itens da sua agenda do Google para exibi-los em sua lista de tarefas no nosso site.</li>
            <li><strong>Criar e atualizar eventos:</strong> Criar, editar ou marcar eventos como concluídos no seu Google Calendar quando você realiza essas ações no nosso site.</li>
            <li><strong>Excluir eventos e tarefas:</strong> Remover itens do seu Google Calendar quando você os exclui no nosso site.</li>
          </ul>
          <p className="mt-2">
            O uso das informações recebidas das APIs do Google seguirá a <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Política de Dados do Usuário dos Serviços de API do Google</a>, incluindo os requisitos de Uso Limitado.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">4. Compartilhamento de Dados</h2>
          <p>
            Nós não compartilhamos, vendemos ou alugamos suas informações pessoais ou dados do Google com terceiros.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">5. Segurança</h2>
          <p>
            Tomamos medidas de segurança para proteger suas informações. O token de atualização do Google é criptografado antes de ser armazenado em nosso banco de dados, adicionando uma camada extra de proteção.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">6. Revogando o Acesso</h2>
          <p>
            Você pode revogar o acesso do nosso aplicativo à sua conta do Google a qualquer momento através da página de segurança do Google:
          </p>
          <p className="mt-2">
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              https://myaccount.google.com/permissions
            </a>
          </p>
          <p className="mt-2">
            Ao revogar o acesso, excluiremos o token de atualização associado à sua conta de nossos sistemas.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">7. Contato</h2>
          <p>
            Se você tiver alguma dúvida sobre esta Política de Privacidade, entre em contato conosco através do formulário de contato do site.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
