import React from 'react';

const TermsOfService: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-8 text-gray-300">
      <h1 className="text-4xl font-bold mb-6 text-white">Termos de Serviço</h1>
      
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">1. Aceitação dos Termos</h2>
          <p>
            Ao acessar e utilizar nosso site e seus serviços, você aceita e concorda em estar vinculado aos termos e disposições deste acordo. Se você não concorda com algum destes termos, você não está autorizado a usar este site.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">2. Descrição do Serviço</h2>
          <p>
            Nosso site oferece um conjunto de ferramentas, incluindo uma lista de tarefas com integração opcional com o Google Calendar e Google Tasks. Este serviço é fornecido "como está", sem garantias de qualquer tipo.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">3. Conduta do Usuário</h2>
          <p>
            Você concorda em não usar o serviço para qualquer finalidade ilegal ou proibida por estes termos. Você é responsável por toda a sua atividade em conexão com o serviço.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">4. Integração com o Google</h2>
          <p>
            A integração com o Google Calendar e Google Tasks é uma funcionalidade opcional. Ao utilizá-la, você nos concede permissão para acessar e modificar dados em sua agenda e listas de tarefas, conforme descrito em nossa Política de Privacidade. A disponibilidade e o funcionamento desta integração dependem dos serviços e APIs do Google.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">5. Limitação de Responsabilidade</h2>
          <p>
            Em nenhuma circunstância o proprietário deste site será responsável por quaisquer danos diretos, indiretos, incidentais, especiais ou consequenciais que resultem do uso ou da incapacidade de usar este serviço. O uso do serviço é por sua conta e risco. Não oferecemos garantia de que o serviço estará livre de erros, interrupções ou perda de dados.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2 text-white">6. Modificações nos Termos</h2>
          <p>
            Reservamo-nos o direito de modificar estes termos a qualquer momento. Aconselhamos que você revise esta página periodicamente para estar ciente de quaisquer alterações. O uso continuado do site após a publicação de alterações constituirá sua aceitação dos novos termos.
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService;
